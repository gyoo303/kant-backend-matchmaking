"""Team 도메인 단위 테스트: INV-01·03, ADR-010."""

from datetime import UTC, datetime, timedelta

import pytest

from rooms.domain.exceptions import ParticipationAlreadyEndedError, TeamFullError
from rooms.domain.participation import Participation, TeamSide
from rooms.domain.team import Team

T0 = datetime(2026, 10, 28, tzinfo=UTC)


def member(user_id: int, side: TeamSide = TeamSide.A) -> Participation:
    return Participation(None, 1, user_id, user_id, side, T0)


def test_inv_01_team_capacity_is_two():
    assert Team.CAPACITY == 2


def test_new_team_has_no_members():
    team = Team(None, TeamSide.B)
    assert (team.count, team.is_full) == (0, False)


def test_add_sets_participation_side_to_team():
    team = Team(None, TeamSide.B)
    participation = member(1, TeamSide.A)
    team.add(participation)
    assert participation.team == TeamSide.B
    assert team.members == [participation]


def test_inv_03_add_rejected_when_full():
    team = Team(None, TeamSide.A)
    team.add(member(1))
    team.add(member(2))
    assert team.is_full
    third = member(3, TeamSide.B)
    with pytest.raises(TeamFullError):
        team.add(third)
    assert team.count == 2
    assert third.team == TeamSide.B


def test_add_rejects_ended_participation():
    team = Team(None, TeamSide.A)
    ended = member(1)
    ended.end(T0 + timedelta(minutes=1))
    with pytest.raises(ParticipationAlreadyEndedError):
        team.add(ended)
    assert team.count == 0


def test_remove_frees_a_seat():
    team = Team(None, TeamSide.A)
    first, second = member(1), member(2)
    team.add(first)
    team.add(second)
    team.remove(first)
    assert (team.members, team.is_full) == ([second], False)
