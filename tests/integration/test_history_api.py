"""이용 이력·보관 정보 API 통합 테스트: AC-13, AC-14, NFR-07 (TEST_DATABASE_URL 필요)."""

import httpx
from conftest import auth_header


async def create_room(client: httpx.AsyncClient, user_id: int, title: str = "방") -> int:
    response = await client.post("/api/rooms", json={"title": title}, headers=auth_header(user_id))
    assert response.status_code == 200, response.text
    return response.json()["id"]


async def join(client: httpx.AsyncClient, room_id: int, user_id: int) -> None:
    response = await client.post(f"/api/rooms/{room_id}/participants", headers=auth_header(user_id))
    assert response.status_code == 200, response.text


async def leave(client: httpx.AsyncClient, room_id: int, user_id: int) -> None:
    response = await client.delete(
        f"/api/rooms/{room_id}/participants/me", headers=auth_header(user_id)
    )
    assert response.status_code == 200, response.text


async def get_history(client: httpx.AsyncClient, user_id: int, query: str = "") -> httpx.Response:
    return await client.get(f"/api/me/room-history?{query}", headers=auth_header(user_id))


async def get_archived(client: httpx.AsyncClient, user_id: int, room_id: int) -> httpx.Response:
    return await client.get(f"/api/me/room-history/{room_id}", headers=auth_header(user_id))


# --- US-13 이용 이력 ---


async def test_ac_13_1_history_newest_first_with_current(client, make_users):
    me, host = await make_users(2)
    first = await create_room(client, me, "첫 방")
    await leave(client, first, me)
    second = await create_room(client, me, "둘째 방")
    await leave(client, second, me)
    current = await create_room(client, host, "지금 방")
    await join(client, current, me)

    response = await get_history(client, me)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["room_id"] for item in body["items"]] == [current, second, first]
    now = body["items"][0]
    assert now["is_current"] is True and now["left_at"] is None
    assert all(item["left_at"] is not None for item in body["items"][1:])


async def test_ac_13_2_other_members_history_not_visible(client, make_users):
    me, other = await make_users(2)
    others_room = await create_room(client, other, "남의 방")
    await leave(client, others_room, other)

    body = (await get_history(client, me)).json()
    assert body["total"] == 0 and body["items"] == []


async def test_ac_13_3_rejoin_same_room_creates_two_records(client, make_users):
    me, host = await make_users(2)
    room_id = await create_room(client, host)
    await join(client, room_id, me)
    await leave(client, room_id, me)
    await join(client, room_id, me)

    items = (await get_history(client, me)).json()["items"]
    assert [item["room_id"] for item in items] == [room_id, room_id]
    # 다시 들어온 참가(현재)와 이전 참가(이용 로그)가 따로 보인다 (D-025)
    assert items[0]["is_current"] is True and items[1]["is_current"] is False


async def test_ac_13_5_history_item_has_no_record_id(client, make_users):
    me, host = await make_users(2)
    room_id = await create_room(client, host)
    await join(client, room_id, me)
    await leave(client, room_id, me)
    await join(client, room_id, me)

    items = (await get_history(client, me)).json()["items"]
    fields = {"room_id", "room_title", "joined_at", "left_at", "is_current", "room_deleted"}
    assert all(set(item) == fields for item in items)


async def test_ac_13_4_history_size_51_is_422(client, make_users):
    (me,) = await make_users(1)
    response = await get_history(client, me, "size=51")
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


async def test_nfr_07_history_default_10_newest(client, make_users):
    (me,) = await make_users(1)
    rooms = []
    for n in range(11):
        room_id = await create_room(client, me, f"방 {n}")
        await leave(client, room_id, me)
        rooms.append(room_id)

    body = (await get_history(client, me)).json()
    assert body["total"] == 11 and body["size"] == 10
    assert [item["room_id"] for item in body["items"]] == list(reversed(rooms))[:10]
    second = (await get_history(client, me, "page=2")).json()
    assert [item["room_id"] for item in second["items"]] == [rooms[0]]


# --- US-14 보관 정보 ---


async def test_ac_14_1_archived_room_shows_only_my_records(client, make_users):
    me, other = await make_users(2)
    room_id = await create_room(client, me, "지난 방")
    await join(client, room_id, other)
    await leave(client, room_id, other)
    await leave(client, room_id, me)

    response = await get_archived(client, me, room_id)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"room_id", "title", "capacity", "created_at", "deleted_at", "my_records"}
    assert body["title"] == "지난 방" and body["capacity"] == 4
    assert body["deleted_at"] is not None
    assert len(body["my_records"]) == 1
    assert set(body["my_records"][0]) == {"joined_at", "left_at"}
    assert "회원02" not in response.text  # 다른 회원 닉네임 없음


async def test_ac_14_1_dissolved_room_is_archived(client, make_users):
    users = await make_users(4)
    room_id = await create_room(client, users[0], "해산된 방")
    for user_id in users[1:]:
        await join(client, room_id, user_id)
    start = await client.post(f"/api/rooms/{room_id}/start", headers=auth_header(users[0]))
    assert start.status_code == 200

    response = await get_archived(client, users[2], room_id)
    assert response.status_code == 200
    assert response.json()["title"] == "해산된 방"


async def test_ac_14_2_never_joined_deleted_room_is_404(client, make_users):
    me, other = await make_users(2)
    room_id = await create_room(client, other)
    await leave(client, room_id, other)

    response = await get_archived(client, me, room_id)
    assert response.status_code == 404
    assert isinstance(response.json()["detail"], str)


async def test_ac_14_2_active_room_is_not_archived(client, make_users):
    """삭제되지 않은 방은 참가 중이어도 보관 정보가 아니다(US-14는 삭제 방 대상)."""
    (me,) = await make_users(1)
    room_id = await create_room(client, me)
    assert (await get_archived(client, me, room_id)).status_code == 404
