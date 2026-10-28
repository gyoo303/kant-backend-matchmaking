"""오류 응답 형식 통합 테스트: NFR-02 (TEST_DATABASE_URL 필요)."""


def auth_header(user_id: int) -> dict[str, str]:
    """M3 임시 인증 헤더(TKT-BE-M3-04). TKT-QA-M4-01에서 실제 토큰으로 바꾼다."""
    return {"X-Debug-User-Id": str(user_id)}


def assert_string_detail(response) -> None:
    body = response.json()
    assert set(body) == {"detail"}
    assert isinstance(body["detail"], str) and body["detail"]


async def test_nfr_02_400_detail_is_string(client, make_users):
    (user,) = await make_users(1)
    response = await client.post("/api/rooms", json={"title": "  "}, headers=auth_header(user))
    assert response.status_code == 400
    assert_string_detail(response)


async def test_nfr_02_404_detail_is_string(client, make_users):
    (user,) = await make_users(1)
    response = await client.get("/api/rooms/9999", headers=auth_header(user))
    assert response.status_code == 404
    assert_string_detail(response)


async def test_nfr_02_401_detail_is_string_with_bearer_header(client):
    response = await client.get("/api/rooms")
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"
    assert_string_detail(response)


async def test_nfr_02_422_detail_is_single_string(client, make_users):
    (user,) = await make_users(1)
    response = await client.get("/api/rooms?size=51&page=0", headers=auth_header(user))
    assert response.status_code == 422
    assert_string_detail(response)
    assert "size" in response.json()["detail"] and "page" in response.json()["detail"]


async def test_nfr_02_410_detail_is_string(client, make_users):
    users = await make_users(4)
    room = await client.post("/api/rooms", json={"title": "방"}, headers=auth_header(users[0]))
    room_id = room.json()["id"]
    for user_id in users[1:]:
        await client.post(f"/api/rooms/{room_id}/participants", headers=auth_header(user_id))
    await client.post(f"/api/rooms/{room_id}/start", headers=auth_header(users[0]))
    response = await client.get(f"/api/rooms/{room_id}", headers=auth_header(users[0]))
    assert response.status_code == 410
    assert_string_detail(response)
