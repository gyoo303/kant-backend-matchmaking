# 2vs2 매치메이킹 API 명세서 v1 (M4 인증 · 방 도메인)

- 문서 버전: `0.1.0`
- 근거: API 명세 회의 메모, DB 스키마(`docs/02-arch/03-db-schema.md`)
- 범위: 회의에서 다룬 API 9개
  - 인증 4개: 회원가입, 토큰 발급, 토큰 만료, 로그인 확인
  - 방 5개: 방 생성, 방 참가, 방 제목 변경, 팀 변경, 방 나가기

---

## 0. 공통 규칙

### 0.1 API 목록

| API-ID | 기능분류 | 기능명 | Method | API Path |
|---|---|---|---|---|
| API-AUTH-01 | 인증 | 회원가입 | `POST` | `/v1/signup` |
| API-AUTH-02 | 인증 | 토큰 발급(로그인) | `POST` | `/v1/issue_token` |
| API-AUTH-03 | 인증 | 토큰 만료(로그아웃) | `POST` | `/v1/expire_token` |
| API-AUTH-04 | 인증 | 로그인 확인 | `GET` | `/v1/check_login` |
| API-ROOM-01 | 방 | 방 생성 | `POST` | `/v1/create_room` |
| API-ROOM-02 | 방 | 방 참가 | `POST` | `/v1/join_room` |
| API-ROOM-03 | 방 | 방 제목 변경 | `PATCH` | `/v1/change_room_name` |
| API-ROOM-04 | 방 | 팀 변경 | `PATCH` | `/v1/change_team` |
| API-ROOM-05 | 방 | 방 나가기 | `POST` | `/v1/left` |

### 0.2 공통 헤더

**요청**

| 헤더 | 값 | 언제 |
|---|---|---|
| `Content-Type` | `application/json` | Body가 있는 요청. 단 토큰 발급은 `application/x-www-form-urlencoded`(§API-AUTH-02) |
| `Authorization` | `Bearer <access_token>` | 회원가입·토큰 발급을 뺀 모든 API |

**응답**

| 헤더 | 값 | 언제 |
|---|---|---|
| `Content-Type` | `application/json` | 모든 응답 |
| `WWW-Authenticate` | `Bearer` | 401 응답 |

### 0.3 상태 코드와 오류 Body

- 상태 코드는 Body가 아니라 **HTTP 응답의 상태 줄**로 전달한다. Body에 `상태코드` 필드를 따로 두지 않는다.
- 오류 Body는 모두 같은 모양이다.

```json
{ "detail": "정원이 마감되었습니다" }
```

| 코드 | 뜻 |
|---|---|
| `200` | 성공 |
| `400` | 규칙 위반 (정원 마감, 방장 아님, 형식 오류 등) |
| `401` | 토큰 없음·만료·로그아웃된 토큰 |
| `404` | 방이 없음 |
| `422` | 필수 필드 누락, 타입이 다름 (예: `room_id`에 문자열) |

### 0.4 회의 메모에서 바꾼 공통 원칙

1. **로그인한 회원은 토큰으로 알아낸다.** `user_id`·`host_user_id`를 클라이언트가 보내면 남의 ID로 요청할 수 있다. 서버가 `Authorization` 헤더의 토큰에서 회원을 찾는다.
2. **시각·순서·팀 배정은 서버가 정한다.** 다음 값은 요청 Body에 넣지 않는다.
   - `created_at`, `joined_at`, `left_at`(서버의 현재 시각)
   - `join_order`, `last_join_order`
   - 참가 시 `team`
3. **응답은 "DB에 넣을 형식"이 아니라 "화면이 쓸 형식"이다.** `rooms`·`participations` 행을 만드는 일은 서버 안에서 끝난다. 응답에는 화면이 다음 동작에 필요한 값만 담는다.
4. **응답에 넣지 않는 값**
   - `hashed_password`
   - `join_order`: 입장 순서는 화면에 보이지 않는다. 방장 위임에만 쓴다.
