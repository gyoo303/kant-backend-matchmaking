"""공통 픽스처 (06-quality-gates.md §2).

- 단위 테스트(tests/unit)는 DB 없이 돈다.
- 통합 테스트(tests/integration)는 TEST_DATABASE_URL(별도 PostgreSQL DB)이 있을 때만 돈다.
  없으면 건너뛴다.
- 앱 설정은 database 모듈 import 전에 환경변수로 채운다(STK-10, DB 브리핑 TKT-DB-M2-01).
- 인증은 실제 access 토큰(교안 6장, SEQ-03)을 쓴다.
  테스트 모듈은 `from conftest import auth_header`로 가져다 쓴다.
"""

import os

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL or "postgresql+asyncpg://t:t@127.0.0.1:1/t")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-at-least-32-bytes")
os.environ.setdefault("SEED_USER_PASSWORD", "test-seed-password")

from collections.abc import AsyncIterator, Awaitable, Callable  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

TABLES = ("participations", "teams", "rooms", "token_blacklist", "users")
TEST_PASSWORD = "password123"

# make_users가 만든 회원 ID → 아이디. auth_header가 토큰의 sub(아이디)를 찾는 데 쓴다.
_login_ids: dict[int, str] = {}
_hashed_test_password: list[str] = []


def auth_header(user_id: int) -> dict[str, str]:
    """make_users로 만든 회원의 access 토큰 헤더 (교안 6장 create_access_token)."""
    from auth.infrastructure.security import create_access_token

    token = create_access_token({"sub": _login_ids[user_id]})
    return {"Authorization": f"Bearer {token}"}


def _hashed_password() -> str:
    """bcrypt는 느리므로 테스트 비밀번호 해시를 한 번만 만든다."""
    if not _hashed_test_password:
        from auth.infrastructure.security import PasswordHasher

        _hashed_test_password.append(PasswordHasher().hash(TEST_PASSWORD))
    return _hashed_test_password[0]


@pytest.fixture(scope="session")
async def test_engine() -> AsyncIterator[AsyncEngine]:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL이 없어 통합 테스트를 건너뜁니다")
    import main  # noqa: F401  (모든 모델을 Base.metadata에 등록)
    from database import Base

    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session_factory(test_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    async with test_engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[httpx.AsyncClient]:
    """lifespan(시드)을 돌리지 않는 ASGI 클라이언트. get_db는 테스트 DB 세션으로 바꾼다."""
    from database import get_db
    from main import app

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()


@pytest.fixture
def make_users(
    session_factory: async_sessionmaker[AsyncSession],
) -> Callable[[int], Awaitable[list[int]]]:
    """회원 n명을 만들고 ID 목록을 돌려준다(아이디 user01, user02, …, 비밀번호 TEST_PASSWORD)."""

    async def _make(count: int) -> list[int]:
        from auth.domain.user import User
        from auth.infrastructure.repositories import UserRepository

        ids: list[int] = []
        _login_ids.clear()
        async with session_factory() as session:
            users = UserRepository(session)
            for number in range(1, count + 1):
                login_id = f"user{number:02d}"
                user = User.register(login_id, f"회원{number:02d}", _hashed_password())
                saved = await users.save(user)
                _login_ids[saved.id] = login_id
                ids.append(saved.id)
            await session.commit()
        return ids

    return _make
