"""rooms API 통합 테스트: AC-01~AC-07 (TEST_DATABASE_URL 필요).

인증은 실제 access 토큰을 쓴다(conftest.auth_header, TKT-QA-M4-01에서 전환).
"""

import httpx
from conftest import auth_header

from database import Base


async def create_room(client: httpx.AsyncClient, user_id: int, title: str = "방") -> int:
    response = await client.post("/api/rooms", json={"title": title}, headers=auth_header(user_id))
    assert response.status_code == 200, response.text
    return response.json()["id"]


async def join(client: httpx.AsyncClient, room_id: int, user_id: int) -> httpx.Response:
    return await client.post(f"/api/rooms/{room_id}/participants", headers=auth_header(user_id))


async def full_room(client: httpx.AsyncClient, user_ids: list[int]) -> int:
    """user_ids[0]이 만들고 나머지가 참가한 방(A, B, A, B)."""
    room_id = await create_room(client, user_ids[0])
    for user_id in user_ids[1:]:
        assert (await join(client, room_id, user_id)).status_code == 200
    return room_id


async def history(client: httpx.AsyncClient, user_id: int) -> list[dict]:
    response = await client.get("/api/me/room-history?size=50", headers=auth_header(user_id))
    assert response.status_code == 200
    return response.json()["items"]


# --- US-01 방 생성 ---


async def test_ac_01_1_create_room_trims_title_and_sets_host(client, make_users):
    (user,) = await make_users(1)
    response = await client.post(
        "/api/rooms", json={"title": "  즐겜 방  "}, headers=auth_header(user)
    )
    body = response.json()
    assert response.status_code == 200
    assert body["title"] == "즐겜 방"
    assert body["capacity"] == 4
    assert body["host_user_id"] == user
    assert body["current_count"] == 1
    assert body["participants"][0]["team"] == "A"
    records = await history(client, user)
    assert len(records) == 1 and records[0]["left_at"] is None


async def test_ac_01_2_create_room_rejects_invalid_title(client, make_users):
    (user,) = await make_users(1)
    for title in ("   ", "가" * 21):
        response = await client.post("/api/rooms", json={"title": title}, headers=auth_header(user))
        assert response.status_code == 400
    assert await history(client, user) == []


async def test_ac_01_3_create_room_rejected_when_already_participating(client, make_users):
    (user,) = await make_users(1)
    await create_room(client, user)
    response = await client.post("/api/rooms", json={"title": "또"}, headers=auth_header(user))
    assert response.status_code == 400
    listing = await client.get("/api/rooms", headers=auth_header(user))
    assert listing.json()["total"] == 1


async def test_ac_01_4_create_room_ignores_requested_capacity(client, make_users):
    (user,) = await make_users(1)
    response = await client.post(
        "/api/rooms", json={"title": "방", "capacity": 10}, headers=auth_header(user)
    )
    assert response.status_code == 200
    assert response.json()["capacity"] == 4


async def test_ac_01_5_duplicate_titles_allowed(client, make_users):
    first_user, second_user = await make_users(2)
    first = await create_room(client, first_user, "같은 제목")
    second = await create_room(client, second_user, "같은 제목")
    assert first != second


# --- US-02 방 참가 ---


async def test_ac_02_1_join_assigns_team_b_and_order(client, make_users):
    host, guest = await make_users(2)
    room_id = await create_room(client, host)
    response = await join(client, room_id, guest)
    body = response.json()
    assert response.status_code == 200
    assert body["current_count"] == 2
    assert body["my_team"] == "B"


async def test_ac_02_2_join_assigns_team_with_fewer_members(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users[:3])
    await client.patch(
        f"/api/rooms/{room_id}/participants/me", json={"team": "B"}, headers=auth_header(users[2])
    )
    # 지금 A1·B2 → 새 참가자는 A
    response = await join(client, room_id, users[3])
    assert response.json()["my_team"] == "A"


async def test_ac_02_3_join_full_room_rejected(client, make_users):
    users = await make_users(5)
    room_id = await full_room(client, users[:4])
    response = await join(client, room_id, users[4])
    assert response.status_code == 400
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert detail.json()["current_count"] == 4


async def test_ac_02_4_join_rejected_when_in_other_room(client, make_users):
    first_host, second_host = await make_users(2)
    await create_room(client, first_host)
    other_room = await create_room(client, second_host)
    response = await join(client, other_room, first_host)
    assert response.status_code == 400


async def test_ac_02_5_join_deleted_room_rejected(client, make_users):
    host, guest = await make_users(2)
    room_id = await create_room(client, host)
    await client.delete(f"/api/rooms/{room_id}/participants/me", headers=auth_header(host))
    response = await join(client, room_id, guest)
    assert response.status_code == 400


