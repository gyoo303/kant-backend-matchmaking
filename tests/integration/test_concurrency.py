# 동시 요청 정합성 통합 테스트 (AC-18, ADR-013) — 실제 PostgreSQL 필요(TEST_DATABASE_URL)
#
# 개념: asyncio.gather로 "동시에" 보내기
#   gather(a(), b(), c())는 세 코루틴을 한꺼번에 시작한다. 각 요청이 DB 응답을 기다리는(await) 동안
#   다른 요청이 진행되므로, 실제 서버에 여러 사용자가 동시에 누른 것과 같은 경합이 생긴다.
#   요청마다 get_db가 세션(=DB 연결·트랜잭션)을 따로 열기 때문에 DB 잠금도 실제처럼 동작한다.
import asyncio

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def create_room(client: AsyncClient, host) -> int:
    res = await client.post("/api/rooms", json={"title": "동시성"}, headers=host.headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]


async def participant_count(engine: AsyncEngine, room_id: int) -> int:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT count(*) FROM participations WHERE room_id = :id"), {"id": room_id}
        )
        return result.scalar_one()


# AC-18-1: 빈자리 1개인 방에 10명이 동시에 참가 → 성공 1, 거절 9, 참가자 4명
async def test_last_seat_concurrent_join(client, make_member, engine):
    members = [await make_member(f"cc{i:02d}") for i in range(13)]
    host, early, racers = members[0], members[1:3], members[3:]
    room_id = await create_room(client, host)
    for member in early:  # 방장 + 2명 = 3명, 빈자리 1개
        res = await client.post(f"/api/rooms/{room_id}/participants", headers=member.headers)
        assert res.status_code == 200

    responses = await asyncio.gather(
        *(client.post(f"/api/rooms/{room_id}/participants", headers=m.headers) for m in racers)
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses.count(200) == 1
    assert statuses.count(400) == 9  # "정원이 마감되었습니다" — 5xx 없음
    assert await participant_count(engine, room_id) == 4


# AC-18-2: 같은 회원이 서로 다른 방 2개에 동시 참가 → 현재 참가 1건, 나머지는 400(500 아님)
async def test_same_member_two_rooms_concurrently(client, make_member, engine):
    host1, host2, player = [await make_member(f"tw{i:02d}") for i in range(3)]
    room1 = await create_room(client, host1)
    room2 = await create_room(client, host2)

    responses = await asyncio.gather(
        client.post(f"/api/rooms/{room1}/participants", headers=player.headers),
        client.post(f"/api/rooms/{room2}/participants", headers=player.headers),
    )

    assert sorted(r.status_code for r in responses) == [200, 400]
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT count(*) FROM participations WHERE user_id = :id"), {"id": player.id}
        )
        assert result.scalar_one() == 1


# 같은 회원이 같은 방에 동시에 두 번(연타) → 둘 다 200, 참가는 1건 (잠금 뒤 읽기, D-006)
async def test_same_member_same_room_double_click(client, make_member, engine):
    host, player = await make_member("dc00"), await make_member("dc01")
    room_id = await create_room(client, host)

    responses = await asyncio.gather(
        *(
            client.post(f"/api/rooms/{room_id}/participants", headers=player.headers)
            for _ in range(2)
        )
    )

    assert [r.status_code for r in responses] == [200, 200]
    assert await participant_count(engine, room_id) == 2  # 방장 + player


# AC-18-4: 방장이 게임 시작을 5번 동시에 → 성공 1건, 해산 1회
async def test_start_game_concurrently(client, make_member, engine):
    host, *others = [await make_member(f"sg{i:02d}") for i in range(4)]
    room_id = await create_room(client, host)
    for member in others:
        await client.post(f"/api/rooms/{room_id}/participants", headers=member.headers)

    responses = await asyncio.gather(
        *(client.post(f"/api/rooms/{room_id}/start", headers=host.headers) for _ in range(5))
    )

    assert sorted(r.status_code for r in responses).count(200) == 1
    assert all(r.status_code < 500 for r in responses)
    assert await participant_count(engine, room_id) == 0


# 잠금 대기 상한(AD-02): 다른 트랜잭션이 방을 오래 잡고 있으면 409(바빠서 거절)
async def test_lock_timeout_returns_409(client, make_member, engine):
    host, player = await make_member("lt00"), await make_member("lt01")
    room_id = await create_room(client, host)

    async with engine.connect() as conn:
        trans = await conn.begin()
        # psql에서 BEGIN; SELECT ... FOR UPDATE; 하고 놔두는 것과 같다 (VC-08 재현 방법)
        await conn.execute(text("SELECT id FROM rooms WHERE id = :id FOR UPDATE"), {"id": room_id})
        res = await client.post(f"/api/rooms/{room_id}/participants", headers=player.headers)
        await trans.rollback()

    assert res.status_code == 409
    assert await participant_count(engine, room_id) == 1