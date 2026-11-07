# Team 단위 테스트 — 팀 정원 2명 (ADR-010)

from datetime import UTC, datetime

import pytest

from rooms.domain.exceptions import TeamFullError
from rooms.domain.participation import Participation, TeamSide
from rooms.domain.team import Team

T0 = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)


def participant(user_id: int) -> Participation:
    return Participation(
        room_id=1, user_id=user_id, join_order=user_id, team=TeamSide.A, joined_at=T0
    )


def test_add_moves_participation_to_team_side():
    team_b = Team(id=None, side=TeamSide.B)
    p = participant(1)

    team_b.add(p)

    assert p.team == TeamSide.B  # 팀에 들어가면 참가 기록의 팀 값도 바뀐다
    assert team_b.count == 1


def test_team_is_full_at_two():
    team = Team(id=None, side=TeamSide.A)
    team.add(participant(1))
    team.add(participant(2))

    assert team.is_full
    with pytest.raises(TeamFullError):
        team.add(participant(3))


def test_remove_frees_a_seat():
    team = Team(id=None, side=TeamSide.A)
    p = participant(1)
    team.add(p)

    team.remove(p)

    assert team.count == 0