async def test_ac_02_6_join_unknown_room_is_404(client, make_users):
    (user,) = await make_users(1)
    response = await join(client, 9999, user)
    assert response.status_code == 404


async def test_ac_02_7_join_same_room_again_keeps_records(client, make_users):
    host, guest = await make_users(2)
    room_id = await create_room(client, host)
    await join(client, room_id, guest)
    response = await join(client, room_id, guest)
    assert response.status_code == 200
    assert len(await history(client, guest)) == 1


async def test_ac_02_8_rejoin_creates_new_record(client, make_users):
    host, guest = await make_users(2)
    room_id = await create_room(client, host)
    await join(client, room_id, guest)
    await client.delete(f"/api/rooms/{room_id}/participants/me", headers=auth_header(guest))
    response = await join(client, room_id, guest)
    assert response.status_code == 200
    records = await history(client, guest)
    assert len(records) == 2
    assert records[0]["left_at"] is None and records[1]["left_at"] is not None


# --- US-03 제목 변경 ---


async def test_ac_03_1_host_renames_room(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    response = await client.patch(
        f"/api/rooms/{room_id}", json={"title": "새 제목"}, headers=auth_header(host)
    )
    assert response.status_code == 200
    assert response.json()["title"] == "새 제목"


async def test_ac_03_2_non_host_rename_rejected(client, make_users):
    host, guest = await make_users(2)
    room_id = await create_room(client, host, "원래")
    await join(client, room_id, guest)
    response = await client.patch(
        f"/api/rooms/{room_id}", json={"title": "바꿈"}, headers=auth_header(guest)
    )
    assert response.status_code == 400
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(host))
    assert detail.json()["title"] == "원래"


