from dataclasses import replace

from sqlalchemy.ext.asyncio import AsyncSession

from rooms.application.read_models import (
    ArchivedRoom,
    CurrentRoom,
    HistoryPage,
    RoomDetail,
    RoomListCondition,
    RoomPage,
)
from rooms.domain.exceptions import RoomDissolvedError, RoomNotFoundError
from rooms.domain.room import DeleteReason
from rooms.infrastructure.repositories import RoomQueryRepository, RoomRepository


class RoomQueryService:
    """조회 흐름. commit하지 않는다 (04-interfaces-api.md §3, SEQ-10)."""

    def __init__(self, db: AsyncSession) -> None:
        self.queries = RoomQueryRepository(db)
        self.rooms = RoomRepository(db)

    async def list_rooms(self, cond: RoomListCondition) -> RoomPage:
        items, total = await self.queries.list_active_rooms(cond)
        return RoomPage(items=items, total=total, page=cond.page, size=cond.size)

    async def get_room_detail(self, room_id: int, viewer_id: int) -> RoomDetail:
        detail = await self.queries.get_room_detail(room_id)
        if detail is None:
            raise await self._missing_room_error(room_id)
        my_team = next((p.team for p in detail.participants if p.user_id == viewer_id), None)
        return replace(detail, my_team=my_team, am_i_host=detail.host_user_id == viewer_id)

    async def get_current_room(self, user_id: int) -> CurrentRoom | None:
        participation = await self.rooms.find_current_participation(user_id)
        if participation is None or participation.room_id is None:
            return None
        room = await self.rooms.find_by_id(participation.room_id)
        if room is None or not room.is_active:
            return None
        return CurrentRoom(room_id=room.id, title=room.title.value)

    async def list_history(self, user_id: int, page: int, size: int) -> HistoryPage:
        items, total = await self.queries.list_history(user_id, page, size)
        return HistoryPage(items=items, total=total, page=page, size=size)

    async def get_archived_room(self, room_id: int, user_id: int) -> ArchivedRoom:
        archived = await self.queries.get_archived_room(room_id, user_id)
        if archived is None:
            raise RoomNotFoundError()
        return archived

    async def _missing_room_error(self, room_id: int) -> RoomNotFoundError | RoomDissolvedError:
        """활성 상세가 없을 때: 게임 시작으로 해산된 방이면 410, 그 밖에는 404 (D-016)."""
        room = await self.rooms.find_by_id(room_id)
        if room is not None and room.delete_reason == DeleteReason.GAME_STARTED:
            return RoomDissolvedError()
        return RoomNotFoundError()