5. **시각 형식**: ISO 8601, 시간대 포함 (예: `"2026-10-29T10:30:00+09:00"`)

---

## 1. 인증

### API-AUTH-01 회원가입

| 항목 | 내용 |
|---|---|
| 기능분류 | 인증 |
| 기능명 | 회원가입 |
| 기능 요약 | 방문자가 아이디·닉네임·비밀번호로 가입한다 |
| API Path | `/v1/signup` |
| HTTP Method | `POST` |
| 인증 | 필요 없음 |

**요청 상세**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "login_id": "gamer01",
  "nickname": "게이머",
  "password": "password123"
}
```

| 필드 | 타입 | 필수 | 제약·설명 | DB 컬럼 |
|---|---|---|---|---|
| `login_id` | string | Y | 4~20자 영문 소문자·숫자, 중복 불가 | `users.login_id` |
| `nickname` | string | Y | 2~12자 한글·영문·숫자, 중복 불가 | `users.nickname` |
| `password` | string | Y | 8자 이상. 서버가 bcrypt 해시로 저장 | `users.hashed_password` |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "id": 15,
  "login_id": "gamer01",
  "nickname": "게이머",
  "created_at": "2026-10-29T10:30:00+09:00"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | integer | 회원 ID (`users.id`) |
| `login_id` | string | 아이디 |
| `nickname` | string | 닉네임 |
| `created_at` | string(datetime) | 가입 시각 |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `400` | 아이디 형식 위반 | `{"detail": "아이디는 4~20자의 영문 소문자와 숫자만 쓸 수 있습니다"}` |
| `400` | 닉네임 형식 위반 | `{"detail": "닉네임은 2~12자의 한글, 영문, 숫자만 쓸 수 있습니다"}` |
| `400` | 비밀번호 8자 미만 | `{"detail": "비밀번호는 8자 이상이어야 합니다"}` |
| `400` | 아이디 중복 | `{"detail": "이미 사용 중인 아이디입니다"}` |
| `400` | 닉네임 중복 | `{"detail": "이미 사용 중인 닉네임입니다"}` |
| `422` | 필드 누락 | `{"detail": "login_id: Field required"}` |

> 회의 메모 반영: `detail: wrong id / wrong nickname`을 위반한 규칙마다 구체적인 문구로 나눴다.

---

### API-AUTH-02 토큰 발급(로그인)

| 항목 | 내용 |
|---|---|
| 기능분류 | 인증 |
| 기능명 | 토큰 발급(로그인) |
| 기능 요약 | 회원이 아이디·비밀번호로 로그인해 access·refresh 토큰을 받는다 |
| API Path | `/v1/issue_token` |
| HTTP Method | `POST` |
| 인증 | 필요 없음 |

**요청 상세**

Header

```json
{ "Content-Type": "application/x-www-form-urlencoded" }
```

Body (폼 형식)

```
username=gamer01&password=password123
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `username` | string | Y | 아이디(`login_id`). OAuth2 표준이라 이름이 `username`이다 |
| `password` | string | Y | 비밀번호 |

> JSON이 아니라 폼 형식인 이유: OAuth2 표준 로그인(`OAuth2PasswordRequestForm`, 교안 6장)이다. 이 형식이어야 Swagger UI의 **Authorize** 버튼으로 바로 로그인할 수 있다.

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `access_token` | string | API 호출용 JWT (유효 30분) |
| `refresh_token` | string | 토큰 만료(로그아웃)·재발급용 JWT (유효 7일) |
| `token_type` | string | 항상 `"bearer"` |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `401` | 아이디가 없거나 비밀번호가 틀림 | `{"detail": "아이디 또는 비밀번호가 올바르지 않습니다"}` |
| `422` | 필드 누락 | `{"detail": "username: Field required"}` |

