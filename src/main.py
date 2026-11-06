from contextlib import asynccontextmanager

import logging
from pathlib import Path # 파일, 폴더 경로를 운영체제와 상관없이 다루는 도구

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError # 요청값 검증 실패(422) 때 FastAPI가 던지는 예외
from fastapi.middleware.cors import CORSMiddleware # 다른 출처(도메인/포트) 접근 허용 규칙
from fastapi.responses import JSONResponse # 상태코드/헤더를 직접 정해서 JSON 응답을 만드는 클래스
from fastapi.staticfiles import StaticFiles # CSS, JS 등 파일을 그대로 내려주는 기능

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import auth.infrastructure.models  # noqa: F401
import rooms.infrastructure.models  # noqa: F401
from database import AsyncSessionLocal, Base, close_db, engine
from seed import seed_initial_data
from rooms.presentation.router import router as rooms_router
from rooms.presentation.pages import page_router as rooms_page_router
from auth.presentation.router import router as auth_router
from auth.presentation.pages import page_router as auth_page_router
from config import get_settings
from exceptions import AuthenticationError, DomainRuleError, GoneError, NotFoundError
from logging_middleware import log_requests


# lifespan
# @asynccontextmanager: yield 하나로 "앞부분=시작시, 뒷부분=종료시"를 구분해 주는 데코레이터
# FastAPI : 서버가 요청 받기 전에 yield 앞까지 실행한다
# 서버가 종료 신호를 받으면 yield 뒤를 실행한다
@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    # 1) 테이블 생성 (SEQ-12)
    #   engine.begin(): 커넥션 하나 + 트랜잭션 열고 블록이 끝나면 자동 commit
    #   create_all -> "동기" 함수, async 커넥션에서 바로 부를 수 없다
    #   -> run_sync가 동기 함수를 비동기 커넥션 위에서 대신 실행 (교안 5강 1장)
    #   이미 있는 테이블은 건너뛴다 + 컬럼 변경은 반영하지 않는다 (모델 바뀌면 DB 지우고 재생성 필요)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2) 시드 (한 세션 = 한 트랜잭션)
    #   seed_initial_data -> flush만 하고, commit은 여기서 딱 한 번.
    #   중간에 예외발생시 commit 없이 블록 이탈 -> 아무것도 저장X
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session, settings)
        await session.commit()

    yield # 걸려있는 동안 서버가 요청을 처리한다.

    # 3) 종료: 커넥션 풀의 연결을 모두 닫는다 (database.close_db = engine.dispose)
    await close_db()



# 로그 기본설정 - 앱 전체에서 딱 한번 호출 (가장 먼저)
logging.basicConfig(level=logging.INFO)

# main.py 전용 로거 (500 오류 로그 남길때 사용한다)
logger = logging.getLogger(__name__)

# 상수
SERVER_ERROR_MESSAGE = "서버 오류가 발생했습니다" # 500 응답 고정문구
MAX_VALIDATION_MESSAGES = 3 # 422 응답에 담을 검증 오류 문구 최대 갯수

# static 폴더 절대경로 만들기
# __file__ : 현재 실행중인 파일(main.py)의 절대경로
# .resolve() : 상대경로를 절대경로로 바꾼다
# .parent : 해당 파일이 속한 폴더 경로 (.../src)
# / "static" : Path에서는 "/"로 경로를 이어 붙인다 -> .../src/static
STATIC_DIR = Path(__file__).resolve().parent / "static"


# 앱 엔트리
app = FastAPI(
    title = "2vs2 매치메이킹", # /docs 화면 맨 위 제목
    description = "2vs2 공개 방을 만들거나 참가하고, 방장이 게임을 시작하거나 인원수가 0이 되면 방이 해산된다",
    version = "0.1.0", # /docs 화면 표시, API 버전
    lifespan = lifespan,
)


# 미들웨어: 요청 로깅, CORS

# 1) 요청 로깅 ㅡ 먼저 등록 : 안쪽
#   @app.middleware("http") 데코레이터를 함수 위에 붙이는 것과 같은 동작.
#   함수가 다른 파일(logging_middleware.py)에 있어서 "호출" 형태로 등록한다.
app.middleware("http")(log_requests) 
# log_requests(request, call_next) 호출 -> FastAPI가 request, call_next를 넣어 호출하고 응답을 반환


