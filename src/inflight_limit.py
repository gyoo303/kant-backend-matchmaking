# 진입 단계 동시 처리 상한 — ADR-015
#
# [핵심 개념] 왜 필요한가
#   ADR-013의 대기 상한(풀 1초, 잠금 2초)은 요청이 "DB 연결을 기다리기 시작한 뒤"에만 걸린다.
#   처리 한계(워커 1개 약 120 TPS)를 넘는 요청이 들어오면, 요청은 그보다 앞 단계
#   (이벤트 루프 차례, 요청 읽기)에서 쌓이고 그 대기에는 상한이 없다 → 5초를 넘긴다(7단계 1차 측정).
#   그래서 "지금 처리 중인 요청 수"를 세어 두고,
#   상한에 닿으면 새 요청은 일을 시작하지 않고 즉시 409.
#   일을 시작하지 않았으므로 다시 눌러도 안전하다(D-034 "바빠서 거절"과 같은 의미·문구).
#
# [핵심 개념] 순수 ASGI 미들웨어
#   @app.middleware("http")(BaseHTTPMiddleware)는 요청마다 Request/Response 객체를 만들어 무겁다.
#   거절은 과부하 때 가장 많이 일어나므로 가장 싸게 끝나야 한다
#   → scope/receive/send만 다루는 ASGI 형태.
#
# [주의] 카운터에 잠금이 필요 없는 이유
#   uvicorn 워커 1개 = 이벤트 루프 1개. 아래 "확인 → 증가" 사이에 await가 없으므로
#   다른 요청이 끼어들 수 없다. (워커를 여러 개 띄우면 워커마다 따로 센다 → 상한도 워커마다)

import json
import logging
import time

from starlette.types import ASGIApp, Receive, Scope, Send

from exceptions import ServiceBusyError

logger = logging.getLogger(__name__)

# 거절 로그는 과부하 때 초당 수백 건이 될 수 있으므로 1초에 한 줄로 묶는다
_REJECT_LOG_INTERVAL_S = 1.0


class InflightLimitMiddleware:
    def __init__(self, app: ASGIApp, limit: int, path_prefix: str = "/api") -> None:
        self.app = app
        self.limit = limit
        self.path_prefix = path_prefix  # 화면(HTML)·정적 파일은 세지 않는다 — API만 보호
        self.inflight = 0  # 지금 처리 중인 요청 수
        self.peak = 0  # 지금까지 가장 많았던 동시 처리 수 (상한 값을 정할 근거, 로그로 남김)
        self._rejected = 0
        self._last_log = 0.0
        self._body = json.dumps({"detail": ServiceBusyError().message}, ensure_ascii=False).encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith(self.path_prefix):
            await self.app(scope, receive, send)
            return

        if self.inflight >= self.limit:
            await self._reject(send)
            return

        self.inflight += 1
        if self.inflight > self.peak:
            self.peak = self.inflight
            if self.peak >= self.limit // 2:  # 평소(한 자릿수)에는 남기지 않는다
                logger.warning("inflight peak=%d limit=%d", self.peak, self.limit)
        try:
            await self.app(scope, receive, send)
        finally:
            self.inflight -= 1  # 성공·실패·클라이언트 끊김 모두 반드시 되돌린다

    async def _reject(self, send: Send) -> None:
        self._rejected += 1
        now = time.monotonic()
        if now - self._last_log >= _REJECT_LOG_INTERVAL_S:
            logger.warning(
                "inflight limit reached: rejected=%d limit=%d", self._rejected, self.limit
            )
            self._rejected = 0
            self._last_log = now
        await send(
            {
                "type": "http.response.start",
                "status": 409,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(self._body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": self._body})
