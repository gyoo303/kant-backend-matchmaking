# Participation 단위 테스트 — 참가 기록의 생성·종료 규칙

from datetime import UTC, datetime, timedelta

import pytest

from rooms.domain.exceptions import ParticipationAlreadyEndedError
from rooms.domain.participation import Participation, TeamSide

T0 = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)  # 시각은 고정값을 인자로 넣는다 (금지 패턴 11)


def make(join_order: int = 1, team: TeamSide = TeamSide.A) -> Participation:
    return Participation(room_id=1, user_id=10, join_order=join_order, team=team, joined_at=T0)


def test_new_participation_is_current():
    assert make().is_current


def test_end_records_left_at():
    p = make()

    p.end(T0 + timedelta(minutes=5))

    assert not p.is_current
    assert p.left_at == T0 + timedelta(minutes=5)


def test_cannot_end_twice():
    p = make()
    p.end(T0)

    with pytest.raises(ParticipationAlreadyEndedError):
        p.end(T0)


def test_cannot_change_team_after_end():
    p = make()
    p.end(T0)

    with pytest.raises(ParticipationAlreadyEndedError):
        p.change_team(TeamSide.B)


def test_left_at_cannot_be_before_joined_at():
    with pytest.raises(ValueError):
        make().end(T0 - timedelta(seconds=1))


def test_join_order_starts_from_one():
    with pytest.raises(ValueError):
        make(join_order=0)
