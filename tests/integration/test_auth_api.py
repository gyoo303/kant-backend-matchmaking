# auth API 통합 테스트 — US-08~11 (테스트 이름 규칙: test_<ac_id>_<요약>, 06 §3)

from httpx import AsyncClient


async def test_ac_08_1_signup_hides_password(client: AsyncClient):
    res = await client.post(
        "/api/auth/signup",
        json={"login_id": "player01", "nickname": "용감한고양이", "password": "password123"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["login_id"] == "player01"
    assert "password" not in body and "hashed_password" not in body


async def test_ac_08_5_duplicate_login_id_rejected(client, make_member):
    await make_member("player01")

    res = await client.post(
        "/api/auth/signup",
        json={"login_id": "player01", "nickname": "다른닉네임", "password": "password123"},
    )

    assert res.status_code == 400
    assert res.json() == {"detail": "이미 사용 중인 아이디입니다"}


async def test_ac_09_1_login_returns_bearer_token(client, make_member):
    await make_member("player01")

    res = await client.post(
        "/api/auth/token", data={"username": "player01", "password": "password123"}
    )

    assert res.status_code == 200
    assert res.json()["token_type"] == "bearer"


async def test_ac_09_2_wrong_password_and_unknown_id_same_detail(client, make_member):
    await make_member("player01")

    wrong = await client.post("/api/auth/token", data={"username": "player01", "password": "x" * 8})
    unknown = await client.post(
        "/api/auth/token", data={"username": "nobody99", "password": "x" * 8}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


async def test_ac_10_2_logged_out_token_rejected(client, make_member):
    member = await make_member("player01")

    logout = await client.post(
        "/api/auth/logout", json={"refresh_token": member.refresh_token}, headers=member.headers
    )
    me = await client.get("/api/auth/me", headers=member.headers)

    assert logout.status_code == 200
    assert me.status_code == 401


async def test_ac_11_1_no_token_rejected(client: AsyncClient):
    assert (await client.get("/api/rooms")).status_code == 401
    assert (await client.post("/api/rooms", json={"title": "방"})).status_code == 401


async def test_ac_11_2_forged_token_rejected(client: AsyncClient):
    res = await client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})

    assert res.status_code == 401


async def test_refresh_issues_new_access_token(client, make_member):
    member = await make_member("player01")

    res = await client.post("/api/auth/refresh", json={"refresh_token": member.refresh_token})

    assert res.status_code == 200
    new_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    assert (await client.get("/api/auth/me", headers=new_headers)).status_code == 200
