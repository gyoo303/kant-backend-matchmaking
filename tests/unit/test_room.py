"""Room 도메인 단위 테스트: INV-01~09·11·12, 상태 머신, 팀 배정(D-024).

근거: 04-interfaces-api.md §2.3·§10
"""

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
from rooms.domain.participation import Participation
from rooms.domain.room import DeleteReason, Room, RoomTitle, Team, TeamSide

T0 = datetime(2026, 10, 28, tzinfo=UTC)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


def make_room(member_ids: list[int], room_id: int = 10) -> Room:
    """첫 회원이 만들고 나머지가 차례로 참가한 방. 팀은 자동 배정(A, A, B, B)."""
    room = Room.create("방", member_ids[0], None, T0)
    room.id = room_id
    for participation in room.participations:
        participation.room_id = room_id
    for offset, user_id in enumerate(member_ids[1:], start=1):
        room.join(user_id, None, at(offset))
    return room


def other_room_participation(user_id: int) -> Participation:
    return Participation(99, user_id, 1, TeamSide.A, T0)


def two_teams() -> list[Team]:
    return [Team(1, TeamSide.A), Team(2, TeamSide.B)]


# --- RoomTitle (INV-12) ---


def test_inv_12_title_is_trimmed():
    assert RoomTitle.of("  즐겜 방  ").value == "즐겜 방"


@pytest.mark.parametrize("raw", ["", "   ", "가" * 21])
def test_inv_12_title_out_of_range_rejected(raw):
    with pytest.raises(InvalidRoomTitleError):
        RoomTitle.of(raw)


def test_inv_12_title_twenty_chars_allowed():
    assert RoomTitle.of("가" * 20).value == "가" * 20


def test_inv_12_title_constructor_rejects_untrimmed_value():
    with pytest.raises(InvalidRoomTitleError):
        RoomTitle(" 방")


# --- 생성 (INV-01·04·05) ---


def test_inv_01_capacity_is_fixed():
    assert Room.CAPACITY == 4
    assert Team.CAPACITY == 2


def test_create_makes_team_a_and_b():
    room = Room.create("방", 1, None, T0)
    assert sorted(room.teams) == [TeamSide.A, TeamSide.B]
    assert (room.team(TeamSide.A).count, room.team(TeamSide.B).count) == (1, 0)


def test_create_makes_creator_host_and_first_participant():
    room = Room.create(" 방 ", 1, None, T0)
    creator = room.participations[0]
    assert room.host_user_id == 1
    assert room.is_active
    assert (creator.user_id, creator.join_order, creator.team) == (1, 1, TeamSide.A)
    assert room.last_join_order == 1


def test_inv_04_create_rejected_when_already_participating():
    with pytest.raises(AlreadyParticipatingError):
        Room.create("방", 1, other_room_participation(1), T0)


# --- 참가 (INV-02·03·04·11, Q-03, D-006) ---


def test_d_024_join_fills_team_a_first():
    room = make_room([1, 2, 3, 4])
    teams = [p.team for p in room.current_participants]
    assert teams == [TeamSide.A, TeamSide.A, TeamSide.B, TeamSide.B]


def test_d_024_join_goes_to_b_when_a_is_full():
    room = make_room([1, 2])
    participation = room.join(3, None, at(10))
    assert participation.team == TeamSide.B


def test_d_024_join_goes_to_a_when_a_has_space_after_move():
    """A1·B2(팀 이동으로 A팀에 빈자리) → 새 참가자는 A팀 (AC-02-9)."""
    room = make_room([1, 2, 3])
    room.change_team(2, TeamSide.B)
    participation = room.join(4, None, at(10))
    assert participation.team == TeamSide.A
    assert (room.team(TeamSide.A).count, room.team(TeamSide.B).count) == (2, 2)


def test_inv_02_join_rejected_when_full():
    room = make_room([1, 2, 3, 4])
    assert room.is_full
    with pytest.raises(RoomFullError):
        room.join(5, None, at(10))
    assert room.current_count == 4


def test_inv_04_join_rejected_when_in_other_room():
    room = make_room([1])
    with pytest.raises(AlreadyParticipatingError):
        room.join(5, other_room_participation(5), at(1))


def test_join_same_room_again_returns_existing_record():
    room = make_room([1, 2])
    existing = room.participation_of(2)
    assert room.join(2, existing, at(5)) is existing
    assert room.current_count == 2


def test_inv_11_rejoin_gets_new_join_order():
    room = make_room([1, 2])
    room.leave(2, at(5))
    again = room.join(2, None, at(6))
    assert again.join_order == 3
    assert len([p for p in room.participations if p.user_id == 2]) == 2


# --- 팀 변경 (INV-03, Q-02) ---


def test_inv_03_change_team_rejected_when_target_full():
    room = make_room([1, 2, 3, 4])
    with pytest.raises(TeamFullError):
        room.change_team(1, TeamSide.B)


