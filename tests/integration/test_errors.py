# 오류 응답 형식 통합 테스트 — 모든 오류 본문은 {"detail": "문자열"} (D-027, 06 §2 순위 4)

import pytest


def assert_string_detail(res, status: int) -> None:
    assert res.status_code == status
    assert set(res.json()) == {"detail"}
    assert isinstance(res.json()["detail"], str)


async def test_400_domain_rule(client, make_member):
    member = await make_member("player01")

    res = await client.post("/api/rooms", json={"title": "   "}, headers=member.headers)

    assert_string_detail(res, 400)


async def test_404_not_found(client, make_member):
    member = await make_member("player01")

    assert_string_detail(await client.get("/api/rooms/999", headers=member.headers), 404)


async def test_410_dissolved_room(client, make_member):
    host, *others = [await make_member(f"player0{i}") for i in range(1, 5)]
    created = await client.post("/api/rooms", json={"title": "방"}, headers=host.headers)
    room_id = created.json()["id"]
    for m in others:
        await client.post(f"/api/rooms/{room_id}/participants", headers=m.headers)
    await client.post(f"/api/rooms/{room_id}/start", headers=host.headers)

    assert_string_detail(await client.get(f"/api/rooms/{room_id}", headers=host.headers), 410)


@pytest.mark.parametrize("query", ["size=51", "size=0", "page=0", "sort=random"])
async def test_422_validation_is_string(client, make_member, query):
    member = await make_member("player01")

    assert_string_detail(await client.get(f"/api/rooms?{query}", headers=member.headers), 422)
