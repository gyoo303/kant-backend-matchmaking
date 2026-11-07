# Room 단위 테스트 — aggregate 루트의 불변 규칙과 상태 전이 (06-quality-gates.md §2 순위 1·2)
#
# [핵심 개념] aggregate 테스트는 "루트 메서드만" 부른다
#   - Team.add, Participation.end를 직접 부르지 않고 room.join/leave/start_game만 쓴다
#   - 그래야 "규칙은 Room을 통해서만 바뀐다"는 설계를 테스트도 따른다

from datetime import UTC, datetime, timedelta

import pytest

from rooms.domain.exceptions import (
    AlreadyParticipatingError,
    InvalidRoomTitleError,
    InvalidTeamCompositionError,
    NotHostError,
    NotParticipantError,
    RoomDeletedError,
    RoomFullError,
    TeamFullError,
)
from rooms.domain.room import DeleteReason, Room, TeamSide

T0 = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)
# 모든 참가(T0+분)보다 늦은 시각 — 퇴장 시각은 입장 시각보다 이를 수 없다
LATER = T0 + timedelta(hours=1)
HOST = 1


def room_with(*user_ids: int) -> Room:
    """방장(HOST)이 만든 방에 user_ids가 차례로 참가한 방. id는 저장된 것처럼 1로 둔다"""
    room = Room.create("즐겜 방", HOST, None, T0)
    room.id = 1
    for i, user_id in enumerate(user_ids, start=1):
        room.join(user_id, None, T0 + timedelta(minutes=i))
    return room


def side_of(room: Room, user_id: int) -> TeamSide:
    return room.participation_of(user_id).team


# ------------------------------------------------------------------ 생성 (AC-01)


def test_create_trims_title_and_puts_creator_in_team_a():
    room = Room.create("  즐겜 방  ", HOST, None, T0)

    assert room.title.value == "즐겜 방"
    assert room.host_user_id == HOST
    assert room.current_count == 1
    assert side_of(room, HOST) == TeamSide.A


@pytest.mark.parametrize("title", ["   ", "가" * 21])
def test_create_rejects_invalid_title(title):
    with pytest.raises(InvalidRoomTitleError):
        Room.create(title, HOST, None, T0)


def test_create_rejects_member_already_in_a_room():
    current = room_with().participation_of(HOST)

    with pytest.raises(AlreadyParticipatingError):
        Room.create("새 방", HOST, current, T0)


# ------------------------------------------------------------------ 참가 (AC-02)


def test_join_fills_team_a_first_then_b():
    room = room_with(2, 3)

    assert side_of(room, 2) == TeamSide.A  # A팀 2명째
    assert side_of(room, 3) == TeamSide.B  # A팀이 차서 B팀
    assert room.participation_of(3).join_order == 3


def test_join_rejected_when_full():
    room = room_with(2, 3, 4)

    with pytest.raises(RoomFullError):
        room.join(5, None, T0)


def test_join_same_room_again_changes_nothing():
    room = room_with(2)
    current = room.participation_of(2)

    returned = room.join(2, current, T0)

    assert returned is current
    assert room.current_count == 2


def test_join_after_team_move_fills_empty_seat_in_a():
    # AC-02-9: A팀 1명·B팀 2명이면 새 참가자는 A팀
    room = room_with(2, 3)  # A: 1,2 / B: 3
    room.change_team(2, TeamSide.B)  # A: 1 / B: 3,2

    room.join(4, None, T0)

    assert side_of(room, 4) == TeamSide.A


# ------------------------------------------------------------------ 제목·팀 (AC-03, AC-04)


def test_only_host_can_rename():
    room = room_with(2)

    with pytest.raises(NotHostError):
        room.rename(2, "새 제목")
    room.rename(HOST, "새 제목")

    assert room.title.value == "새 제목"


def test_change_team_rejected_when_target_full():
    room = room_with(2, 3, 4)  # A: 1,2 / B: 3,4

    with pytest.raises(TeamFullError):
        room.change_team(HOST, TeamSide.B)
    assert side_of(room, HOST) == TeamSide.A


def test_non_participant_cannot_change_team():
    with pytest.raises(NotParticipantError):
        room_with().change_team(99, TeamSide.B)


# ------------------------------------------------------------------ 나가기 (AC-05)


def test_host_leaving_passes_host_to_earliest_member():
    room = room_with(2, 3)

    room.leave(HOST, LATER)

    assert room.host_user_id == 2  # 남은 사람 중 입장 순서가 가장 빠름
    assert room.is_active


def test_last_member_leaving_soft_deletes_room():
    room = room_with()

    room.leave(HOST, LATER)

    assert not room.is_active
    assert room.delete_reason == DeleteReason.EMPTY
    assert room.deleted_at == LATER
    assert len(room.participations) == 1  # 기록은 지우지 않는다


# ------------------------------------------------------------------ 게임 시작 (AC-06)


def test_start_game_dissolves_room_and_ends_everyone():
    room = room_with(2, 3, 4)  # A 2명, B 2명

    room.start_game(HOST, LATER)

    assert room.delete_reason == DeleteReason.GAME_STARTED
    assert room.current_count == 0
    assert all(p.left_at is not None for p in room.participations)


def test_start_game_requires_two_per_team():
    room = room_with(2, 3)  # 3명

    with pytest.raises(InvalidTeamCompositionError):
        room.start_game(HOST, LATER)
    assert room.is_active


def test_only_host_can_start_game():
    with pytest.raises(NotHostError):
        room_with(2, 3, 4).start_game(2, LATER)


def test_deleted_room_rejects_every_action_first():
    # 거부 순서: 삭제된 방이면 다른 검사보다 RoomDeletedError가 먼저 (04 §2.3)
    room = room_with(2, 3, 4)
    room.start_game(HOST, LATER)

    for action in (
        lambda: room.join(5, None, LATER),
        lambda: room.rename(99, "x"),  # 방장이 아니어도 '삭제됨'이 먼저
        lambda: room.change_team(HOST, TeamSide.B),
        lambda: room.leave(HOST, LATER),
        lambda: room.start_game(HOST, LATER),
    ):
        with pytest.raises(RoomDeletedError):
            action()
