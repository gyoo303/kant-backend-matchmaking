# 전역 예외 핸들러 — 도메인 예외·검증 오류를 HTTP 응답 {"detail": "문구"}로 바꾼다 (D-027)
# 400 / 404 / 410 / 401 / 422 / 500
# (410은 Cache-Control: no-store — 브라우저가 이전 해산 이력 정보를 캐시하지 않게)

# ── 전역 예외 핸들러란? ─────────────────────────────────
# 서비스나 도메인 코드에서 raise NotFoundError("...")를 하면,
# 그 예외는 라우터를 거쳐 위로 올라와요.
# register_exception_handlers(app)로 등록한 함수가 그 예외를 "잡아서" HTTP 응답으로 바꿔 줘요.
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

import logging

from fastapi import FastAPI, Request

# RequestValidationError: 요청값 검증 실패(422) 때 FastAPI가 던지는 예외
from fastapi.exceptions import RequestValidationError

# JSONResponse: 상태코드/헤더를 직접 정해서 JSON 응답을 만드는 클래스
from fastapi.responses import JSONResponse

from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from exceptions import (
    AuthenticationError, 
    DomainRuleError, 
    GoneError, 
    NotFoundError,
    ServiceBusyError
)

# 이 파일 전용 로거 (500 오류 로그 남길때 사용한다)
logger = logging.getLogger(__name__)

# 상수
SERVER_ERROR_MESSAGE = "서버 오류가 발생했습니다"  # 500 응답 고정문구
MAX_VALIDATION_MESSAGES = 3  # 422 응답에 담을 검증 오류 문구 최대 갯수


# 공통 응답 함수
# 오류 응답을 {"detail": "문구"} 형태로 통일하기 위해 만든 함수
# 함수 이름 앞의 밑줄(_): "이 함수는 내부용(파일 안에서만 쓰는 함수)"라는 의미의 관례적 표현
def _detail(
    status_code: int,  # HTTP 상태코드
    message: str,  # 오류 발생시 사용자 노출 문구
    headers: dict[str, str] | None = None,  # 응답 헤더, 필요없으면 생략가능 (default=None)
) -> JSONResponse:
    # JSONResponse: content(딕셔너리) -> JSON 변환하여 response body에 넣는다.
    return JSONResponse(
        status_code=status_code,
        content={"detail": message},
        headers=headers,
    )


# 400 : 도메인 규칙 위반 (정원 마감, 방장/참여자 아님 등)
async def handle_domain_rule_error(_: Request, exc: DomainRuleError) -> JSONResponse:
    return _detail(status_code=400, message=exc.message)


# 404 대상없음
# NotFoundError를 상속하는 서비스/도메인 정의 에러 RoomNotFoundError도 모두 404로 잡힌다.
async def handle_not_found_error(_: Request, exc: NotFoundError) -> JSONResponse:
    return _detail(status_code=404, message=exc.message)


# 410 - 게임 시작으로 해산된 방
async def handle_gone_error(_: Request, exc: GoneError) -> JSONResponse:
    # 410 응답 > 브라우저가 "이 주소는 완전히 없어졌다"고 캐시할 수도 있다
    # 브라우저가 옛날 410을 캐시로 기억하면 새 방을 만들어도 404가 뜰 수 있다.
    # Cache-Control: no-store 헤더를 넣어 브라우저가 캐시하지 않게 한다.
    return _detail(status_code=410, message=exc.message, headers={"Cache-Control": "no-store"})


# 409 - 바빠서 거절
# 화면(room.js) -> 문구가 아니라 상태코드 409를 보고
#   "입장하지 못했습니다. 다시 시도해 주세요" 메시지 띄운다.
async def handle_service_busy_error(_: Request, 
                                    exc: ServiceBusyError) -> JSONResponse:
    return _detail(status_code=409, message=exc.message)


# 커넥션 풀 대기 초과 ㅡ SQLAlchemy가 던지는 TimeoutError -> 409
#   풀에서 연결을 빌리는 순간 = "특정 단일 요청의 첫 SQL"
#   인증 조회, 방 조회일 수도 있다 = 어느 곳에서 발생할지 알수없다
#   -> 모든 요청이 지나가는 전역 핸들러 한 곳에서 바꾼다.
async def handle_pool_timeout_errr(_: Request, 
                                   exc: PoolTimeoutError) -> JSONResponse:
    logger.warning("db pool timeout: %s", exc)
    return _detail(status_code=409,
                   message=ServiceBusyError().message)

##########################################
# 401, 422 핸들러
# FastAPI 기본 동작을 바꾸지 않고 detail 키를 유지한다.
##########################################


# 401 - 인증 실패 (토큰없음, 만료, 로그인 실패 등)
# DomainError의 자식이 아니라서 400이 아니라 401로 구분한다.
async def handle_authentication_error(_: Request, exc: AuthenticationError) -> JSONResponse:
    return _detail(
        status_code=401,
        message=exc.message,
        # Bearer -> 브라우저에게 "이 API는 Bearer 토큰 인증을 요구함"을 알려준다.
        headers={"WWW-Authenticate": "Bearer"},
    )


# 422 — 요청 값 형식 오류 (필수 값 누락, 숫자 자리에 문자 등)
# 이 예외는 별도로 raise하지 않는다 - 알아서 잡힌다.
# 라우터 함수 실행 "전에" FastAPI(Pydantic)가 요청 값을 검사하다가 스스로 발생
# FastAPI 기본 422 응답의 detail = "배열":
#   {"detail": [{"loc": ["body", "nickname"], "msg": "Field required", ...}, ...]}
# 화면 JS는 detail을 문자열로 기대하므로, 문자열 하나로 바꾼다 (ADR-004)
#   → {"detail": "nickname: Field required; password: ..."}
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    parts = []  # 메시지 문자열을 모을 리스트

    # exc.errors() - 오류목록(딕셔너리들의 리스트)
    # ex. [{"loc": ["body", "nickname"], "msg": "Field required", ...}, ...]
    for error in exc.errors()[:MAX_VALIDATION_MESSAGES]:  # 최대 출력 갯수 제한
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
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # logger.exception: ERROR 레벨 로그 + 오류가 난 줄까지의 스택 트레이스
    # 디버깅에 필요한 자세한 정보 -> 서버 로그에만 남긴다.
    # 사용자 출력 문구에는 type(exc).__name__ -> 예외클래스 이름만 꺼낸다.
    logger.exception("unhandled error path=%s type=%s", request.url.path, type(exc).__name__)

    # 사용자 -> _detail (고정 문구)
    # str(exc)는 응답에 넣지 않는다 : SQL 쿼리, 파일 경로 등 내부정보 유출 가능성
    return _detail(500, SERVER_ERROR_MESSAGE)


def register_exception_handlers(app: FastAPI) -> None:
    """예외 클래스 → 핸들러 연결. @app.exception_handler(예외) 데코레이터와 같은 동작."""
    app.add_exception_handler(DomainRuleError, handle_domain_rule_error)
    app.add_exception_handler(NotFoundError, handle_not_found_error)
    app.add_exception_handler(GoneError, handle_gone_error)
    app.add_exception_handler(AuthenticationError, handle_authentication_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(Exception, handle_unexpected_error)

    app.add_exception_handler(ServiceBusyError, handle_service_busy_error)
    app.add_exception_handler(PoolTimeoutError, handle_pool_timeout_errr)