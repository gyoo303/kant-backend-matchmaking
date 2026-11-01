# 요청 로깅 미들웨어 — method, path, status, 처리 시간을 남긴다
import logging
import time
from collections.abc import Awaitable, Callable
from fastapi import Request, Response


# __name__ -> 로그에 호출 파일명이 찍혀서 위치를 알 수 있다
logger = logging.getLogger(__name__)

# log_requests(request, call_next)
# Callable[[Request], Awaitable[Response]] = 요청을 받아서 응답을 await 방식으로 리턴하는 함수 객체타입
async def log_requests(request: Request, 
                       call_next: Callable[[Request], Awaitable[Response]]) -> Response:
  
  # 시스템 시계가 변경돼도 일관성 있게 동작 - time.time()보다 정확하다 
  start = time.perf_counter()
  
  response = await call_next
  duration_ms = (time.perf_counter() - start) * 1000
  
  logger.info(
    "method=%s path=%s status=%d duration_ms=%.1f",
    request.method,
    
    # request.url 전체를 쓰면 ?keyword=... 등 쿼리 문자열 포함 
    # -> 토큰, 비밀번호가 넘어가지 않도록 request.url.path
    request.url.path,
    response.status_code,
    duration_ms,
  )
  response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"
  
  return response


