"""요청 로깅·처리 시간 미들웨어 (교안 4장 @app.middleware("http"), CONV-07).

로그 한 줄: method=GET path=/api/rooms status=200 duration_ms=12.3
쿼리 문자열·본문·토큰·비밀번호는 남기지 않는다.
"""

import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

logger = logging.getLogger("request")


async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "method=%s path=%s status=%d duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"
    return response
