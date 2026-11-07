# container 조립 테스트 — DB 없이 "설계도대로 조립되는가"만 확인한다
#
# [핵심 개념] 조립 오류는 실행해 봐야 드러난다
#   - provider의 키워드 이름 오타(user= ↔ users=), 수명(Singleton/Factory) 실수,
#     서비스가 주입받은 부품을 무시하고 직접 만드는 실수 → 모두 여기서 잡는다
#   - SqlAlchemy 저장소는 생성자에서 세션을 "보관만" 하므로 DB 연결 없이 만들 수 있다

import pytest
from dependency_injector import providers

from auth.domain.repository import UserRepository
from auth.infrastructure.repositories import SqlAlchemyUserRepository
from container import Container
from tests.unit.fakes.repositories import FakeUserRepository

SESSION = object()  # 진짜 세션 대신 "같은 객체인지"만 확인할 표식


@pytest.fixture
def container() -> Container:
    c = Container()
    c.config.from_dict(
        {
            "jwt_secret_key": "test-secret-key-at-least-32-bytes!!",
            "access_token_expire_minutes": 30,
            "refresh_token_expire_days": 7,
        }
    )
    return c


def test_auth_service_receives_request_session(container):
    service = container.auth_service(users__session=SESSION, blacklist__session=SESSION)

    assert isinstance(service.users, SqlAlchemyUserRepository)
    assert service.users.session is SESSION
    assert service.blacklist.session is SESSION


def test_tools_are_singletons_and_actually_used(container):
    first = container.auth_service(users__session=SESSION, blacklist__session=SESSION)
    second = container.auth_service(users__session=SESSION, blacklist__session=SESSION)

    # 서비스는 요청마다 새로 (Factory), 도구는 하나를 공유 (Singleton)
    assert first is not second
    assert first.hasher is second.hasher is container.password_hasher()
    assert first.tokens is container.token_provider()


def test_room_query_service_shares_one_session(container):
    service = container.room_query_service(room_repo__session=SESSION, query_repo__session=SESSION)

    assert service.room_repo.session is service.query_repo.session is SESSION


def test_override_swaps_implementation(container):
    fake = FakeUserRepository()

    # override: 설계도를 잠시 바꿔 끼운다. with 블록이 끝나면 원래대로
    with container.user_repository.override(providers.Object(fake)):
        service = container.auth_service(users__session=SESSION, blacklist__session=SESSION)

    assert service.users is fake
    assert isinstance(service.users, UserRepository)
