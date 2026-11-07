# wiring HTTP 테스트 — 실제 FastAPI 요청 경로로 container 주입이 동작하는지 확인 (DB 불필요)
#
# [핵심 개념] app.container의 저장소 provider를 가짜로 override
#   - 라우터 → get_auth_service(@inject) → container → 서비스 → (가짜) 저장소
#   - 요청 처리 경로는 운영과 똑같고, 저장소만 메모리 dict로 바뀐다
#   - TestClient를 with 없이 쓰면 lifespan(create_all = DB 접속)을 건너뛴다
#   - get_db는 세션 객체만 만들고, 가짜 저장소가 쓰지 않으므로 DB에 접속하지 않는다

import pytest
from dependency_injector import providers
from fastapi.testclient import TestClient

import main
from tests.unit.fakes.repositories import FakeTokenBlacklistRepository, FakeUserRepository


@pytest.fixture
def client():
    container = main.app.state.container
    # wiring은 프로세스 전역: 다른 테스트가 Container()를 새로 만들면 연결이 그쪽으로 넘어간다
    #   → 이 테스트가 쓰는 app.container로 다시 연결해 둔다
    container.wire()
    # providers.Object: 호출 인자(session=...)를 무시하고 항상 같은 객체를 돌려준다
    #   → 요청이 바뀌어도 가입한 회원이 남아 있다
    with (
        container.user_repository.override(providers.Object(FakeUserRepository())),
        container.token_blacklist_repository.override(
            providers.Object(FakeTokenBlacklistRepository())
        ),
    ):
        yield TestClient(main.app)


def test_auth_flow_through_container(client):
    body = {"login_id": "tester01", "nickname": "테스터", "password": "password123"}
    assert client.post("/api/auth/signup", json=body).status_code in (200, 201)

    tokens = client.post(
        "/api/auth/token", data={"username": "tester01", "password": "password123"}
    ).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    ).status_code == 200

    logout = client.post(
        "/api/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=headers
    )
    assert logout.status_code in (200, 204)
    assert client.get("/api/auth/me", headers=headers).status_code == 401