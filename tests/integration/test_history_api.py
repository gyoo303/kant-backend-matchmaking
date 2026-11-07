# 이용 이력·보관 정보 API 통합 테스트 — US-13, US-14


async def create_room(client, member) -> int:
    res = await client.post("/api/rooms", json={"title": "방"}, headers=member.headers)
    return res.json()["id"]


async def leave(client, member, room_id: int) -> None:
    await client.delete(f"/api/rooms/{room_id}/participants/me", headers=member.headers)


async def test_ac_13_2_3_history_is_mine_and_rejoin_is_separate(client, make_member):
    me, other = await make_member("player01"), await make_member("player02")
    room_id = await create_room(client, other)
    for _ in range(2):  # 같은 방에 두 번 들어갔다 나온다
        await client.post(f"/api/rooms/{room_id}/participants", headers=me.headers)
        await leave(client, me, room_id)

    history = (await client.get("/api/me/room-history", headers=me.headers)).json()

    assert history["total"] == 2  # 재입장은 별도 기록, 다른 회원 기록은 없음
    assert all(item["room_id"] == room_id for item in history["items"])


async def test_ac_13_5_history_item_fields(client, make_member):
    me = await make_member("player01")
    await create_room(client, me)

    item = (await client.get("/api/me/room-history", headers=me.headers)).json()["items"][0]

    assert set(item) == {
        "room_id",
        "room_title",
        "joined_at",
        "left_at",
        "is_current",
        "room_deleted",
    }
    assert item["is_current"] is True and item["left_at"] is None


async def test_ac_14_1_archived_room_shows_only_my_record(client, make_member):
    me = await make_member("player01")
    room_id = await create_room(client, me)
    await leave(client, me, room_id)  # 마지막 1명이 나가 방 삭제

    res = await client.get(f"/api/me/room-history/{room_id}", headers=me.headers)

    assert res.status_code == 200


async def test_ac_14_2_never_joined_archived_room_404(client, make_member):
    owner, stranger = await make_member("player01"), await make_member("player02")
    room_id = await create_room(client, owner)
    await leave(client, owner, room_id)

    res = await client.get(f"/api/me/room-history/{room_id}", headers=stranger.headers)

    assert res.status_code == 404
