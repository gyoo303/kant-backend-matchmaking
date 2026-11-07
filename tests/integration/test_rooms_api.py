# rooms API 통합 테스트 — US-01~07, US-12

from httpx import AsyncClient


async def create_room(client: AsyncClient, member, title: str = "즐겜 방") -> dict:
    res = await client.post("/api/rooms", json={"title": title}, headers=member.headers)
    assert res.status_code == 200, res.text
    return res.json()


async def join(client: AsyncClient, member, room_id: int):
    return await client.post(f"/api/rooms/{room_id}/participants", headers=member.headers)


async def full_room(client, make_member) -> tuple[dict, list]:
    """방장 + 3명 = A팀 2명, B팀 2명"""
    members = [await make_member(f"player0{i}") for i in range(1, 5)]
    room = await create_room(client, members[0])
    for m in members[1:]:
        assert (await join(client, m, room["id"])).status_code == 200
    return room, members


async def test_ac_01_1_create_room(client, make_member):
    member = await make_member("player01")

    room = await create_room(client, member, "  즐겜 방  ")

    assert room["title"] == "즐겜 방"
    assert room["capacity"] == 4
    assert room["host_user_id"] == member.id
    assert room["my_team"] == "A"


async def test_ac_01_2_invalid_title_saves_nothing(client, make_member):
    # 도메인 예외 → get_db가 rollback → 아무것도 저장되지 않음 (D-029)
    member = await make_member("player01")

    res = await client.post("/api/rooms", json={"title": "가" * 21}, headers=member.headers)
    rooms = await client.get("/api/rooms", headers=member.headers)
    current = await client.get("/api/me/room", headers=member.headers)

    assert res.status_code == 400
    assert rooms.json()["total"] == 0
    assert current.json()["room_id"] is None


async def test_ac_01_3_one_member_one_room(client, make_member):
    member = await make_member("player01")
    await create_room(client, member)

    res = await client.post("/api/rooms", json={"title": "두 번째"}, headers=member.headers)

    assert res.status_code == 400


async def test_ac_02_2_join_goes_to_team_b_when_a_full(client, make_member):
    host, second, third = [await make_member(f"player0{i}") for i in range(1, 4)]
    room = await create_room(client, host)
    await join(client, second, room["id"])

    res = await join(client, third, room["id"])

    assert res.status_code == 200
    assert res.json()["my_team"] == "B"


async def test_ac_02_3_join_full_room_rejected(client, make_member):
    room, _ = await full_room(client, make_member)
    late = await make_member("player05")

    res = await join(client, late, room["id"])

    assert res.status_code == 400
    assert res.json()["detail"] == "정원이 마감되었습니다"


async def test_ac_02_6_join_unknown_room_404(client, make_member):
    member = await make_member("player01")

    assert (await join(client, member, 999)).status_code == 404


async def test_ac_03_2_non_host_cannot_rename(client, make_member):
    host, guest = await make_member("player01"), await make_member("player02")
    room = await create_room(client, host)
    await join(client, guest, room["id"])

    res = await client.patch(
        f"/api/rooms/{room['id']}", json={"title": "새 제목"}, headers=guest.headers
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "방장만 할 수 있습니다"


async def test_ac_04_4_invalid_team_value_422(client, make_member):
    member = await make_member("player01")
    room = await create_room(client, member)

    res = await client.patch(
        f"/api/rooms/{room['id']}/participants/me", json={"team": "C"}, headers=member.headers
    )

    assert res.status_code == 422


async def test_ac_05_2_host_leaves_host_passes(client, make_member):
    host, second = await make_member("player01"), await make_member("player02")
    room = await create_room(client, host)
    await join(client, second, room["id"])

    res = await client.delete(f"/api/rooms/{room['id']}/participants/me", headers=host.headers)

    assert res.status_code == 200
    assert res.json() == {"room_deleted": False, "new_host_user_id": second.id}


async def test_ac_05_3_last_member_leaves_room_deleted(client, make_member):
    member = await make_member("player01")
    room = await create_room(client, member)

    res = await client.delete(f"/api/rooms/{room['id']}/participants/me", headers=member.headers)
    rooms = await client.get("/api/rooms", headers=member.headers)

    assert res.json()["room_deleted"] is True
    assert rooms.json()["total"] == 0


async def test_ac_06_1_start_game_dissolves_room(client, make_member):
    room, members = await full_room(client, make_member)

    res = await client.post(f"/api/rooms/{room['id']}/start", headers=members[0].headers)
    current = await client.get("/api/me/room", headers=members[1].headers)

    assert res.status_code == 200
    assert current.json()["room_id"] is None  # 모두 퇴장 처리됨


async def test_ac_06_4_start_requires_two_per_team(client, make_member):
    host, second = await make_member("player01"), await make_member("player02")
    room = await create_room(client, host)
    await join(client, second, room["id"])

    res = await client.post(f"/api/rooms/{room['id']}/start", headers=host.headers)

    assert res.status_code == 400


async def test_ac_07_1_detail_has_no_join_order_or_hash(client, make_member):
    member = await make_member("player01")
    room = await create_room(client, member)

    detail = (await client.get(f"/api/rooms/{room['id']}", headers=member.headers)).json()

    participant = detail["participants"][0]
    assert participant["nickname"]
    assert "join_order" not in participant and "hashed_password" not in participant


async def test_ac_07_5_unknown_room_404_differs_from_dissolved_410(client, make_member):
    room, members = await full_room(client, make_member)
    await client.post(f"/api/rooms/{room['id']}/start", headers=members[0].headers)

    dissolved = await client.get(f"/api/rooms/{room['id']}", headers=members[0].headers)
    unknown = await client.get("/api/rooms/999", headers=members[0].headers)

    assert (dissolved.status_code, unknown.status_code) == (410, 404)


async def test_ac_12_4_percent_is_searched_literally(client, make_member):
    first, second = await make_member("player01"), await make_member("player02")
    await create_room(client, first, "100%")
    await create_room(client, second, "100점")

    res = await client.get("/api/rooms", params={"keyword": "%"}, headers=first.headers)

    assert [item["title"] for item in res.json()["items"]] == ["100%"]
