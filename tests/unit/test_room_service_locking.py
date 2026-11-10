# 응용 서비스가 "잠그며 읽기"를 올바른 순서로 쓰는지 확인 (ADR-013, CONV-08)
# 진짜 잠금(동시 요청)은 DB가 있어야 하므로 통합 테스트(test_concurrency.py)에서 본다.
# 여기서는 가짜 저장소가 남긴 기록(locked_room_ids)으로 "어느 메서드가 잠금 조회를 썼는지"만 본다.
from datetime import UTC, datetime

import pytest

from rooms.application.service import RoomApplicationService
from rooms.domain.exceptions import RoomFullError
from rooms.domain.participation import TeamSide
from unit.fakes.repositories import FakeRoomRepository

NOW = datetime(2026, 11, 10, tzinfo=UTC)


async def make_service_with_room(member_ids: list[int]) -> tuple[RoomApplicationService, int]:
    """member_ids[0]이 방장인 방을 만들고 나머지를 순서대로 참가시킨다"""
    repo = FakeRoomRepository()
    service = RoomApplicationService(rooms=repo, clock=lambda: NOW)
    room = await service.create_room(member_ids[0], "테스트 방")
    for user_id in member_ids[1:]:
        await service.join_room(room.id, user_id)
    repo.locked_room_ids.clear()  # 준비 단계 기록은 지운다
    return service, room.id


async def test_join_locks_room():
    service, room_id = await make_service_with_room([1])
    await service.join_room(room_id, 2)
    assert service.rooms.locked_room_ids == [room_id]


async def test_join_full_room_is_rejected_before_locking():
    # 빠른 거절(AD-05): 이미 찬 방이면 잠금 조회까지 가지 않는다
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    with pytest.raises(RoomFullError):
        await service.join_room(room_id, 5)
    assert service.rooms.locked_room_ids == []


async def test_rejoin_same_full_room_is_no_change():
    # 이미 이 방에 있는 회원의 재요청은 꽉 찬 방이어도 "변화 없음"(D-006) — 빠른 거절 대상 아님
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    room = await service.join_room(room_id, 4)
    assert room.current_count == 4


async def test_every_write_operation_locks_room():
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    # A팀(1·2), B팀(3·4) — 2가 나가 A팀에 자리가 생기면 3이 A팀으로 옮긴다
    await service.rename_room(room_id, 1, "새 제목")
    await service.leave_room(room_id, 2)
    await service.change_team(room_id, 3, TeamSide.A)
    assert service.rooms.locked_room_ids == [room_id, room_id, room_id]