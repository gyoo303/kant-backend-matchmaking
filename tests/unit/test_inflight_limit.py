# 진입 단계 동시 처리 상한(ADR-015) — DB 없이 미들웨어만 검사한다
#   안쪽 앱은 release 이벤트가 set될 때까지 응답하지 않는 "느린 API"다.
#   상한만큼 요청을 붙잡아 둔 상태에서 하나를 더 보내면 즉시 409가 와야 한다.

import asyncio

import httpx

from inflight_limit import InflightLimitMiddleware


def make_app(release: asyncio.Event, started: list[str]):
    async def slow_app(scope, receive, send):
        started.append(scope["path"])
        await release.wait()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    return slow_app


async def wait_until(cond, timeout: float = 1.0) -> None:
    async with asyncio.timeout(timeout):
        while not cond():
            await asyncio.sleep(0)


async def test_rejects_with_409_when_limit_reached():
    release, started = asyncio.Event(), []
    limiter = InflightLimitMiddleware(make_app(release, started), limit=2)
    transport = httpx.ASGITransport(app=limiter)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        held = [asyncio.create_task(client.get("/api/rooms")) for _ in range(2)]
        await wait_until(lambda: limiter.inflight == 2)

        res = await client.get("/api/rooms")  # 상한 초과 → 기다리지 않고 바로 거절

        assert res.status_code == 409
        assert res.json() == {"detail": "요청이 많아 처리하지 못했습니다. 다시 시도해 주세요."}
        assert len(started) == 2  # 거절된 요청은 안쪽 앱(라우터)에 닿지 않았다

        release.set()
        assert [r.status_code for r in await asyncio.gather(*held)] == [200, 200]
    assert limiter.inflight == 0  # 끝나면 카운터가 되돌아간다
    assert limiter.peak == 2


async def test_non_api_paths_are_not_counted():
    release, started = asyncio.Event(), []
    release.set()
    limiter = InflightLimitMiddleware(make_app(release, started), limit=0)
    transport = httpx.ASGITransport(app=limiter)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        page = await client.get("/rooms/1")  # 화면 경로는 상한 0이어도 통과
        api = await client.get("/api/rooms")

    assert page.status_code == 200
    assert api.status_code == 409


async def test_counter_released_when_inner_app_fails():
    async def broken_app(scope, receive, send):
        raise RuntimeError("boom")

    limiter = InflightLimitMiddleware(broken_app, limit=1)
    transport = httpx.ASGITransport(app=limiter, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as client:
        await client.get("/api/rooms")

    assert limiter.inflight == 0