> 회의 메모 반영
> - `토큰` → `access_token`·`refresh_token` 두 개로 나눴다. refresh 토큰은 로그아웃할 때 필요하다.
> - `발행시간`은 응답에 따로 넣지 않았다. 발행·만료 시각은 JWT 안(`iat`·`exp`)에 들어 있다. 화면에서 꼭 필요하면 `expires_in`(초) 필드 추가를 검토한다.
> - 아이디가 없을 때와 비밀번호가 틀릴 때 같은 문구를 쓴다. 문구가 다르면 어떤 아이디가 가입돼 있는지 알려 주게 된다.

---

### API-AUTH-03 토큰 만료(로그아웃)

| 항목 | 내용 |
|---|---|
| 기능분류 | 인증 |
| 기능명 | 토큰 만료(로그아웃) |
| 기능 요약 | 로그아웃하면 그 토큰을 블랙리스트에 넣어 다시 쓰지 못하게 한다 (US-10) |
| API Path | `/v1/expire_token` |
| HTTP Method | `POST` |
| 인증 | 필요 (access 토큰) |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{ "refresh_token": "eyJhbGciOiJIUzI1NiIs..." }
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `refresh_token` | string | Y | 로그인 때 받은 refresh 토큰. access 토큰(헤더)과 함께 둘 다 `token_blacklist`에 저장된다 |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{ "message": "로그아웃되었습니다" }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `message` | string | 안내 문구 |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `401` | 헤더의 access 토큰이 없음·만료·이미 로그아웃됨 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |
| `400` | Body의 refresh 토큰이 잘못됐거나 만료됨 | `{"detail": "유효하지 않거나 이미 만료된 토큰입니다"}` |
| `400` | 이미 로그아웃한 refresh 토큰 | `{"detail": "이미 로그아웃 처리된 토큰입니다"}` |

> 회의 메모 반영
> - 전송 데이터 `토큰`을 access(헤더)와 refresh(Body)로 나눴다. 둘 다 막아야 로그아웃 뒤 재발급으로 다시 들어오는 것을 막을 수 있다.
> - 반환 데이터 `{상태코드}`는 HTTP 상태 줄로 대신하고, Body에는 안내 문구를 넣었다.
> - 로그아웃해도 참가 중인 방에서 나가지는 않는다.

---

### API-AUTH-04 로그인 확인

| 항목 | 내용 |
|---|---|
| 기능분류 | 인증 |
| 기능명 | 로그인 확인 |
| 기능 요약 | 토큰이 유효한지 확인하고, 유효하면 내 회원 정보를 돌려준다 |
| API Path | `/v1/check_login` |
| HTTP Method | `GET` |
| 인증 | 필요 (access 토큰) |

**요청 상세**

Header

```json
{ "Authorization": "Bearer <access_token>" }
```

Body: 없음

