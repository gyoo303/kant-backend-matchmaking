# 통합 테스트 픽스처 — 실제 PostgreSQL + 실제 FastAPI 앱 (06-quality-gates.md §2)
#
# [핵심 개념] 통합 테스트 = 계층을 모두 거치는 테스트
#   HTTP 요청 → 라우터 → container가 조립한 서비스
#     → SqlAlchemy 저장소 → 테스트 DB
#   단위 테스트가 놓치는 것(SQL, 트랜잭션, 조립, 예외 → HTTP 변환)을 여기서 잡는다
#
# [동작 방식]
#   engine      세션 전체에서 1번: drop_all → create_all (모델이 바뀌어도 깨끗한 스키마)
#   _clean_db   테스트마다: TRUNCATE … RESTART IDENTITY CASCADE (id도 1부터 다시)
#   client      앱의 get_db를 테스트 DB 세션으로 바꿔 끼운다(dependency_overrides)
#               → container·서비스·저장소는 운영과 똑같고 "세션이 붙는 DB"만 다르다
#
# [고려할 사항]
#   - TEST_DATABASE_URL이 없으면 통합 테스트는 건너뛴다(skip). 운영 DB를 지우는 사고 방지
#   - override 키는 DbSession이 아니라 get_db 함수다
#     같은 규칙(정상 commit·예외 rollback, D-029)을 지킨다
#   - ASGITransport는 lifespan을 실행하지 않는다 → create_all·seed는 여기서 직접 관리
#   - wiring은 프로세스 전역: 단위 테스트가 Container()를 새로 만들었을 수 있으니 다시 연결한다

import os
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import auth.infrastructure.models  # noqa: F401 — Base.metadata에 테이블 등록
import main
import rooms.infrastructure.models  # noqa: F401
from database import Base, get_db

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
PASSWORD = "password123"


@pytest.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL이 없어 통합 테스트를 건너뜁니다")
    test_engine = create_async_engine(TEST_DATABASE_URL)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_db(engine: AsyncEngine) -> None:
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    # get_db와 같은 규칙: 요청 하나 = 세션 하나 = 트랜잭션 하나
    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app = main.app
    app.state.container.wire()
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    # 테스트가 넣은 키만 뺀다 (clear()는 다른 테스트·향후 연결까지 지울 수 있다)
    app.dependency_overrides.pop(get_db, None)


@dataclass(frozen=True)
class Member:
    """가입·로그인을 마친 테스트 회원"""

    id: int
    login_id: str
    headers: dict[str, str]  # {"Authorization": "Bearer …"}
    refresh_token: str


@pytest.fixture
def make_member(client: AsyncClient) -> Callable[[str], Awaitable[Member]]:
    """await make_member("player01") → 가입하고 로그인한 회원 (테스트가 직접 데이터를 만든다)"""

    async def _make(login_id: str) -> Member:
        nickname = f"닉{login_id[-6:]}"
        signup = await client.post(
            "/api/auth/signup",
            json={"login_id": login_id, "nickname": nickname, "password": PASSWORD},
        )
        assert signup.status_code == 200, signup.text
        tokens = (
            await client.post("/api/auth/token", data={"username": login_id, "password": PASSWORD})
        ).json()
        return Member(
            id=signup.json()["id"],
            login_id=login_id,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            refresh_token=tokens["refresh_token"],
        )

    return _make
