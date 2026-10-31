from datetime import datetime

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
from rooms.infrastructure.models import (
    ParticipationLogModel,
    ParticipationModel,
    RoomModel,
    TeamModel,
)


def _current(room_model: RoomModel) -> list[ParticipationModel]:
    """방의 현재 참가(participations에는 현재 참가만 있음)를 입장 순서대로 (ADR-011)."""
    return sorted(room_model.participations, key=lambda p: p.join_order)


class RoomRepository:
    """rooms·teams·participations ↔ Room·Team·Participation.

    끝난 참가는 save 때 participation_logs로 옮긴다 (ADR-011).
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
            .where(ParticipationModel.user_id == user_id)
            .options(selectinload(ParticipationModel.team))
        )
        model = result.scalar_one_or_none()
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
        # 저장된 현재 참가는 (user_id, join_order)로 짝짓는다. 별도 id가 없다 (ADR-011)
        saved = {(p.user_id, p.join_order): p for p in model.participations}
        for participation in room.participations:
            participation_model = saved.get((participation.user_id, participation.join_order))
            team = team_models[participation.team]
            if participation.is_current:
                if participation_model is None:
                    model.participations.append(
                        ParticipationModel(
                            user_id=participation.user_id,
                            join_order=participation.join_order,
                            team=team,
                            joined_at=participation.joined_at,
                        )
                    )
                else:
                    participation_model.team = team
            else:
                # 끝난 참가 → 이용 로그 INSERT, 현재 참가 행은 목록에서 빼서 지운다
                self.session.add(
                    ParticipationLogModel(
                        room=model,
                        user_id=participation.user_id,
                        join_order=participation.join_order,
                        team=team,
                        joined_at=participation.joined_at,
                        left_at=participation.left_at,
                    )
                )
                if participation_model is not None:
                    model.participations.remove(participation_model)
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
            room_id=model.room_id,
            user_id=model.user_id,
            join_order=model.join_order,
            team=TeamSide(model.team.side),
            joined_at=model.joined_at,
        )


class RoomQueryRepository:
    """조회 전용. 결과를 읽기 모델로 돌려준다. auth의 UserModel은 닉네임 조회에만 쓴다(ADR-001).

    방과 현재 참가를 selectinload로 함께 읽고, 인원 계산·검색·페이지 자르기는 파이썬에서 한다.
    이용 이력은 현재 참가(participations) + 이용 로그(participation_logs)다 (ADR-011).
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
        current = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id)
            .options(selectinload(ParticipationModel.room))
        )
        logs = await self.session.execute(
            select(ParticipationLogModel)
            .where(ParticipationLogModel.user_id == user_id)
            .options(selectinload(ParticipationLogModel.room))
            .order_by(ParticipationLogModel.joined_at.desc(), ParticipationLogModel.id.desc())
        )
        items = [_history_item(p, left_at=None) for p in current.scalars()]
        items += [_history_item(log, left_at=log.left_at) for log in logs.scalars()]
        # 입장 시각 최신순. 같으면 현재 참가가 먼저, 로그끼리는 위 정렬(id 큰 것 먼저)을 유지한다
        items.sort(key=lambda item: item.joined_at, reverse=True)
        skip = (page - 1) * size
        return items[skip : skip + size], len(items)

    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
        """삭제된 방이고 그 회원의 참가 기록이 있을 때만 돌려준다."""
        room = await self.session.get(RoomModel, room_id)
        if room is None or room.deleted_at is None:
            return None
        # 삭제된 방에는 현재 참가가 없으므로 이용 로그만 읽는다 (INV-06, ADR-011)
        result = await self.session.execute(
            select(ParticipationLogModel)
            .where(
                ParticipationLogModel.room_id == room_id,
                ParticipationLogModel.user_id == user_id,
            )
            .order_by(ParticipationLogModel.joined_at, ParticipationLogModel.id)
        )
        records = [MyRecord(joined_at=r.joined_at, left_at=r.left_at) for r in result.scalars()]
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


def _history_item(
    record: ParticipationModel | ParticipationLogModel, left_at: datetime | None
) -> HistoryItem:
    """현재 참가(left_at 없음)나 이용 로그 한 건을 이력 항목으로."""
    return HistoryItem(
        room_id=record.room_id,
        room_title=record.room.title,
        joined_at=record.joined_at,
        left_at=left_at,
        is_current=left_at is None,
        room_deleted=record.room.deleted_at is not None,
    )
