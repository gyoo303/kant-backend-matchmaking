# User, TokenBlacklist 단위 테스트 — DB·mock 없음
#
# [핵심 개념] 도메인 테스트는 "규칙"만 본다
#   - 객체를 직접 만들고 메서드를 부른다. 저장소·서비스·HTTP가 끼지 않는다
#   - 그래서 가장 빠르고, 실패하면 원인이 도메인 규칙 하나로 좁혀진다
#   - 도메인 테스트에 mock이 필요해지면 설계를 의심한다 (06-quality-gates.md §2)

import pytest

from auth.domain.exceptions import (
    InvalidLoginIdError,
    InvalidNicknameError,
    InvalidPasswordError,
)
from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User

HASH = "$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhashdumm"


def test_register_trims_nickname_and_has_no_id():
    user = User.register("player01", "  용감한고양이  ", HASH)

    assert user.id is None  # id는 저장소가 채운다
    assert user.nickname == "용감한고양이"
    assert user.hashed_password == HASH


# pytest.mark.parametrize: 같은 검사를 입력만 바꿔 여러 번 실행한다 (AC-08-2)
@pytest.mark.parametrize("login_id", ["Ab", "PLAYER01", "a" * 21, "player_01"])
def test_register_rejects_invalid_login_id(login_id):
    with pytest.raises(InvalidLoginIdError):
        User.register(login_id, "용감한고양이", HASH)


# AC-08-3: 1자, 13자, 특수문자
@pytest.mark.parametrize("nickname", ["용", "가" * 13, "고양이!"])
def test_register_rejects_invalid_nickname(nickname):
    with pytest.raises(InvalidNicknameError):
        User.register("player01", nickname, HASH)


# AC-08-4: 경곗값 — 7자는 거부, 8자는 통과
def test_raw_password_minimum_length():
    with pytest.raises(InvalidPasswordError):
        User.validate_raw_password("1234567")

    User.validate_raw_password("12345678")  # 예외가 없으면 통과


def test_token_blacklist_rejects_empty_token():
    with pytest.raises(ValueError):
        TokenBlacklist(token="")
