from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from rooms.infrastructure.models import ParticipationModel, RoomModel


def _escape_like(keyword: str) -> str:
    """ILIKE 패턴용 이스케이프: \\, %, _ 앞에 \\를 붙인다 (ARCH-Q-07, STK-05)."""
    return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class RoomRepository:
    """rooms·participations ↔ Room·Participation. flush만 하고 commit은 응용 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_id(self, room_id: int) -> Room | None:
        room_model = await self.session.get(RoomModel, room_id)
        if room_model is None:
            return None
        return self._to_domain(room_model, await self._current_participations(room_id))

    async def find_current_participation(self, user_id: int) -> Participation | None:
        result = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.user_id == user_id, ParticipationModel.left_at.is_(None))
            .order_by(ParticipationModel.joined_at.desc(), ParticipationModel.id.desc())
        )
        model = result.scalars().first()
        return self._participation_to_domain(model) if model else None

    async def save(self, room: Room) -> Room:
        room_model = await self._upsert_room(room)
        participation_models: list[ParticipationModel] = []
        for participation in room.participations:
            participation_models.append(
                await self._upsert_participation(room_model.id, participation)
            )
        await self.session.flush()
        return self._to_domain(room_model, participation_models)

    async def _current_participations(self, room_id: int) -> list[ParticipationModel]:
        result = await self.session.execute(
            select(ParticipationModel)
            .where(ParticipationModel.room_id == room_id, ParticipationModel.left_at.is_(None))
            .order_by(ParticipationModel.join_order)
        )
        return list(result.scalars().all())

    async def _upsert_room(self, room: Room) -> RoomModel:
        if room.id is None:
            model = RoomModel()
            self.session.add(model)
        else:
            model = await self.session.get(RoomModel, room.id)
            if model is None:
                raise ValueError(f"저장할 방이 없습니다: id={room.id}")
        model.title = room.title.value
        model.capacity = Room.CAPACITY
        model.host_user_id = room.host_user_id
        model.last_join_order = room.last_join_order
        model.created_at = room.created_at
        model.deleted_at = room.deleted_at
        model.delete_reason = room.delete_reason.value if room.delete_reason else None
        await self.session.flush()
        return model

    async def _upsert_participation(
        self, room_id: int, participation: Participation
    ) -> ParticipationModel:
        if participation.id is None:
            model = ParticipationModel(
                room_id=room_id,
                user_id=participation.user_id,
                join_order=participation.join_order,
                joined_at=participation.joined_at,
            )
            self.session.add(model)
        else:
            model = await self.session.get(ParticipationModel, participation.id)
            if model is None:
                raise ValueError(f"저장할 참가 기록이 없습니다: id={participation.id}")
        model.team = participation.team.value
        model.left_at = participation.left_at
        return model

    @classmethod
    def _to_domain(
        cls, room_model: RoomModel, participation_models: list[ParticipationModel]
    ) -> Room:
        return Room(
            id=room_model.id,
            title=RoomTitle(room_model.title),
            host_user_id=room_model.host_user_id,
            last_join_order=room_model.last_join_order,
            created_at=room_model.created_at,
            deleted_at=room_model.deleted_at,
            delete_reason=DeleteReason(room_model.delete_reason)
            if room_model.delete_reason
            else None,
            participations=[cls._participation_to_domain(p) for p in participation_models],
        )

    @staticmethod
    def _participation_to_domain(model: ParticipationModel) -> Participation:
        return Participation(
            id=model.id,
            room_id=model.room_id,
            user_id=model.user_id,
            join_order=model.join_order,
            team=TeamSide(model.team),
            joined_at=model.joined_at,
            left_at=model.left_at,
        )


class RoomQueryRepository:
    """조회 전용. 결과를 읽기 모델로 돌려준다. auth의 UserModel은 닉네임 조인에만 쓴다(ADR-001)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active_rooms(self, cond: RoomListCondition) -> tuple[list[RoomSummary], int]:
        counts = (
            select(ParticipationModel.room_id, func.count().label("current_count"))
            .where(ParticipationModel.left_at.is_(None))
            .group_by(ParticipationModel.room_id)
            .subquery()
        )
        current_count = func.coalesce(counts.c.current_count, 0)
        stmt: Select = (
            select(
                RoomModel.id,
                RoomModel.title,
                current_count.label("current_count"),
                RoomModel.capacity,
                (current_count >= RoomModel.capacity).label("is_full"),
                RoomModel.created_at,
            )
            .outerjoin(counts, counts.c.room_id == RoomModel.id)
            .where(RoomModel.deleted_at.is_(None))
        )
        if cond.keyword:
            pattern = f"%{_escape_like(cond.keyword)}%"
            stmt = stmt.where(RoomModel.title.ilike(pattern, escape="\\"))
        if cond.available_only:
            stmt = stmt.where(current_count < RoomModel.capacity)

        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery()))

        if cond.sort == "oldest":
            stmt = stmt.order_by(RoomModel.created_at.asc(), RoomModel.id.asc())
        else:
            stmt = stmt.order_by(RoomModel.created_at.desc(), RoomModel.id.desc())
        stmt = stmt.limit(cond.size).offset((cond.page - 1) * cond.size)

        rows = (await self.session.execute(stmt)).all()
        items = [
            RoomSummary(
                id=row.id,
                title=row.title,
                current_count=row.current_count,
                capacity=row.capacity,
                is_full=row.is_full,
                created_at=row.created_at,
            )
            for row in rows
        ]
        return items, total or 0

    async def get_room_detail(self, room_id: int) -> RoomDetail | None:
        """활성 방만 돌려준다. 없거나 삭제된 방은 None (사용자 확인, DB 브리핑 TKT-DB-M3-02).

        my_team·am_i_host는 조회 회원 기준이므로 None·False로 두고 응용 서비스가 채운다.
        """
        room = await self.session.get(RoomModel, room_id)
        if room is None or room.deleted_at is not None:
            return None
        result = await self.session.execute(
            select(ParticipationModel.user_id, UserModel.nickname, ParticipationModel.team)
            .join(UserModel, UserModel.id == ParticipationModel.user_id)
            .where(ParticipationModel.room_id == room_id, ParticipationModel.left_at.is_(None))
            .order_by(ParticipationModel.team, ParticipationModel.join_order)
        )
        participants = [
            ParticipantView(
                user_id=row.user_id,
                nickname=row.nickname,
                team=TeamSide(row.team),
                is_host=row.user_id == room.host_user_id,
            )
            for row in result.all()
        ]
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
        base = (
            select(
                ParticipationModel.id.label("participation_id"),
                ParticipationModel.room_id,
                RoomModel.title.label("room_title"),
                ParticipationModel.joined_at,
                ParticipationModel.left_at,
                RoomModel.deleted_at,
            )
            .join(RoomModel, RoomModel.id == ParticipationModel.room_id)
            .where(ParticipationModel.user_id == user_id)
        )
        total = await self.session.scalar(select(func.count()).select_from(base.subquery()))
        rows = (
            await self.session.execute(
                base.order_by(ParticipationModel.joined_at.desc(), ParticipationModel.id.desc())
                .limit(size)
                .offset((page - 1) * size)
            )
        ).all()
        items = [
            HistoryItem(
                participation_id=row.participation_id,
                room_id=row.room_id,
                room_title=row.room_title,
                joined_at=row.joined_at,
                left_at=row.left_at,
                is_current=row.left_at is None,
                room_deleted=row.deleted_at is not None,
            )
            for row in rows
        ]
        return items, total or 0

    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom | None:
        """삭제된 방이고 그 회원의 참가 기록이 있을 때만 돌려준다."""
        room = await self.session.get(RoomModel, room_id)
        if room is None or room.deleted_at is None:
            return None
        result = await self.session.execute(
            select(ParticipationModel.joined_at, ParticipationModel.left_at)
            .where(ParticipationModel.room_id == room_id, ParticipationModel.user_id == user_id)
            .order_by(ParticipationModel.joined_at, ParticipationModel.id)
        )
        records = [MyRecord(joined_at=row.joined_at, left_at=row.left_at) for row in result.all()]
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
