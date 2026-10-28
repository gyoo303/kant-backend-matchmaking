"""User·TokenBlacklist 도메인 단위 테스트 (Q-04, D-011, INV-14)."""

from datetime import UTC, datetime, timedelta

import pytest

from auth.domain.exceptions import InvalidLoginIdError, InvalidNicknameError, InvalidPasswordError
from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User


def test_register_trims_nickname():
    user = User.register("player01", " 용감한고양이 ", "hashed")
    assert user.nickname == "용감한고양이"
    assert user.id is None


@pytest.mark.parametrize("login_id", ["abc", "PLAYER01", "a" * 21, "ab_cd", "한글아이디"])
def test_register_rejects_invalid_login_id(login_id):
    with pytest.raises(InvalidLoginIdError):
        User.register(login_id, "닉네임", "hashed")


@pytest.mark.parametrize("login_id", ["abcd", "a" * 20, "user2026"])
def test_register_accepts_login_id_boundaries(login_id):
    assert User.register(login_id, "닉네임", "hashed").login_id == login_id


@pytest.mark.parametrize("nickname", ["가", "가" * 13, "닉네임!", "닉 네임", "  "])
def test_register_rejects_invalid_nickname(nickname):
    with pytest.raises(InvalidNicknameError):
        User.register("player01", nickname, "hashed")


@pytest.mark.parametrize("nickname", ["가나", "가" * 12, "Cat42"])
def test_register_accepts_nickname_boundaries(nickname):
    assert User.register("player01", nickname, "hashed").nickname == nickname


def test_raw_password_minimum_length():
    with pytest.raises(InvalidPasswordError):
        User.validate_raw_password("1234567")
    User.validate_raw_password("12345678")


def test_inv_14_blacklist_expiry():
    now = datetime(2026, 10, 28, tzinfo=UTC)
    entry = TokenBlacklist("jti-1", now)
    assert entry.is_expired(now)
    assert not entry.is_expired(now - timedelta(seconds=1))


def test_blacklist_requires_jti():
    with pytest.raises(ValueError):
        TokenBlacklist("", datetime(2026, 10, 28, tzinfo=UTC))
