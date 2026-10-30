from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.infrastructure.models import UserModel
from rooms.application.read_models import (
    ArchivedRoom,
    HistoryItem,
    MyRecord,
    ParticipantView,
    RoomDetail,
    RoomListCondition,
    RoomSummary,
)
from rooms.domain.participation import Participation, TeamSide
from rooms.domain.room import DeleteReason, Room, RoomTitle
from rooms.domain.team import Team
from rooms.infrastructure.models import ParticipationModel, RoomModel, TeamModel


def _current(room_model: RoomModel) -> list[ParticipationModel]:
    """방의 이용 기록 중 아직 나가지 않은(left_at 없는) 참가만 입장 순서대로."""
    current = [p for p in room_model.participations if p.left_at is None]
    return sorted(current, key=lambda p: p.join_order)


class RoomRepository:
    """rooms·teams·participations ↔ Room·Team·Participation.

    flush만 하고 commit은 응용 서비스가 한다.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_id(self, room_id: int) -> Room | None:
        model = await self._find_model(room_id)
        return self._to_domain(model) if model else None

    async def find_current_participation(self, user_id: int) -> Participation | None:
        result = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id, ParticipationModel.left_at.is_(None))
            .options(selectinload(ParticipationModel.team))
            .order_by(ParticipationModel.joined_at.desc(), ParticipationModel.id.desc())
        )
        model = result.scalars().first()
        return self._participation_to_domain(model) if model else None

    async def save(self, room: Room) -> Room:
        if room.id is None:
            teams = [TeamModel(side=team.side.value) for team in room.teams.values()]
            model = RoomModel(participations=[], teams=teams)
            self.session.add(model)
        else:
            model = await self._find_model(room.id)
            if model is None:
                raise ValueError(f"저장할 방이 없습니다: id={room.id}")
        model.title = room.title.value
        model.capacity = Room.CAPACITY
        model.host_user_id = room.host_user_id
        model.last_join_order = room.last_join_order
        model.created_at = room.created_at
        model.deleted_at = room.deleted_at
        model.delete_reason = room.delete_reason.value if room.delete_reason else None

        # 참가 기록의 팀은 같은 방의 TeamModel로만 연결한다 (RISK-13)
        team_models = {TeamSide(t.side): t for t in model.teams}
        saved = {p.id: p for p in model.participations}
        for participation in room.participations:
            if participation.id is None:
                model.participations.append(
                    ParticipationModel(
                        user_id=participation.user_id,
                        join_order=participation.join_order,
                        team=team_models[participation.team],
                        joined_at=participation.joined_at,
                        left_at=participation.left_at,
                    )
                )
            else:
                participation_model = saved[participation.id]
                participation_model.team = team_models[participation.team]
                participation_model.left_at = participation.left_at
        await self.session.flush()
        return self._to_domain(model)

    async def _find_model(self, room_id: int) -> RoomModel | None:
        result = await self.session.execute(
            select(RoomModel)
            .where(RoomModel.id == room_id)
            .options(
                selectinload(RoomModel.teams),
                selectinload(RoomModel.participations).selectinload(ParticipationModel.team),
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    def _to_domain(cls, model: RoomModel) -> Room:
        return Room(
            id=model.id,
            title=RoomTitle(model.title),
            host_user_id=model.host_user_id,
            last_join_order=model.last_join_order,
            created_at=model.created_at,
            deleted_at=model.deleted_at,
            delete_reason=DeleteReason(model.delete_reason) if model.delete_reason else None,
            teams=[Team(id=t.id, side=TeamSide(t.side)) for t in model.teams],
            participations=[cls._participation_to_domain(p) for p in _current(model)],
        )

    @staticmethod
    def _participation_to_domain(model: ParticipationModel) -> Participation:
        return Participation(
            id=model.id,
            room_id=model.room_id,
            user_id=model.user_id,
            join_order=model.join_order,
            team=TeamSide(model.team.side),
            joined_at=model.joined_at,
            left_at=model.left_at,
        )


class RoomQueryRepository:
    """조회 전용. 결과를 읽기 모델로 돌려준다. auth의 UserModel은 닉네임 조회에만 쓴다(ADR-001).

    방과 이용 기록을 selectinload로 함께 읽고, 인원 계산·검색·페이지 자르기는 파이썬에서 한다.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active_rooms(self, cond: RoomListCondition) -> tuple[list[RoomSummary], int]:
        if cond.sort == "oldest":
            order = (RoomModel.created_at.asc(), RoomModel.id.asc())
        else:
            order = (RoomModel.created_at.desc(), RoomModel.id.desc())
        result = await self.session.execute(
            select(RoomModel)
            .where(RoomModel.deleted_at.is_(None))
            .options(selectinload(RoomModel.participations))
            .order_by(*order)
        )
        rooms = result.scalars().all()

        summaries = []
        for room in rooms:
            current_count = len(_current(room))
            if cond.keyword and cond.keyword.lower() not in room.title.lower():
                continue
            if cond.available_only and current_count >= room.capacity:
                continue
            summaries.append(
                RoomSummary(
                    id=room.id,
                    title=room.title,
                    current_count=current_count,
                    capacity=room.capacity,
                    is_full=current_count >= room.capacity,
                    created_at=room.created_at,
                )
            )
        skip = (cond.page - 1) * cond.size
        return summaries[skip : skip + cond.size], len(summaries)

    async def get_room_detail(self, room_id: int) -> RoomDetail | None:
        """활성 방만 돌려준다. 없거나 삭제된 방은 None (사용자 확인, DB 브리핑 TKT-DB-M3-02).

        my_team·am_i_host는 조회 회원 기준이므로 None·False로 두고 응용 서비스가 채운다.
        """
        result = await self.session.execute(
            select(RoomModel)
            .where(RoomModel.id == room_id)
            .options(selectinload(RoomModel.participations).selectinload(ParticipationModel.team))
        )
        room = result.scalar_one_or_none()
        if room is None or room.deleted_at is not None:
            return None
        participants = []
        for p in sorted(_current(room), key=lambda p: (p.team.side, p.join_order)):
            user = await self.session.get(UserModel, p.user_id)
            participants.append(
                ParticipantView(
                    user_id=p.user_id,
                    nickname=user.nickname,
                    team=TeamSide(p.team.side),
                    is_host=p.user_id == room.host_user_id,
                )
            )
        return RoomDetail(
            id=room.id,
            title=room.title,
            capacity=room.capacity,
            current_count=len(participants),
            is_full=len(participants) >= room.capacity,
            host_user_id=room.host_user_id,
            participants=participants,
            my_team=None,
            am_i_host=False,
            created_at=room.created_at,
        )

    async def list_history(
        self, user_id: int, page: int, size: int
    ) -> tuple[list[HistoryItem], int]:
        result = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id)
            .options(selectinload(ParticipationModel.room))
            .order_by(ParticipationModel.joined_at.desc(), ParticipationModel.id.desc())
        )
        records = result.scalars().all()
        items = [
            HistoryItem(
                participation_id=p.id,
                room_id=p.room_id,
                room_title=p.room.title,
                joined_at=p.joined_at,
                left_at=p.left_at,
                is_current=p.left_at is None,
                room_deleted=p.room.deleted_at is not None,
            )
            for p in records
        ]
        skip = (page - 1) * size
        return items[skip : skip + size], len(items)

    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
        """삭제된 방이고 그 회원의 참가 기록이 있을 때만 돌려준다."""
        room = await self.session.get(RoomModel, room_id)
        if room is None or room.deleted_at is None:
            return None
        result = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.room_id == room_id, ParticipationModel.user_id == user_id)
            .order_by(ParticipationModel.joined_at, ParticipationModel.id)
        )
        records = [MyRecord(joined_at=p.joined_at, left_at=p.left_at) for p in result.scalars()]
        if not records:
            return None
        return ArchivedRoom(
            room_id=room.id,
            title=room.title,
            capacity=room.capacity,
            created_at=room.created_at,
            deleted_at=room.deleted_at,
            my_records=records,
        )