# 2) CORS 허용 ㅡ 나중 등록 : 바깥쪽
#   CORS(Cross-Origin Resource Sharing) : 
#   브라우저는 보안상 "다른 출처"(도메인/포트가 다른 곳)로 보내는 요청을 막는다.
#   서버가 "이 출처는 허용해요"라고 응답 헤더에 넣어줘야 브라우저가 통과시킴
app.add_middleware(
    CORSMiddleware,

    # 허용할 출처 목록 ㅡ .env의 CORS_ORIGINS 값 (예: ["http://localhost:8000"])
    # ["*"] -> 모든 출처 허용; 아무 사이트나 우리 API 호출이 가능해지므로 금지
    allow_origins = get_settings().cors_origins,

    # API가 실제로 쓰는 HTTP 메서드 허용 목록
    # PUT -> 멱등성 보장, PATCH -> 멱등성 보장 X
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE"],

    # 브라우저가 보낼 수 있는 요청 헤더
    #  Authorization: "Bearer <JWT 토큰>" (로그인 인증)
    #  Content-Type: "application/json" (JSON 요청 본문 형식)
    allow_headers = ["Authorization", "Content-Type"],

    # allow_credentials = True, # 쿠키/인증 헤더 허용 여부
)

# 공통 응답 함수
# 오류 응답을 {"detail": "문구"} 형태로 통일하기 위해 만든 함수

# 함수 이름 앞의 밑줄(_): "이 함수는 내부용(파일 안에서만 쓰는 함수)"라는 의미의 관례적 표현
def _detail(
        status_code: int, # HTTP 상태코드
        message: str, # 오류 발생시 사용자 노출 문구
        headers: dict[str, str] | None = None, # 응답 헤더, 필요없으면 생략가능 (default=None)
) -> JSONResponse:
    # JSONResponse: content(딕셔너리) -> JSON 변환하여 response body에 넣는다.
    return JSONResponse(
        status_code = status_code,
        content = {"detail" : message},
        headers = headers,
    )


# 전역 예외 핸들러: 400 / 404 / 410 / 401 / 422 / 500
# (410은 Cache-Control: no-store — 브라우저가 이전 해산 이력 정보를 캐시하지 않게)

# ── 전역 예외 핸들러란? ─────────────────────────────────
# 서비스나 도메인 코드에서 raise NotFoundError("...")를 하면,
# 그 예외는 라우터를 거쳐 위로 올라와요.
# @app.exception_handler(예외클래스)로 등록한 함수가 그 예외를 "잡아서" HTTP 응답으로 바꿔 줘요.
#
#   도메인: raise NotFoundError("방을 찾을 수 없습니다")
#      ↓ (예외가 위로 전파)
#   핸들러: handle_not_found_error 실행 → 404 {"detail": "방을 찾을 수 없습니다"}
#
# 덕분에 도메인 코드는 HTTP를 전혀 몰라도 돼요. "어떤 예외 = 몇 번 상태 코드" 연결은 여기서만 해요.
#
# 핸들러 함수의 매개변수는 FastAPI가 자동으로 넣어 줘요.
#   첫 번째: 요청 객체(Request) — 쓰지 않을 땐 이름을 "_"로 둬서 "안 씀"을 표시해요.
#   두 번째: 잡힌 예외 객체(exc) — exc.message로 문구를 꺼내요. (exceptions.py에서 만든 속성)

# 400 : 도메인 규칙 위반 (정원 마감, 방장/참여자 아님 등)
@app.exception_handler(DomainRuleError)
async def handle_domain_rule_error(
    _: Request, exc: DomainRuleError
) -> JSONResponse:
    return _detail(status_code=400, message=exc.message)

# 404 대상없음
# NotFoundError를 상속하는 서비스/도메인 정의 에러 RoomNotFoundError도 모두 404로 잡힌다.
@app.exception_handler(NotFoundError)
async def handle_not_found_error(
    _: Request, exc: NotFoundError
) -> JSONResponse:
    return _detail(status_code=404, message=exc.message)