async def test_ac_03_3_rename_deleted_room_rejected(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    await client.delete(f"/api/rooms/{room_id}/participants/me", headers=auth_header(host))
    response = await client.patch(
        f"/api/rooms/{room_id}", json={"title": "새"}, headers=auth_header(host)
    )
    assert response.status_code == 400


async def test_ac_03_4_rename_blank_title_rejected(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    response = await client.patch(
        f"/api/rooms/{room_id}", json={"title": "   "}, headers=auth_header(host)
    )
    assert response.status_code == 400


# --- US-04 본인 팀 변경 ---


async def change_team(client, room_id, user_id, team):
    return await client.patch(
        f"/api/rooms/{room_id}/participants/me", json={"team": team}, headers=auth_header(user_id)
    )


async def test_ac_04_1_change_to_team_with_space(client, make_users):
    host, guest = await make_users(2)
    room_id = await full_room(client, [host, guest])
    response = await change_team(client, room_id, host, "B")
    assert response.status_code == 200
    assert response.json()["my_team"] == "B"


async def test_ac_04_2_change_to_full_team_rejected(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    response = await change_team(client, room_id, users[0], "B")
    assert response.status_code == 400


async def test_ac_04_3_non_participant_change_rejected(client, make_users):
    host, outsider = await make_users(2)
    room_id = await create_room(client, host)
    response = await change_team(client, room_id, outsider, "B")
    assert response.status_code == 400


async def test_ac_04_4_invalid_team_value_is_422(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    response = await change_team(client, room_id, host, "C")
    assert response.status_code == 422


async def test_ac_04_5_change_team_in_deleted_room_rejected(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    await client.delete(f"/api/rooms/{room_id}/participants/me", headers=auth_header(host))
    response = await change_team(client, room_id, host, "B")
    assert response.status_code == 400


async def test_ac_04_6_change_to_same_team_is_noop(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    response = await change_team(client, room_id, host, "A")
    assert response.status_code == 200
    assert response.json()["my_team"] == "A"


# --- US-05 나가기·위임·빈 방 삭제 ---


async def leave(client, room_id, user_id):
    return await client.delete(
        f"/api/rooms/{room_id}/participants/me", headers=auth_header(user_id)
    )


async def test_ac_05_1_non_host_leave_keeps_host(client, make_users):
    users = await make_users(3)
    room_id = await full_room(client, users)
    response = await leave(client, room_id, users[1])
    assert response.status_code == 200
    assert response.json() == {"room_deleted": False, "new_host_user_id": None}
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert detail.json()["host_user_id"] == users[0]
    assert (await history(client, users[1]))[0]["left_at"] is not None


async def test_ac_05_2_host_leave_delegates_to_earliest(client, make_users):
    users = await make_users(3)
    room_id = await full_room(client, users)
    response = await leave(client, room_id, users[0])
    assert response.json()["new_host_user_id"] == users[1]


async def test_ac_05_3_last_leave_deletes_room_and_keeps_history(client, make_users):
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    response = await leave(client, room_id, host)
    assert response.json()["room_deleted"] is True
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(host))
    assert detail.status_code == 404
    listing = await client.get("/api/rooms", headers=auth_header(host))
    assert listing.json()["total"] == 0
    records = await history(client, host)
    assert len(records) == 1 and records[0]["room_deleted"] is True


async def test_ac_05_4_non_participant_leave_rejected(client, make_users):
    host, outsider = await make_users(2)
    room_id = await create_room(client, host)
    response = await leave(client, room_id, outsider)
    assert response.status_code == 400


async def test_ac_05_5_can_join_other_room_after_leaving(client, make_users):
    first_host, second_host = await make_users(2)
    first_room = await create_room(client, first_host)
    second_room = await create_room(client, second_host)
    await leave(client, first_room, first_host)
    response = await join(client, second_room, first_host)
    assert response.status_code == 200


# --- US-06 게임 시작(해산) ---


async def start(client, room_id, user_id):
    return await client.post(f"/api/rooms/{room_id}/start", headers=auth_header(user_id))


async def test_ac_06_1_start_game_dissolves_room_without_results(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    response = await start(client, room_id, users[0])
    assert response.status_code == 200
    assert response.json()["room_id"] == room_id
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert detail.status_code == 410
    for user_id in users:
        assert all(r["left_at"] is not None for r in await history(client, user_id))
    # 승패·결과 테이블 없음 (INV-09)
    assert set(Base.metadata.tables) == {"users", "token_blacklist", "rooms", "participations"}


async def test_ac_06_2_member_can_create_room_after_dissolve(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    await start(client, room_id, users[0])
    response = await client.post(
        "/api/rooms", json={"title": "다음"}, headers=auth_header(users[1])
    )
    assert response.status_code == 200


async def test_ac_06_3_non_host_start_rejected(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    response = await start(client, room_id, users[1])
    assert response.status_code == 400
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert detail.status_code == 200


async def test_ac_06_4_start_rejected_without_two_per_team(client, make_users):
    users = await make_users(3)
    room_id = await full_room(client, users)
    response = await start(client, room_id, users[0])
    assert response.status_code == 400
    detail = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert detail.status_code == 200


async def test_ac_06_5_restart_dissolved_room_rejected(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    await start(client, room_id, users[0])
    before = await history(client, users[0])
    response = await start(client, room_id, users[0])
    assert response.status_code == 400
    assert await history(client, users[0]) == before


async def test_ac_06_6_start_unknown_room_is_404(client, make_users):
    (user,) = await make_users(1)
    response = await start(client, 9999, user)
    assert response.status_code == 404


# --- US-07 방 상세·현재 참가 방 ---


async def test_ac_07_1_detail_has_required_fields_only(client, make_users):
    host, guest = await make_users(2)
    room_id = await full_room(client, [host, guest])
    body = (await client.get(f"/api/rooms/{room_id}", headers=auth_header(host))).json()
    assert {"title", "current_count", "capacity", "host_user_id", "participants"} <= set(body)
    for participant in body["participants"]:
        assert set(participant) == {"user_id", "nickname", "team", "is_host"}
    assert "join_order" not in str(body) and "hashed_password" not in str(body)


async def test_ac_07_2_current_room(client, make_users):
    host, outsider = await make_users(2)
    room_id = await create_room(client, host)
    mine = await client.get("/api/me/room", headers=auth_header(host))
    assert mine.json()["room_id"] == room_id
    none = await client.get("/api/me/room", headers=auth_header(outsider))
    assert none.status_code == 200
    assert none.json() == {"room_id": None, "title": None}


async def test_ac_07_3_current_room_survives_new_session(client, make_users):
    """로그아웃·재로그인은 M4. M3에서는 같은 회원의 새 요청에서도 참가 상태가 유지되는지 본다."""
    (host,) = await make_users(1)
    room_id = await create_room(client, host)
    again = await client.get("/api/me/room", headers=auth_header(host))
    assert again.json()["room_id"] == room_id


async def test_ac_07_4_dissolved_room_detail_is_410(client, make_users):
    users = await make_users(4)
    room_id = await full_room(client, users)
    await start(client, room_id, users[0])
    response = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[1]))
    assert response.status_code == 410
    assert "participants" not in response.json()


async def test_ac_07_5_unknown_room_detail_is_404(client, make_users):
    (user,) = await make_users(1)
    response = await client.get("/api/rooms/9999", headers=auth_header(user))
    assert response.status_code == 404
