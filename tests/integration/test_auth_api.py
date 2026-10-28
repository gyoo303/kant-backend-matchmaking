"""auth API 통합 테스트: AC-08~11, NFR-03, 재발급(API-AUTH-05) (TEST_DATABASE_URL 필요).

같은 회원이 같은 초에 받은 토큰은 문자열이 같다(BE 브리핑 TKT-BE-M4-01 알려진 제한).
로그아웃 뒤 새 토큰이 필요하면 1초 이상 기다린다.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import jwt
from conftest import TEST_PASSWORD, auth_header

from auth.infrastructure.repositories import TokenBlacklistRepository, UserRepository
from auth.infrastructure.security import ALGORITHM, create_refresh_token

SIGNUP = "/api/auth/signup"
LOGIN = "/api/auth/token"
LOGOUT = "/api/auth/logout"
REFRESH = "/api/auth/refresh"
ME = "/api/auth/me"


def signup_body(login_id="player01", nickname="용감한고양이", password="password1"):
    return {"login_id": login_id, "nickname": nickname, "password": password}


async def login(client, login_id: str, password: str = TEST_PASSWORD):
    return await client.post(LOGIN, data={"username": login_id, "password": password})


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- US-08 회원가입 ---


async def test_ac_08_1_signup_hides_password_and_stores_hash(client, session_factory):
    response = await client.post(SIGNUP, json=signup_body())
    body = response.json()
    assert response.status_code == 200
    assert set(body) == {"id", "login_id", "nickname", "created_at"}
    assert "password" not in response.text
    async with session_factory() as session:
        user = await UserRepository(session).find_by_login_id("player01")
    assert user.hashed_password != "password1"
    assert user.hashed_password.startswith("$2")


async def test_ac_08_2_signup_rejects_invalid_login_id(client):
    for login_id in ("Ab", "PLAYER01", "a" * 21):
        response = await client.post(SIGNUP, json=signup_body(login_id=login_id))
        assert response.status_code == 400, login_id


async def test_ac_08_3_signup_rejects_invalid_nickname(client):
    for nickname in ("가", "가" * 13, "닉네임!"):
        response = await client.post(SIGNUP, json=signup_body(nickname=nickname))
        assert response.status_code == 400, nickname


async def test_ac_08_4_signup_rejects_short_password(client):
    response = await client.post(SIGNUP, json=signup_body(password="1234567"))
    assert response.status_code == 400


async def test_ac_08_5_signup_rejects_duplicates(client):
    assert (await client.post(SIGNUP, json=signup_body())).status_code == 200
    same_id = await client.post(SIGNUP, json=signup_body(nickname="다른닉네임"))
    same_nickname = await client.post(SIGNUP, json=signup_body(login_id="player02"))
    assert same_id.status_code == 400
    assert same_nickname.status_code == 400


# --- US-09 로그인·재발급 ---


async def test_ac_09_1_login_returns_bearer_tokens(client, make_users):
    await make_users(1)
    response = await login(client, "user01")
    body = response.json()
    assert response.status_code == 200
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]


async def test_ac_09_2_login_failure_has_same_detail(client, make_users):
    await make_users(1)
    wrong_password = await login(client, "user01", "wrong-password")
    unknown_user = await login(client, "nobody99")
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"]


async def test_refresh_issues_new_access_token(client, make_users):
    await make_users(1)
    tokens = (await login(client, "user01")).json()
    response = await client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    new_access = response.json()["access_token"]
    assert (await client.get(ME, headers=bearer(new_access))).status_code == 200


async def test_refresh_rejects_access_token(client, make_users):
    await make_users(1)
    tokens = (await login(client, "user01")).json()
    response = await client.post(REFRESH, json={"refresh_token": tokens["access_token"]})
    assert response.status_code == 401


# --- US-10 로그아웃 ---


async def test_ac_10_1_logout_blacklists_tokens(client, make_users, session_factory):
    await make_users(1)
    tokens = (await login(client, "user01")).json()
    response = await client.post(
        LOGOUT,
        json={"refresh_token": tokens["refresh_token"]},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 200
    async with session_factory() as session:
        blacklist = TokenBlacklistRepository(session)
        assert await blacklist.exists(tokens["access_token"])
        assert await blacklist.exists(tokens["refresh_token"])


async def test_ac_10_2_logged_out_token_is_401_everywhere(client, make_users):
    await make_users(1)
    tokens = (await login(client, "user01")).json()
    await client.post(
        LOGOUT,
        json={"refresh_token": tokens["refresh_token"]},
        headers=bearer(tokens["access_token"]),
    )
    access = bearer(tokens["access_token"])
    assert (await client.get(ME, headers=access)).status_code == 401
    assert (await client.get("/api/rooms", headers=access)).status_code == 401
    refreshed = await client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 401


async def test_ac_10_3_logout_keeps_participation_and_host(client, make_users):
    host, guest = await make_users(2)
    room = await client.post("/api/rooms", json={"title": "방"}, headers=auth_header(host))
    room_id = room.json()["id"]
    await client.post(f"/api/rooms/{room_id}/participants", headers=auth_header(guest))
    tokens = (await login(client, "user01")).json()
    response = await client.post(
        LOGOUT,
        json={"refresh_token": tokens["refresh_token"]},
        headers=bearer(tokens["access_token"]),
    )
    assert response.status_code == 200
    detail = (await client.get(f"/api/rooms/{room_id}", headers=auth_header(guest))).json()
    assert detail["host_user_id"] == host
    assert host in {p["user_id"] for p in detail["participants"]}
    # 재로그인 후에도 같은 방에 참가 중 (AC-07-3). 같은 초의 토큰은 차단되므로 1초 기다린다.
    await asyncio.sleep(1.1)
    again = (await login(client, "user01")).json()
    mine = await client.get("/api/me/room", headers=bearer(again["access_token"]))
    assert mine.json()["room_id"] == room_id


async def test_logout_with_invalid_refresh_is_400(client, make_users):
    await make_users(1)
    tokens = (await login(client, "user01")).json()
    response = await client.post(
        LOGOUT, json={"refresh_token": "not-a-token"}, headers=bearer(tokens["access_token"])
    )
    assert response.status_code == 400


# --- US-11 비로그인 차단 ---


async def test_ac_11_1_room_api_without_token_is_401(client, make_users):
    (host,) = await make_users(1)
    room = await client.post("/api/rooms", json={"title": "방"}, headers=auth_header(host))
    room_id = room.json()["id"]
    assert (await client.get("/api/rooms")).status_code == 401
    assert (await client.post("/api/rooms", json={"title": "방"})).status_code == 401
    assert (await client.post(f"/api/rooms/{room_id}/participants")).status_code == 401


async def test_ac_11_2_expired_or_forged_token_is_401(client, make_users):
    await make_users(1)
    from config import get_settings

    expired = jwt.encode(
        {"sub": "user01", "token_type": "access", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        get_settings().jwt_secret_key,
        algorithm=ALGORITHM,
    )
    forged = jwt.encode(
        {"sub": "user01", "token_type": "access", "exp": datetime.now(UTC) + timedelta(hours=1)},
        "another-secret-key-that-is-long-enough",
        algorithm=ALGORITHM,
    )
    for token in (expired, forged, "abc.def.ghi"):
        assert (await client.get("/api/rooms", headers=bearer(token))).status_code == 401


async def test_refresh_token_cannot_call_api(client, make_users):
    await make_users(1)
    refresh = create_refresh_token({"sub": "user01"})
    assert (await client.get(ME, headers=bearer(refresh))).status_code == 401


async def test_ac_11_4_signup_and_login_need_no_token(client):
    assert (await client.post(SIGNUP, json=signup_body())).status_code == 200
    assert (await login(client, "player01", "password1")).status_code == 200


# --- NFR-03 보안 ---


async def test_nfr_03_no_password_hash_in_responses(client, make_users):
    (user,) = await make_users(1)
    signup = await client.post(SIGNUP, json=signup_body())
    me = await client.get(ME, headers=auth_header(user))
    for response in (signup, me):
        assert "hashed_password" not in response.text
        assert "$2b$" not in response.text


async def test_nfr_03_history_shows_only_own_records(client, make_users):
    first, second = await make_users(2)
    await client.post("/api/rooms", json={"title": "첫째 방"}, headers=auth_header(first))
    await client.post("/api/rooms", json={"title": "둘째 방"}, headers=auth_header(second))
    items = (await client.get("/api/me/room-history", headers=auth_header(first))).json()["items"]
    assert [item["room_title"] for item in items] == ["첫째 방"]
