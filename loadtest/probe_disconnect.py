"""클라이언트가 먼저 끊으면 서버 처리도 멈추는가? (7단계 보조 실험)

방 행을 별도 DB 연결로 HOLD초 동안 잠가 둔 채 참가 요청을 보내고,
클라이언트는 CLIENT_TIMEOUT초에 포기한다.
HOLD(1.5초) < lock_timeout(2초)라서, 서버가 끊김과 상관없이 계속 기다렸다면
잠금이 풀린 뒤 참가가 저장된다.
  saved_in_db=1 → 서버는 끝까지 처리한다
                  (화면의 AbortController는 서버 처리를 취소하지 못한다, ADR-014)
  saved_in_db=0 → 끊기면 서버 처리도 취소된다

실행 (앱을 측정 DB로 띄운 뒤 — loadtest/README.md 1번)
  uv run python loadtest/probe_disconnect.py
"""

import asyncio

import asyncpg
import bench_join as b
import httpx

HOLD_S = 1.5
CLIENT_TIMEOUT_S = 0.5


async def main() -> None:
    conn = await asyncpg.connect(b.bench_db_url())
    await b.reset_db(conn)
    host, joiner = await b.create_members(conn, 2, b.jwt_secret())
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8001", timeout=10) as client:
        (room_id,) = await b.create_rooms(client, [host])

        # 다른 연결로 방 행을 잠가 둔다 → 참가 요청은 잠금 대기에 들어간다
        locker = await asyncpg.connect(b.bench_db_url())
        tr = locker.transaction()
        await tr.start()
        await locker.execute("SELECT id FROM rooms WHERE id = $1 FOR UPDATE", room_id)
        try:
            res = await client.post(
                f"/api/rooms/{room_id}/participants",
                headers=b.auth(joiner),
                timeout=CLIENT_TIMEOUT_S,
            )
            status = str(res.status_code)
        except httpx.TimeoutException:
            status = "client-timeout"
        await asyncio.sleep(HOLD_S - CLIENT_TIMEOUT_S)
        await tr.commit()  # 잠금 해제 → 서버가 아직 기다리고 있었다면 이제 참가를 저장한다
        await locker.close()
        await asyncio.sleep(1.5)

    saved = await conn.fetchval(
        "SELECT count(*) FROM participations WHERE user_id = $1", joiner.user_id
    )
    print(f"hold={HOLD_S}s timeout={CLIENT_TIMEOUT_S}s -> client={status}, saved_in_db={saved}")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