def test_change_team_moves_own_team():
    room = make_room([1, 2])
    room.change_team(1, TeamSide.B)
    assert room.participation_of(1).team == TeamSide.B
    assert (room.team(TeamSide.A).count, room.team(TeamSide.B).count) == (1, 1)


def test_change_team_same_team_is_noop():
    room = make_room([1, 2])
    room.change_team(1, TeamSide.A)
    assert room.participation_of(1).team == TeamSide.A


def test_change_team_rejected_for_non_participant():
    room = make_room([1])
    with pytest.raises(NotParticipantError):
        room.change_team(9, TeamSide.B)


# --- 제목 변경 ---


def test_rename_by_host():
    room = make_room([1, 2])
    room.rename(1, " 새 제목 ")
    assert room.title.value == "새 제목"


def test_rename_rejected_for_non_host():
    room = make_room([1, 2])
    with pytest.raises(NotHostError):
        room.rename(2, "새 제목")


# --- 나가기 (INV-05·06·07, REQ-043·044) ---


def test_leave_non_host_keeps_host():
    room = make_room([1, 2, 3])
    room.leave(2, at(5))
    assert room.host_user_id == 1
    assert room.current_count == 2


def test_inv_05_host_leave_delegates_to_earliest_joined():
    room = make_room([1, 2, 3])
    room.leave(1, at(5))
    assert room.host_user_id == 2


def test_inv_07_last_leave_soft_deletes_as_empty():
    room = make_room([1])
    room.leave(1, at(5))
    assert not room.is_active
    assert room.delete_reason == DeleteReason.EMPTY
    assert room.deleted_at == at(5)
    assert room.current_count == 0


def test_leave_rejected_for_non_participant():
    room = make_room([1])
    with pytest.raises(NotParticipantError):
        room.leave(9, at(1))


# --- 게임 시작 (INV-06·08·09) ---


def test_inv_08_start_game_dissolves_room():
    room = make_room([1, 2, 3, 4])
    room.start_game(1, at(10))
    assert room.delete_reason == DeleteReason.GAME_STARTED
    assert room.current_count == 0
    assert all(p.left_at == at(10) for p in room.participations)


def test_inv_08_start_game_rejected_for_non_host():
    room = make_room([1, 2, 3, 4])
    with pytest.raises(NotHostError):
        room.start_game(2, at(10))
    assert room.is_active


@pytest.mark.parametrize("members", [[1, 2, 3], [1]])
def test_inv_08_start_game_rejected_without_two_per_team(members):
    room = make_room(members)
    with pytest.raises(InvalidTeamCompositionError):
        room.start_game(1, at(10))


def test_inv_03_three_to_one_composition_cannot_be_built():
    """AC-06-4의 'A팀 3명·B팀 1명'은 팀당 정원 2명(INV-03) 때문에 만들 수 없다."""
    room = make_room([1, 2, 3, 4])
    with pytest.raises(TeamFullError):
        room.change_team(3, TeamSide.A)
    assert room.participation_of(3).team == TeamSide.B
    assert (room.team(TeamSide.A).count, room.team(TeamSide.B).count) == (2, 2)


# --- 삭제된 방 (INV-06) ---


@pytest.mark.parametrize(
    "action",
    [
        lambda r: r.rename(1, "x"),
        lambda r: r.join(5, None, at(20)),
        lambda r: r.change_team(1, TeamSide.B),
        lambda r: r.leave(1, at(20)),
        lambda r: r.start_game(1, at(20)),
    ],
)
def test_inv_06_deleted_room_rejects_every_action(action):
    room = make_room([1, 2, 3, 4])
    room.start_game(1, at(10))
    with pytest.raises(RoomDeletedError):
        action(room)


# --- 생성자 검증 (INV-07·11) ---


def test_inv_07_constructor_requires_both_or_neither_delete_fields():
    with pytest.raises(ValueError):
        Room(1, RoomTitle("방"), 1, 0, T0, T0, None, two_teams(), [])


def test_constructor_rejects_negative_last_join_order():
    with pytest.raises(ValueError):
        Room(1, RoomTitle("방"), 1, -1, T0, None, None, two_teams(), [])


@pytest.mark.parametrize(
    "teams",
    [[], [Team(1, TeamSide.A)], [Team(1, TeamSide.A), Team(2, TeamSide.A)]],
)
def test_constructor_requires_team_a_and_b(teams):
    with pytest.raises(ValueError):
        Room(1, RoomTitle("방"), 1, 0, T0, None, None, teams, [])


def test_constructor_fills_team_members_from_current_participations():
    """레포지토리가 팀원 없이 넘겨도 현재 참가 기록으로 팀원이 채워진다 (RISK-13)."""
    current = Participation(1, 7, 1, TeamSide.B, T0)
    ended = Participation(1, 8, 2, TeamSide.A, T0, left_at=at(5))
    room = Room(1, RoomTitle("방"), 7, 2, T0, None, None, two_teams(), [current, ended])
    assert room.team(TeamSide.B).members == [current]
    assert room.team(TeamSide.A).members == []
