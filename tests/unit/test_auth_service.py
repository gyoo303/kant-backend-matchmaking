# AuthApplicationService 단위 테스트 — DB 없이 가짜 저장소를 주입한다

import pytest

from auth.application.service import AuthApplicationService
from auth.domain.exceptions import DuplicateLoginIdError
from auth.infrastructure.security import BcryptPasswordHasher, JwtTokenProvider
from exceptions import AuthenticationError
from tests.unit.fakes.repositories import FakeTokenBlacklistRepository, FakeUserRepository


@pytest.fixture
def service() -> AuthApplicationService:
    # 조립을 테스트가 직접 한다: 저장소만 가짜, 해시·토큰 도구는 진짜
    return AuthApplicationService(
        users=FakeUserRepository(),
        blacklist=FakeTokenBlacklistRepository(),
        hasher=BcryptPasswordHasher(),
        tokens=JwtTokenProvider("test-secret-key-at-least-32-bytes!!", 30, 7),
    )


async def test_signup_then_login_and_authenticate(service):
    await service.signup("tester01", "테스터", "password123")

    tokens = await service.login("tester01", "password123")
    user = await service.authenticate(tokens["access_token"])

    assert user.login_id == "tester01"


async def test_duplicate_login_id_is_rejected(service):
    await service.signup("tester01", "테스터", "password123")

    with pytest.raises(DuplicateLoginIdError):
        await service.signup("tester01", "다른닉", "password123")


async def test_refresh_token_cannot_authenticate(service):
    await service.signup("tester01", "테스터", "password123")
    tokens = await service.login("tester01", "password123")

    with pytest.raises(AuthenticationError):
        await service.authenticate(tokens["refresh_token"])


async def test_logged_out_refresh_token_is_blocked(service):
    await service.signup("tester01", "테스터", "password123")
    tokens = await service.login("tester01", "password123")

    await service.logout(tokens["access_token"], tokens["refresh_token"])

    with pytest.raises(AuthenticationError):
        await service.refresh(tokens["refresh_token"])