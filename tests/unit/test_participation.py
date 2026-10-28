"""Participation 도메인 단위 테스트: INV-10·11."""

from datetime import UTC, datetime, timedelta

import pytest

from rooms.domain.exceptions import ParticipationAlreadyEndedError
from rooms.domain.participation import Participation, TeamSide

T0 = datetime(2026, 10, 28, tzinfo=UTC)


def make(joined_minutes: int = 0) -> Participation:
    return Participation(1, 1, 1, 1, TeamSide.A, T0 + timedelta(minutes=joined_minutes))


def test_new_participation_is_current():
    assert make().is_current


def test_inv_10_end_records_left_at():
    participation = make()
    participation.end(T0 + timedelta(minutes=5))
    assert not participation.is_current
    assert participation.left_at == T0 + timedelta(minutes=5)


def test_inv_10_end_before_join_rejected():
    with pytest.raises(ValueError):
        make(joined_minutes=5).end(T0)


def test_inv_10_ended_record_cannot_end_again():
    participation = make()
    participation.end(T0 + timedelta(minutes=1))
    with pytest.raises(ParticipationAlreadyEndedError):
        participation.end(T0 + timedelta(minutes=2))


def test_inv_10_ended_record_cannot_change_team():
    participation = make()
    participation.end(T0 + timedelta(minutes=1))
    with pytest.raises(ParticipationAlreadyEndedError):
        participation.change_team(TeamSide.B)


def test_inv_11_join_order_must_be_positive():
    with pytest.raises(ValueError):
        Participation(1, 1, 1, 0, TeamSide.A, T0)


def test_inv_10_constructor_rejects_left_before_joined():
    with pytest.raises(ValueError):
        Participation(1, 1, 1, 1, TeamSide.A, T0, left_at=T0 - timedelta(minutes=1))
