import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import auth.infrastructure.models  # noqa: F401  (create_all 전에 테이블 등록)
import rooms.infrastructure.models  # noqa: F401
from auth.presentation.pages import page_router as auth_page_router
from auth.presentation.router import router as auth_router
from config import get_settings
from database import AsyncSessionLocal, Base, engine
from exceptions import AuthenticationError, DomainRuleError, GoneError, NotFoundError
from logging_middleware import log_requests
from rooms.presentation.pages import page_router as rooms_page_router
from rooms.presentation.router import router as rooms_router
from seed import seed_initial_data

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s %(message)s")
logger = logging.getLogger(__name__)

SERVER_ERROR_MESSAGE = "서버 오류가 발생했습니다"
MAX_VALIDATION_MESSAGES = 3
STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """테이블 생성 → 시드 주입 → 종료 시 엔진 정리 (SEQ-12)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session, get_settings())
        await session.commit()
    yield
    await engine.dispose()


app = FastAPI(
    title="2vs2 매치메이킹",
    description="2vs2 공개 방을 만들거나 참가하고, 방장이 게임을 시작하면 방이 해산된다.",
    version="0.1.0",
    lifespan=lifespan,
)

# 미들웨어: 요청 로깅이 안쪽, CORS가 가장 바깥 (CONV-10·11, 교안 4장)
app.middleware("http")(log_requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def _detail(status_code: int, message: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": message}, headers=headers)


@app.exception_handler(DomainRuleError)
async def handle_domain_rule_error(_: Request, exc: DomainRuleError) -> JSONResponse:
    return _detail(400, exc.message)


@app.exception_handler(NotFoundError)
async def handle_not_found_error(_: Request, exc: NotFoundError) -> JSONResponse:
    return _detail(404, exc.message)


@app.exception_handler(GoneError)
async def handle_gone_error(_: Request, exc: GoneError) -> JSONResponse:
    """410은 브라우저가 캐시할 수 있다. DB 재생성 뒤 같은 방 번호가 해산으로 보이지 않게 막는다."""
    return _detail(410, exc.message, headers={"Cache-Control": "no-store"})


@app.exception_handler(AuthenticationError)
async def handle_authentication_error(_: Request, exc: AuthenticationError) -> JSONResponse:
    return _detail(401, exc.message, headers={"WWW-Authenticate": "Bearer"})


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """422도 {"detail": "<필드>: <메시지>; ..."} 문자열 하나로 바꾼다 (ADR-004)."""
    parts = []
    for error in exc.errors()[:MAX_VALIDATION_MESSAGES]:
        location = error.get("loc") or ()
        field = str(location[-1]) if location else "요청"
        parts.append(f"{field}: {error.get('msg', '')}")
    return _detail(422, "; ".join(parts))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error path=%s type=%s", request.url.path, type(exc).__name__)
    return _detail(500, SERVER_ERROR_MESSAGE)


app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(auth_page_router)
app.include_router(rooms_page_router)
# 정적 파일은 FE가 src/static/에 만든다. 폴더가 생기기 전에도 앱이 뜨도록 check_dir=False
app.mount("/static", StaticFiles(directory=STATIC_DIR, check_dir=False), name="static")