**응답 상세 — 성공 `200`** (토큰이 유효함)

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "id": 15,
  "login_id": "gamer01",
  "nickname": "게이머",
  "created_at": "2026-10-29T10:30:00+09:00"
}
```

필드는 API-AUTH-01 성공 응답과 같다.

**응답 상세 — 오류**

회의 메모의 토큰 상태 세 가지에 맞춘 결과다.

| 토큰 상태 | 코드 | Body |
|---|---|---|
| 없음 (`Authorization` 헤더 없음) | `401` | `{"detail": "Not authenticated"}` |
| 있는데 만료됨·위조됨·로그아웃됨 | `401` | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |
| 있고 유효함 | `200` | 위 성공 Body |

> 회의 메모 반영
> - "로그인하지 않은 요청 막기"는 실제로는 **모든 회원 전용 API가 같은 검사를 한다.** 서버 공통 의존성(`get_current_user`)이 토큰 해독 → 블랙리스트 확인 → 회원 조회 순서로 검사한다.
> - 이 API는 화면이 "지금 로그인 상태인가, 닉네임이 뭔가"를 확인할 때 쓰는 용도다.

---

## 2. 방

### 방 응답 공통 형식 `RoomDetail`

방 생성·참가 응답에 쓴다.

```json
{
  "id": 9,
  "title": "시연 방",
  "capacity": 4,
  "current_count": 2,
  "is_full": false,
  "host_user_id": 15,
  "participants": [
    { "user_id": 15, "nickname": "게이머", "team": "A", "is_host": true },
    { "user_id": 16, "nickname": "친구", "team": "B", "is_host": false }
  ],
  "my_team": "B",
  "am_i_host": false,
  "created_at": "2026-10-29T10:30:00+09:00"
}
```

| 필드 | 타입 | 설명 | DB 근거 |
|---|---|---|---|
| `id` | integer | 방 ID | `rooms.id` |
| `title` | string | 방 제목 (앞뒤 공백 제거, 1~20자) | `rooms.title` |
| `capacity` | integer | 정원, 항상 4 | `rooms.capacity` |
| `current_count` | integer | 현재 참가 인원 | `participations` 중 `left_at IS NULL` 개수 |
| `is_full` | boolean | 정원 마감 여부 | `current_count == capacity` |
| `host_user_id` | integer | 현재 방장 회원 ID | `rooms.host_user_id` |
| `participants` | array | 현재 참가자. A팀 먼저, 같은 팀 안에서는 입장 순서 | `participations` + `users.nickname` |
| `participants[].user_id` | integer | 회원 ID | `participations.user_id` |
| `participants[].nickname` | string | 닉네임 | `users.nickname` |
| `participants[].team` | string | `"A"` 또는 `"B"` | `participations.team` |
| `participants[].is_host` | boolean | 방장 여부 | `user_id == rooms.host_user_id` |
| `my_team` | string \| null | 요청한 회원의 팀, 참가자가 아니면 `null` | |
| `am_i_host` | boolean | 요청한 회원이 방장인지 | |
| `created_at` | string(datetime) | 방 생성 시각 | `rooms.created_at` |

---

### API-ROOM-01 방 생성

| 항목 | 내용 |
|---|---|
| 기능분류 | 방 |
| 기능명 | 방 생성 |
| 기능 요약 | 회원이 제목만 입력해 방을 만들고, 만든 사람이 방장으로 A팀에 들어간다 |
| API Path | `/v1/create_room` |
| HTTP Method | `POST` |
| 인증 | 필요 |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{ "title": "  시연 방  " }
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `title` | string | Y | 앞뒤 공백을 뺀 뒤 1~20자. 서버가 공백을 다듬어 저장한다 |

**서버가 정하는 값** (요청에 넣지 않음)

| 테이블 | 컬럼 | 값 |
|---|---|---|
| `rooms` | `title` | 다듬은 제목 |
| `rooms` | `capacity` | `4` |
| `rooms` | `host_user_id` | 토큰의 회원 ID |
| `rooms` | `last_join_order` | `1` |
| `rooms` | `created_at` | 서버 현재 시각 |
| `participations` | `room_id` | 방금 만든 `rooms.id` |
| `participations` | `user_id` | 토큰의 회원 ID |
| `participations` | `join_order` | `1` |
| `participations` | `team` | `"A"` |
| `participations` | `joined_at` | 서버 현재 시각 |

두 행은 **한 트랜잭션**으로 저장한다. `rooms` 행을 먼저 넣어 `id`를 받고, 그 값을 `participations.room_id`에 쓴다.

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body: `RoomDetail` (위 공통 형식). 이때 `current_count`는 1, `my_team`은 `"A"`, `am_i_host`는 `true`다.

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `400` | 제목이 비었거나 20자 초과 | `{"detail": "방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다"}` |
| `400` | 이미 다른 방에 참가 중 | `{"detail": "이미 다른 방에 참가 중입니다"}` |
| `401` | 토큰 문제 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |
| `422` | `title` 누락 | `{"detail": "title: Field required"}` |

> 회의 메모 반영
> - 전송 데이터의 `user.user_id`·`room.created_at`·`join_order(=1)`은 서버가 정하는 값으로 옮겼다.
> - 회의에서 정리한 `rooms`·`participations` 행 항목은 위 "서버가 정하는 값" 표로 남겼다.
> - 응답은 화면이 바로 방 상세로 넘어갈 수 있게 방 정보로 돌려준다.

---

### API-ROOM-02 방 참가

| 항목 | 내용 |
|---|---|
| 기능분류 | 방 |
| 기능명 | 방 참가 |
| 기능 요약 | 회원이 빈자리가 있는 방에 참가한다. 팀은 서버가 자동으로 배정한다 |
| API Path | `/v1/join_room` |
| HTTP Method | `POST` |
| 인증 | 필요 |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{ "room_id": 9 }
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `room_id` | integer | Y | 참가할 방 ID |

**서버 검사 순서** (회의 메모의 조건)

1. 방이 있는가 → 없으면 `404`
2. 삭제(해산)된 방인가 → `400`
3. 이미 이 방에 참가 중인가 → 오류 없이 현재 상태를 그대로 돌려준다
4. 다른 방에 참가 중인가 → `400`
5. 정원(4명)이 찼는가 → `400`

**서버가 정하는 값**

| 테이블 | 컬럼 | 값 |
|---|---|---|
| `rooms` | `last_join_order` | 기존 값 + 1 |
| `participations` | `join_order` | 새 `last_join_order` |
| `participations` | `team` | 인원이 적은 팀, 같으면 `"A"` |
| `participations` | `joined_at` | 서버 현재 시각 |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body: `RoomDetail`. 배정된 팀은 `my_team`에 들어 있다.

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `404` | 없는 방 | `{"detail": "방을 찾을 수 없습니다"}` |
| `400` | 삭제(해산)된 방 | `{"detail": "이미 삭제된 방입니다"}` |
| `400` | 다른 방에 참가 중 | `{"detail": "이미 다른 방에 참가 중입니다"}` |
| `400` | 정원 마감 | `{"detail": "정원이 마감되었습니다"}` |
| `401` | 토큰 문제 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |
| `422` | `room_id` 누락 또는 숫자가 아님 | `{"detail": "room_id: Field required"}` |

> 회의 메모 반영
> - **"이 시점에서 team 정보를 못 받는 게 맞는지?"** 맞다. 참가할 때는 서버가 팀을 정한다. 이후 회원이 팀을 옮기면 API-ROOM-04가 `participations.team`을 바꾼다. 참가 응답에는 배정 결과와 방 전체 팀 구성이 들어 있다.
> - **"room_id를 못 넘겨받는 경우가 가능한가?"** 가능하다. 두 경우를 나눠 처리한다.
>   - Body에서 빠졌거나 숫자가 아니면 FastAPI가 `422`를 낸다.
>   - 숫자지만 없는 방이면 `404`를 낸다.

---

### API-ROOM-03 방 제목 변경

| 항목 | 내용 |
|---|---|
| 기능분류 | 방 |
| 기능명 | 방 제목 변경 |
| 기능 요약 | 방장이 방 제목을 바꾼다 |
| API Path | `/v1/change_room_name` |
| HTTP Method | `PATCH` |
| 인증 | 필요 (방장만) |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{
  "room_id": 9,
  "title": "초보 환영"
}
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `room_id` | integer | Y | 바꿀 방 ID |
| `title` | string | Y | 새 제목. 앞뒤 공백을 뺀 뒤 1~20자 |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "room_id": 9,
  "title": "초보 환영"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `room_id` | integer | 방 ID |
| `title` | string | 바뀐 제목 (`rooms.title`) |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `404` | 없는 방 | `{"detail": "방을 찾을 수 없습니다"}` |
| `400` | 삭제된 방 | `{"detail": "이미 삭제된 방입니다"}` |
| `400` | 요청한 회원이 방장이 아님 | `{"detail": "방장만 할 수 있습니다"}` |
| `400` | 제목 규칙 위반 | `{"detail": "방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다"}` |
| `401` | 토큰 문제 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |

> 회의 메모 반영: 전송 데이터의 `host_user_id`·`user_id`를 뺐다. 서버가 토큰의 회원과 `rooms.host_user_id`를 비교해 방장인지 확인한다. 클라이언트가 방장 ID를 보내면 위조할 수 있다.

---

### API-ROOM-04 팀 변경

| 항목 | 내용 |
|---|---|
| 기능분류 | 방 |
| 기능명 | 팀 변경 |
| 기능 요약 | 참가자가 자기 팀을 A 또는 B로 바꾼다 |
| API Path | `/v1/change_team` |
| HTTP Method | `PATCH` |
| 인증 | 필요 (그 방의 참가자만) |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{
  "room_id": 9,
  "team": "B"
}
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `room_id` | integer | Y | 방 ID |
| `team` | string | Y | `"A"` 또는 `"B"`만 허용. 다른 값이면 `422` |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body

```json
{
  "room_id": 9,
  "team": "B"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `room_id` | integer | 방 ID |
| `team` | string | 바뀐 내 팀 (`participations.team`). 이미 그 팀이면 그대로 돌려준다 |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `404` | 없는 방 | `{"detail": "방을 찾을 수 없습니다"}` |
| `400` | 삭제된 방 | `{"detail": "이미 삭제된 방입니다"}` |
| `400` | 이 방의 참가자가 아님 | `{"detail": "이 방의 참가자가 아닙니다"}` |
| `400` | 옮길 팀이 이미 2명 | `{"detail": "선택한 팀의 정원이 찼습니다"}` |
| `422` | `team`이 A·B가 아님 | `{"detail": "team: Input should be 'A' or 'B'"}` |

> 회의 메모 반영
> - 전송 데이터의 `user_id`는 토큰으로 대신했다.
> - `participations.team`은 요청 필드 `team`(옮길 팀)으로 바꿨다.

---

### API-ROOM-05 방 나가기

| 항목 | 내용 |
|---|---|
| 기능분류 | 방 |
| 기능명 | 방 나가기 |
| 기능 요약 | 참가자가 방을 나간다. 방장이 나가면 다음 사람에게 방장을 넘기고, 마지막 사람이 나가면 방을 삭제한다 |
| API Path | `/v1/left` |
| HTTP Method | `POST` |
| 인증 | 필요 (그 방의 참가자만) |

**요청 상세**

Header

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>"
}
```

Body

```json
{ "room_id": 9 }
```

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| `room_id` | integer | Y | 나갈 방 ID |

**서버 처리**

| 상황 | 서버가 바꾸는 값 |
|---|---|
| 모든 경우 | `participations.left_at` = 서버 현재 시각 |
| 방장이 나감 + 남은 사람 있음 | `rooms.host_user_id` = 남은 사람 중 `join_order`가 가장 작은 회원 |
| 마지막 사람이 나감 | `rooms.deleted_at` = 현재 시각, `rooms.delete_reason` = `"EMPTY"` |

**응답 상세 — 성공 `200`**

Header

```json
{ "Content-Type": "application/json" }
```

Body (방장이 나가서 위임된 경우)

```json
{
  "room_id": 9,
  "left_at": "2026-10-29T10:45:00+09:00",
  "new_host_user_id": 16,
  "room_deleted": false,
  "deleted_at": null,
  "delete_reason": null
}
```

Body (마지막 사람이 나가 방이 삭제된 경우)

```json
{
  "room_id": 9,
  "left_at": "2026-10-29T10:50:00+09:00",
  "new_host_user_id": null,
  "room_deleted": true,
  "deleted_at": "2026-10-29T10:50:00+09:00",
  "delete_reason": "EMPTY"
}
```

| 필드 | 타입 | 설명 | DB 근거 |
|---|---|---|---|
| `room_id` | integer | 나간 방 ID | `rooms.id` |
| `left_at` | string(datetime) | 내 퇴장 시각 | `participations.left_at` |
| `new_host_user_id` | integer \| null | 방장이 바뀌었으면 새 방장 ID, 아니면 `null` | `rooms.host_user_id` |
| `room_deleted` | boolean | 이번 나가기로 방이 삭제됐는지 | `rooms.deleted_at IS NOT NULL` |
| `deleted_at` | string(datetime) \| null | 방 삭제 시각 | `rooms.deleted_at` |
| `delete_reason` | string \| null | 삭제 사유. 나가기에서는 `"EMPTY"`만 나온다 | `rooms.delete_reason` |

**응답 상세 — 오류**

| 코드 | 언제 | Body |
|---|---|---|
| `404` | 없는 방 | `{"detail": "방을 찾을 수 없습니다"}` |
| `400` | 이 방의 참가자가 아님 (두 번 나가기 포함) | `{"detail": "이 방의 참가자가 아닙니다"}` |
| `401` | 토큰 문제 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |

> 회의 메모 반영
> - 전송 데이터의 `user_id`·`left_at`·`rooms.host_user_id`·`participations.join_order`는 서버가 DB에서 읽거나 정하는 값이라 뺐다.
> - 반환 데이터는 회의에서 정한 항목(`left_at`, `room_id`, `deleted_at`, 삭제 사유)을 유지했다. 여기에 화면이 방장 표시를 바로 바꿀 수 있게 `new_host_user_id`, `room_deleted`를 더했다.
> - 메모의 `deleted_reason`은 DB 컬럼 이름에 맞춰 `delete_reason`으로 썼다.

---

## 3. 회의 질문 정리

### Q1. `participations`의 PK를 `room_id`, `user_id` 두 개로 해야 하나? (튜터님 질문)

DB 스키마는 **`id` 하나를 자동 증가 PK로** 둔다. `room_id`·`user_id`는 FK다.

- 같은 회원이 같은 방에 **나갔다가 다시 들어올 수 있다.** 재입장은 새 이용 기록·새 입장 순서다(INV-10·11).
- `(room_id, user_id)`를 PK로 하면 같은 쌍의 두 번째 행을 넣을 수 없다. 그러면 재입장 기록을 남길 수 없다.
- "한 회원은 동시에 한 방에만"이라는 규칙은 PK가 아니라 `left_at IS NULL`인 행이 회원당 하나인지로 확인한다. 지금은 도메인 코드가 검사하고, 도전 A에서는 부분 유니크 인덱스로 DB에서도 막는다.

### Q2. 참가할 때 team 정보를 못 받는 게 맞나?

맞다. API-ROOM-02 회의 메모 반영 내용을 참고한다.

### Q3. room_id를 못 넘겨받는 경우는?

누락이나 잘못된 타입은 `422`, 없는 방은 `404`다. API-ROOM-02 회의 메모 반영 내용을 참고한다.

---

## 4. 검토가 더 필요한 점

- **Path 스타일**: 이 문서는 회의에서 정한 동사형 경로(`/v1/create_room` 등)를 그대로 썼다. REST 스타일로 바꾸면 방 ID가 경로에 들어가 Body가 줄어든다. 참고 설계(`docs/02-arch/04-interfaces-api.md`)는 이 방식이다.

  | 회의 경로 | REST 스타일 |
  |---|---|
  | `POST /v1/create_room` | `POST /v1/rooms` |
  | `POST /v1/join_room` | `POST /v1/rooms/{room_id}/participants` |
  | `PATCH /v1/change_room_name` | `PATCH /v1/rooms/{room_id}` |
  | `PATCH /v1/change_team` | `PATCH /v1/rooms/{room_id}/participants/me` |
  | `POST /v1/left` | `DELETE /v1/rooms/{room_id}/participants/me` |

- **아직 명세하지 않은 API**: 방 목록(검색·필터·페이지), 방 상세 조회, 게임 시작(해산), 내 현재 방, 이용 기록·보관 정보, 토큰 재발급(refresh)
- **담당자**: 카드마다 구현 담당자를 정해 적는다.