# 410 - 게임 시작으로 해산된 방
@app.exception_handler(GoneError)
async def handle_gone_error(
    _: Request, exc: GoneError
) -> JSONResponse:
    # 410 응답 > 브라우저가 "이 주소는 완전히 없어졌다"고 캐시할 수도 있다
    # 브라우저가 옛날 410을 캐시로 기억하면 새 방을 만들어도 404가 뜰 수 있다.
    # Cache-Control: no-store 헤더를 넣어 브라우저가 캐시하지 않게 한다.
    return _detail(status_code=410,
                   message=exc.message,
                   headers={"Cache-Control": "no-store"})


##########################################
# 401, 422 핸들러
# FastAPI 기본 동작을 바꾸지 않고 detail 키를 유지한다.
##########################################

# 401 - 인증 실패 (토큰없음, 만료, 로그인 실패 등)
# DomainError의 자식이 아니라서 400이 아니라 401로 구분한다.
@app.exception_handler(AuthenticationError)
async def handle_authentication_error(
    _: Request, exc: AuthenticationError
) -> JSONResponse:
    return _detail(status_code=401, 
                   message=exc.message,
                   # Bearer -> 브라우저에게 "이 API는 Bearer 토큰 인증을 요구함"을 알려준다.
                   headers={"WWW-Authenticate": "Bearer"})


# 422 — 요청 값 형식 오류 (필수 값 누락, 숫자 자리에 문자 등)
# 이 예외는 별도로 raise하지 않는다 - 알아서 잡힌다.
# 라우터 함수 실행 "전에" FastAPI(Pydantic)가 요청 값을 검사하다가 스스로 발생
# FastAPI 기본 422 응답의 detail = "배열":
    #   {"detail": [{"loc": ["body", "nickname"], "msg": "Field required", ...}, ...]}
    # 화면 JS는 detail을 문자열로 기대하므로, 문자열 하나로 바꾼다 (ADR-004)
    #   → {"detail": "nickname: Field required; password: ..."}
@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    parts = [] # 메시지 문자열을 모을 리스트

    # exc.errors() - 오류목록(딕셔너리들의 리스트) 
    # ex. [{"loc": ["body", "nickname"], "msg": "Field required", ...}, ...]
    for error in exc.errors()[:MAX_VALIDATION_MESSAGES]: # 환경변수로 최대 출력 갯수 지정
        # loc = 오류 위치. 예: ("body", "nickname") 또는 ("query", "page")
        # .get("loc")이 None이거나 비어 있으면 빈 튜플()을 대신 써요. (or 연산자 활용)
        location = error.get("loc") or ()

        # 위치의 "마지막 값"이 실제 필드 이름이에요. ("body", "nickname") → "nickname"
        # 위치 정보가 아예 없으면 "요청"이라고 표시해요.
        field = str(location[-1]) if location else "요청"

        # msg = 오류 설명. 혹시 없으면 빈 문자열
        parts.append(f"{field}: {error.get('msg', '')}")

    # "; ".join(리스트) : 리스트 요소 사이에 "; "를 넣어 문자열 하나로 합쳐요.
    # ["a: x", "b: y"] → "a: x; b: y"
    return _detail(422, "; ".join(parts))
        

# 500 - 위에서 잡히지 않는 나머지 모든 예외
# Exception -> 다른 핸들러가 못 잡는 예외 전체가 여기로 모인다
@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # logger.exceptioni: ERROR 레벨 로그 + 오류가 난 줄까지의 스택 트레이스
    # 디버깅에 필요한 자세한 정보 -> 서버 로그에만 남긴다.
    # 사용자 출력 문구에는 type(exc).__name__ -> 예외클래스 이름만 꺼낸다.

    logger.exception("unhandled error path=%s type=%s", request.url.path, type(exc).__name__)

    # 사용자 -> _detail (고정 문구)
    # str(exc)는 응답에 넣지 않는다 : SQL 쿼리, 파일 경로 등 내부정보 유출 가능성
    return _detail(500, SERVER_ERROR_MESSAGE)


        
# 라우터 등록: auth API, rooms API, 화면 라우트
#   다른 파트 작업 끝나면 진행
app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(auth_page_router)
app.include_router(rooms_page_router)

# /static 마운트
# 경로는 Path(__file__) 기준
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")