# 요청 로깅 미들웨어 — method, path, status, 처리 시간을 남긴다
import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

# __name__ -> 로그에 호출 파일명이 찍혀서 위치를 알 수 있다
# ex. "INFO:logging_middleware:..."
logger = logging.getLogger(__name__)

# log_requests(request, call_next)
# Callable[[Request], Awaitable[Response]]
#   = 요청을 받아서 응답을 await 방식으로 리턴하는 함수 객체타입


# 매개변수 두 개는 FastAPI가 자동으로 넣어준다.
#   request   : 지금 들어온 요청 (메서드, 경로, 헤더 등)
#   call_next : "다음 단계를 실행하는 함수". 호출하면 라우터까지 처리하고 응답 반환
async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:

    # 시스템(컴퓨터) 시계의 시간이 변경돼도 일관성 있게 동작 (시간측정 전용)
    # time.time() -> 시스템 시계 기준으로 동작 (시스템 시계가 변경되면 시간 측정이 부정확)
    start = time.perf_counter()

    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "method=%s path=%s status=%d duration_ms=%.1f",
        request.method,
        # request.url 전체를 쓰면 "?keyword=...&token=..." 등 쿼리 문자열 포함
        # -> 토큰, 비밀번호가 넘어가지 않도록 request.url.path
        request.url.path,
        response.status_code,  # 200, 404 등 라우터가 만든 응답 상태코드
        duration_ms,
    )
    response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"

    return response
