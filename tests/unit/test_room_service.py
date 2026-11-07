# RoomApplicationService 단위 테스트 — 가짜 저장소 + 고정 시계

from datetime import UTC, datetime

import pytest

from rooms.application.service import RoomApplicationService
from rooms.domain.exceptions import AlreadyParticipatingError, RoomNotFoundError
from rooms.domain.room import DeleteReason
from tests.unit.fakes.repositories import FakeRoomRepository

FIXED_NOW = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)


@pytest.fixture
def service() -> RoomApplicationService:
    # clock도 주입: 항상 같은 시각 → 결과를 정확한 값으로 비교할 수 있다
    return RoomApplicationService(rooms=FakeRoomRepository(), clock=lambda: FIXED_NOW)


async def test_create_room_saves_with_id(service):
    room = await service.create_room(user_id=1, title="2대2 한판")

    assert room.id is not None
    assert room.host_user_id == 1


async def test_one_user_one_room(service):
    await service.create_room(user_id=1, title="첫 번째 방")

    with pytest.raises(AlreadyParticipatingError):
        await service.create_room(user_id=1, title="두 번째 방")


async def test_last_member_leaving_deletes_room(service):
    room = await service.create_room(user_id=1, title="2대2 한판")

    result = await service.leave_room(room.id, user_id=1)

    assert result.room_deleted
    assert room.delete_reason == DeleteReason.EMPTY
    assert room.deleted_at == FIXED_NOW


async def test_unknown_room_is_not_found(service):
    with pytest.raises(RoomNotFoundError):
        await service.join_room(room_id=999, user_id=1)