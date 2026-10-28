from collections.abc import Callable
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from rooms.application.read_models import GameStartResult, LeaveResult
from rooms.domain.exceptions import RoomNotFoundError
from rooms.domain.room import Room, TeamSide
from rooms.infrastructure.repositories import RoomRepository


class ListCacheInvalidator(Protocol):
    """목록 캐시(도전 C, ADR-007)가 구현할 무효화 계약."""

    def clear(self) -> None: ...


def _utc_now() -> datetime:
    return datetime.now(UTC)


class RoomApplicationService:
    """방을 바꾸는 흐름: 조회 → 도메인 행위 → 저장 → commit (SEQ-05~09).

    필수 범위는 잠금 없이 find_by_id로 읽는다. 동시 요청 보호는 도전 A(ADR-009)에서 추가한다.
    """

    def __init__(
        self,
        db: AsyncSession,
        clock: Callable[[], datetime] = _utc_now,
        list_cache: ListCacheInvalidator | None = None,
    ) -> None:
        self.db = db
        self.clock = clock
        self.list_cache = list_cache
        self.rooms = RoomRepository(db)

    async def create_room(self, user_id: int, title: str) -> Room:
        current = await self.rooms.find_current_participation(user_id)
        room = Room.create(title, user_id, current, self.clock())
        saved = await self.rooms.save(room)
        await self._commit()
        return saved

    async def join_room(self, room_id: int, user_id: int) -> Room:
        current = await self.rooms.find_current_participation(user_id)
        room = await self._get_room(room_id)
        room.join(user_id, current, self.clock())
        saved = await self.rooms.save(room)
        await self._commit()
        return saved

    async def rename_room(self, room_id: int, user_id: int, title: str) -> Room:
        room = await self._get_room(room_id)
        room.rename(user_id, title)
        saved = await self.rooms.save(room)
        await self._commit()
        return saved

    async def change_team(self, room_id: int, user_id: int, team: TeamSide) -> Room:
        room = await self._get_room(room_id)
        room.change_team(user_id, team)
        saved = await self.rooms.save(room)
        await self._commit()
        return saved

    async def leave_room(self, room_id: int, user_id: int) -> LeaveResult:
        room = await self._get_room(room_id)
        previous_host = room.host_user_id
        room.leave(user_id, self.clock())
        await self.rooms.save(room)
        await self._commit()
        host_changed = room.is_active and room.host_user_id != previous_host
        return LeaveResult(
            room_deleted=not room.is_active,
            new_host_user_id=room.host_user_id if host_changed else None,
        )

    async def start_game(self, room_id: int, user_id: int) -> GameStartResult:
        room = await self._get_room(room_id)
        now = self.clock()
        room.start_game(user_id, now)
        await self.rooms.save(room)
        await self._commit()
        return GameStartResult(room_id=room_id, dissolved_at=now)

    async def _get_room(self, room_id: int) -> Room:
        room = await self.rooms.find_by_id(room_id)
        if room is None:
            raise RoomNotFoundError()
        return room

    async def _commit(self) -> None:
        await self.db.commit()
        if self.list_cache is not None:
            self.list_cache.clear()
