---
stage: BE
tickets: [TKT-BE-M2-01, TKT-BE-M3-01, TKT-BE-M3-02, TKT-BE-M3-03, TKT-BE-M3-04, TKT-BE-M3-05, TKT-BE-M4-01, TKT-BE-M4-02, TKT-BE-M4-03]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-SYS, AR-API, AR-CONV, AR-GATE, AR-ADR, DB-BRIEF, PM-DOMAIN, PM-AC]
next_readers: [DB, FE, QA]
---
# 백엔드 에이전트 브리핑

## 사용자 지시 변경 (D-020·D-021, 2026-10-28) — 아래 원래 기록보다 우선
- 모든 BE 코드는 교안 1~6장 수준으로 쓴다(`AGENTS.md` 규칙 9, `05-structure-conventions.md` §8). B등급 문법(`dataclass`·`StrEnum`·`Protocol`·`clock` 주입·pydantic-settings·예외 계층·422 핸들러)은 유지했다.
- 인증은 교안 6장 1강 설계로 바뀌었다(ADR-002 개정): access(30분)·refresh(7일) 토큰, `sub`=아이디, `token_type` 클레임, `security.py`의 `create_access_token`·`create_refresh_token`·`decode_token` 함수, `POST /api/auth/refresh`, 로그아웃은 Bearer access 토큰 + 본문 refresh 토큰을 **둘 다** 블랙리스트에 넣는다, 쿠키·`jti`·`JwtTokenService`·`TokenClaims`·`IssuedToken`·`get_page_user_id` 없음. 화면 라우트는 인증하지 않는다.
- 설정: `jwt_expire_minutes`·`cookie_secure` → `access_token_expire_minutes=30`·`refresh_token_expire_days=7` (`src/config.py`, `.env.example`). 아직 이 값을 쓰는 코드는 없다(TKT-BE-M4-01에서 사용).
- 이 변경으로 바뀐 BE 파일은 `src/config.py`, `.env.example`뿐이다. 나머지는 DB 계층 파일이다(`docs/03-db/briefing.md` 맨 위).

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 | 확인 방법 |
|---|---|---|---|
| TKT-BE-M2-01 | GATE-01(`/docs` 200, DB 없이) | 충족 | `uv run uvicorn main:app --app-dir src --port 8765` 기동 → `/docs` 200, `/openapi.json` 200, 기동 오류 0 |
| | GATE-03 | 충족 | `src/` 아래 패키지 폴더 11개 모두 `__init__.py` 있음 |
| | GATE-05 | 충족 | `ruff check src` 통과, `ruff format --check src` 통과 (`tests/`는 아직 없음) |
| TKT-BE-M3-01 | GATE-02 | 충족 | 세 grep 명령 모두 0줄 |
| | GATE-07(domain 항목) | 충족 | `datetime.now`·`random.` in `src/*/domain/` 0줄, `except:` 0줄, 승패 관련 이름 0줄 |
| | INV-01~12가 메서드에 반영 | 충족 | 임시 검증 스크립트 54건 통과(아래 검증 결과) |
| TKT-BE-M3-02 | GATE-07 | 충족 | 금지 패턴 grep 0줄(잠금 조회 강제 GATE-09는 도전 A 이후) |
| | 순차 요청 기준 INV 위반 0 | 충족 | 가짜 레포지토리로 흐름 18건 확인(아래 검증 결과) |
| TKT-BE-M3-03 | GATE-08 | 충족 | `application`·`presentation`에서 Model import 0줄 |
| | 404·410 분기(D-016) | 충족 | 가짜 레포지토리로 조회 분기 12건 확인 |
| TKT-BE-M3-04 | Swagger에 API 11개 | 충족 | 라우터를 붙인 시험 앱의 OpenAPI에 API-ROOM-01~11 경로·summary 11개 |
| | 응답에 입장 순서·해시 없음 | 충족 | 상세 응답 키·참가자 키 확인(`join_order`·`hashed_password` 없음) |
| TKT-BE-M3-05 | GATE-01(시드 로그 1회) | **미확인 — 사용자 승인으로 건너뜀(2026-10-28)** | 로컬 PostgreSQL·`.env`가 없어 실제 기동·`create_all`·시드를 실행하지 못함. 아래 "설계와 다르게 한 것 / 질문" 참고 |
| TKT-BE-M4-01 | GATE-06 | 충족 | `.env` 미커밋, 비밀값 하드코딩 grep 0줄. 비밀키는 `get_settings().jwt_secret_key`로만 읽음 |
| | GATE-07 | 충족 | 금지 패턴 grep 0줄 |
| TKT-BE-M4-02 | Swagger Authorize로 로그인 성공 | 충족(임시 SQLite) | OpenAPI `securitySchemes.OAuth2PasswordBearer`(password flow, `tokenUrl=/api/auth/token`), 같은 form(`username`·`password`)으로 `/api/auth/token` 200. 브라우저 Swagger 화면은 직접 열어 보지 않음 |
| | 응답에 해시 없음 | 충족 | `signup`·`me` 응답 본문에 `hashed_password` 없음 |
| | SEQ-01~04b 동작 | 충족(임시 SQLite) | 스크립트로 가입·중복·형식 오류·로그인 실패·토큰 발급·인증·재발급·로그아웃·차단 19건 확인(아래 검증 결과). PostgreSQL 미확인 |
| TKT-BE-M4-03 | `grep -rn "X-Debug-User-Id" src/` 0줄 | 충족 | 명령 출력 0줄 |
| | 로그아웃한 access 토큰 401 | 충족(가짜 레포지토리) | 블랙리스트에 넣은 access 토큰으로 `GET /api/rooms` → 401. 실제 DB 위 확인은 못 함 |
| | AC-02-3·06-5 수동 curl 확인 | 부분 충족 | 실제 DB 대신 가짜 서비스로 400(정원 마감·삭제된 방) 응답 형식 확인. 실제 데이터 흐름은 미확인 |

## 만든 것
### TKT-BE-M4-03
- `src/auth/presentation/dependencies.py`: 임시 헤더 인증(`X-Debug-User-Id`)을 지우고 `get_current_user_id(user = Depends(get_current_user)) -> int`로 바꿨다(SEQ-03 3단계). rooms 라우터는 이름이 같아 그대로 쓴다
- 이제 rooms API 11개 모두 `Authorization: Bearer <access_token>`이 필요하다. refresh 토큰·만료·위조·블랙리스트·없는 회원 토큰은 401

### TKT-BE-M4-02
| API-ID | 메서드 | 경로 | 권한 | 성공·오류 |
|---|---|---|---|---|
| API-AUTH-01 | POST | `/api/auth/signup` | 없음 | 200 `UserResponse` / 400 형식·중복 / 422 |
| API-AUTH-02 | POST | `/api/auth/token` | 없음(form) | 200 `TokenResponse` / 401 |
| API-AUTH-03 | POST | `/api/auth/logout` | Bearer access + 본문 `RefreshRequest` | 200 `MessageResponse` / 401 / 400 잘못된 refresh |
| API-AUTH-04 | GET | `/api/auth/me` | Bearer access | 200 `UserResponse` / 401 |
| API-AUTH-05 | POST | `/api/auth/refresh` | 본문 refresh 토큰 | 200 `AccessTokenResponse` / 401 |
- `src/auth/presentation/schemas.py`: `SignupRequest`, `UserResponse`, `TokenResponse`, `RefreshRequest`, `AccessTokenResponse`, `MessageResponse` (§5.1)
- `src/auth/presentation/router.py`: `APIRouter(prefix="/api/auth", tags=["auth"])`, 서비스 팩토리 `get_auth_service`(CONV-04)
- `src/auth/presentation/dependencies.py`: 교안의 `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")`, `get_current_user`(→ `AuthApplicationService.authenticate`)를 **추가**. 기존 임시 `get_current_user_id`(X-Debug)는 그대로 둠(M4-03에서 교체)
- `src/main.py`: `app.include_router(auth_router)`

### TKT-BE-M4-01
- `src/auth/infrastructure/security.py` (교안 6장 1강 3.3절 모양): 기존 `PasswordHasher` 유지 + `create_access_token(data)`(만료 `access_token_expire_minutes`, `token_type: "access"`), `create_refresh_token(data)`(만료 `refresh_token_expire_days`, `token_type: "refresh"`), `decode_token(token)`(`jwt.decode`, HS256, pyjwt 예외 그대로 올림)
- `src/auth/application/service.py` `AuthApplicationService(db)`
  - `signup(login_id, nickname, password) -> User` (SEQ-01): 비밀번호 길이 → 아이디 중복 → 닉네임 중복 → 해시 → `User.register` → save → commit
  - `login(login_id, password) -> dict` (SEQ-02): 없는 아이디·틀린 비밀번호 모두 401 "아이디 또는 비밀번호가 올바르지 않습니다". `{"access_token", "refresh_token", "token_type": "bearer"}`, `sub` = 아이디
  - `refresh(refresh_token) -> dict` (SEQ-04b): 블랙리스트 → 401 "로그아웃 처리되어…", 디코드 실패·access 토큰·`sub` 없음 → 401 "리프레시 토큰이 만료되었습니다…"
  - `logout(access_token, refresh_token) -> None` (SEQ-04): refresh 디코드 실패 → 400 `InvalidRefreshTokenError`, 이미 차단 → 400 `AlreadyLoggedOutError`, 두 토큰 모두 블랙리스트 저장 → commit
  - `authenticate(token) -> User` (SEQ-03): 디코드 실패·refresh 토큰·`sub` 없음·블랙리스트·회원 없음 → 401 "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"
- `src/auth/domain/exceptions.py`: `InvalidRefreshTokenError`, `AlreadyLoggedOutError`(둘 다 `DomainRuleError` → 400)
- API·의존성은 아직 없다(TKT-BE-M4-02·03)

### TKT-BE-M2-01
- `pyproject.toml`: 런타임 의존성(`02-system-architecture.md` §3 그대로, `bcrypt==4.0.1` 고정), dev 그룹(pytest·pytest-asyncio·httpx·ruff), `[tool.ruff]`(ADR-005), `[tool.pytest.ini_options]`(STK-01·STK-11)
- `uv.lock`: 설치된 주요 버전 — fastapi 0.162.0, starlette 1.10.0, sqlalchemy 2.1.6, asyncpg 0.32.0, pydantic 2.14.1, pydantic-settings 2.16.1, pyjwt 2.15.1, passlib 1.7.4, bcrypt 4.0.1, jinja2 3.1.6, python-multipart 0.0.32, uvicorn 0.54.0, pytest 9.2.0, pytest-asyncio 1.4.1, httpx 0.28.1, ruff 0.17.3 (Python 3.13.14)
- 패키지 골격: `src/__init__.py`, `src/{auth,rooms}/__init__.py`, 각 기능의 `{domain,infrastructure,application,presentation}/__init__.py` (모두 빈 파일)
- `src/config.py`: `Settings(BaseSettings)` — `database_url`, `jwt_secret_key`, `seed_user_password`(필수), `jwt_expire_minutes=60`, `cors_origins=["http://localhost:8000"]`, `cookie_secure=False`, `db_pool_size=10`, `db_max_overflow=10`. `env_file=".env"`, `extra="ignore"`(STK-10). `get_settings()`는 `lru_cache`
- `src/exceptions.py`: `DomainError(ValueError)`·`DomainRuleError`·`NotFoundError`·`GoneError`, `AuthenticationError(Exception)`. 모두 `message` 속성을 가진다(`04-interfaces-api.md` §1.1)
- `src/main.py`: 최소 FastAPI 앱(제목·설명·버전). 설정·DB를 읽지 않으므로 `.env` 없이 기동된다
- `.env.example`: ADR-003의 항목 전부 + 테스트 전용 `TEST_DATABASE_URL`(주석)

### TKT-BE-M3-01
- `src/auth/domain/exceptions.py`: `InvalidLoginIdError`, `InvalidNicknameError`, `InvalidPasswordError`, `DuplicateLoginIdError`, `DuplicateNicknameError` (모두 `DomainRuleError`, 문구는 `04-interfaces-api.md` §1.2 그대로)
- `src/auth/domain/user.py`: `User`(dataclass) — `register(login_id, nickname, hashed_password)`(아이디 `[a-z0-9]{4,20}`, 닉네임 strip 후 `[가-힣A-Za-z0-9]{2,12}`), `validate_raw_password(raw)`(8자 미만 거부)
- `src/auth/domain/token_blacklist.py`: `TokenBlacklist`(frozen) — 빈 `jti` 거부, `is_expired(now)`
- `src/auth/infrastructure/security.py`: `PasswordHasher.hash(raw)`, `verify(raw, hashed)` (passlib bcrypt). JWT 부분은 TKT-BE-M4-01
- `src/rooms/domain/exceptions.py`: §1.2의 rooms 예외 11개 (`RoomNotFoundError`→`NotFoundError`, `RoomDissolvedError`→`GoneError`, 나머지 `DomainRuleError`)
- `src/rooms/domain/participation.py`: `TeamSide`(A·B), `Participation`(dataclass) — `is_current`, `change_team(team)`, `end(now)`, 생성 시 `join_order >= 1`·`left_at >= joined_at` 검사
- `src/rooms/domain/room.py`: `DeleteReason`, `RoomTitle`(`of(raw)`), `Room` — `create`, `rename`, `join`, `change_team`, `leave`, `start_game`, 조회 속성 `is_active`·`current_participants`·`current_count`·`is_full`·`available_seats`·`team_count`·`participation_of`. 거부 검사 순서는 §2.3 주석 순서 그대로(삭제 방 → 권한·참가 여부 → 정원·구성)
- `src/rooms/application/read_models.py`: `RoomListCondition`, `RoomSummary`, `ParticipantView`, `RoomDetail`, `CurrentRoom`, `HistoryItem`, `MyRecord`, `ArchivedRoom`, `RoomPage`, `HistoryPage`, `LeaveResult`, `GameStartResult` (frozen dataclass, 필드는 §5 응답 스키마와 같은 이름)

### TKT-BE-M3-05
- `src/main.py`
  - lifespan(SEQ-12): `engine.begin()`에서 `Base.metadata.create_all` → `AsyncSessionLocal()` 세션으로 `seed_initial_data` → `commit` → 종료 시 `engine.dispose()`. 테이블 등록을 위해 `auth`·`rooms`의 `infrastructure.models`를 import
  - 전역 예외 핸들러(§6, ADR-004): `DomainRuleError` 400 / `NotFoundError` 404 / `GoneError` 410 / `AuthenticationError` 401 + `WWW-Authenticate: Bearer` / `RequestValidationError` 422 `{"detail": "<loc 마지막>: <msg>; …"}`(최대 3개) / 그 밖의 `Exception` 500 `{"detail": "서버 오류가 발생했습니다"}`(스택은 로그에만)
  - 라우터 등록: rooms(`/api`). auth 라우터는 TKT-BE-M4-02
  - `logging.basicConfig(level=INFO)`: 시드 로그(`seed inserted…`/`seed skipped…`)가 콘솔에 보이도록(아래 자율 결정)

### TKT-BE-M3-04
- `src/rooms/presentation/schemas.py`: §5.2 요청 3개·응답 11개(`from_attributes=True`, 모든 필드 `Field(description)`, snake_case). 팀 값은 `Literal["A","B"]`
- `src/rooms/presentation/router.py`: `router = APIRouter(prefix="/api")`, 서비스 팩토리 `get_room_service`·`get_room_query_service`(`Depends(get_db)`, CONV-04)

| API-ID | 메서드 | 경로 | tags | 권한 | 성공 | 오류 |
|---|---|---|---|---|---|---|
| API-ROOM-01 | GET | `/api/rooms` | rooms | 로그인 | 200 `RoomListResponse` | 401, 422 |
| API-ROOM-02 | POST | `/api/rooms` | rooms | 로그인 | 200 `RoomDetailResponse` | 400, 401, 422 |
| API-ROOM-03 | GET | `/api/rooms/{room_id}` | rooms | 로그인 | 200 `RoomDetailResponse` | 401, 404, 410 |
| API-ROOM-04 | PATCH | `/api/rooms/{room_id}` | rooms | 방장 | 200 `RoomDetailResponse` | 400, 401, 404, 422 |
| API-ROOM-05 | POST | `/api/rooms/{room_id}/participants` | rooms | 로그인 | 200 `RoomDetailResponse` | 400, 401, 404 |
| API-ROOM-06 | PATCH | `/api/rooms/{room_id}/participants/me` | rooms | 참가자 본인 | 200 `RoomDetailResponse` | 400, 401, 404, 422 |
| API-ROOM-07 | DELETE | `/api/rooms/{room_id}/participants/me` | rooms | 참가자 본인 | 200 `LeaveResponse` | 400, 401, 404 |
| API-ROOM-08 | POST | `/api/rooms/{room_id}/start` | rooms | 방장 | 200 `GameStartResponse` | 400, 401, 404 |
| API-ROOM-09 | GET | `/api/me/room` | me | 로그인 | 200 `CurrentRoomResponse` | 401 |
| API-ROOM-10 | GET | `/api/me/room-history` | me | 본인 | 200 `HistoryListResponse` | 401, 422 |
| API-ROOM-11 | GET | `/api/me/room-history/{room_id}` | me | 과거 참가자 | 200 `ArchivedRoomResponse` | 401, 404 |

- 목록 `keyword`는 라우터가 strip하고 빈 문자열이면 `None`(SEQ-10). 변경 API(02·04·05·06)는 처리 후 `RoomQueryService.get_room_detail`로 상세를 다시 읽어 응답한다
- 오류 상태 코드 변환(400·401·404·410·422 형식)은 TKT-BE-M3-05의 전역 핸들러가 한다. 지금은 라우터만 있고 `main.py`에 등록하지 않았다
- `src/auth/presentation/dependencies.py`: **임시** `get_current_user_id` — 요청 헤더 `X-Debug-User-Id`(숫자)를 회원 ID로 쓰고, 없거나 숫자가 아니면 `AuthenticationError`
- `pyproject.toml`: `[tool.ruff.lint.flake8-bugbear] extend-immutable-calls`에 `fastapi.Depends`·`Query`·`Header`·`Path` 추가(아래 자율 결정)

### TKT-BE-M3-03
- `src/rooms/application/queries.py`: `RoomQueryService(db)` — commit하지 않는다

| 메서드 | 동작 | 반환·예외 |
|---|---|---|
| `list_rooms(cond)` | `RoomQueryRepository.list_active_rooms` (SEQ-10) | `RoomPage(items, total, page, size)` |
| `get_room_detail(room_id, viewer_id)` | 활성 상세 조회 → 없으면 `RoomRepository.find_by_id`로 삭제 사유 확인. 있으면 `my_team`(조회 회원의 팀)·`am_i_host`를 채움 | `RoomDetail` / 해산(GAME_STARTED) → `RoomDissolvedError`(410), 없음·EMPTY → `RoomNotFoundError`(404) |
| `get_current_room(user_id)` | 현재 참가 기록 → 그 방 | `CurrentRoom(room_id, title)` 또는 `None` |
| `list_history(user_id, page, size)` | `RoomQueryRepository.list_history` | `HistoryPage` |
| `get_archived_room(room_id, user_id)` | `RoomQueryRepository.get_archived_room` | `ArchivedRoom` / 없으면 `RoomNotFoundError`(404) |

### TKT-BE-M3-02
- `src/rooms/application/service.py`: `RoomApplicationService(db, clock=UTC 현재 시각, list_cache=None)`

| 메서드 | 흐름 (SEQ) | 반환 |
|---|---|---|
| `create_room(user_id, title)` | 현재 참가 조회 → `Room.create` → `save` → commit (SEQ-05) | `Room`(id 채워짐) |
| `join_room(room_id, user_id)` | 현재 참가 조회 → `find_by_id`(없으면 `RoomNotFoundError`) → `room.join` → `save` → commit (SEQ-06) | `Room` |
| `rename_room(room_id, user_id, title)` | `find_by_id` → `room.rename` → `save` → commit (SEQ-07) | `Room` |
| `change_team(room_id, user_id, team)` | `find_by_id` → `room.change_team` → `save` → commit (SEQ-07) | `Room` |
| `leave_room(room_id, user_id)` | `find_by_id` → 이전 방장 기억 → `room.leave` → `save` → commit (SEQ-08) | `LeaveResult(room_deleted, new_host_user_id)` |
| `start_game(room_id, user_id)` | `find_by_id` → `room.start_game` → `save` → commit (SEQ-09) | `GameStartResult(room_id, dissolved_at)` |

- 시각은 메서드마다 `self.clock()`으로 한 번 얻어 도메인에 넘긴다(CONV-06). commit은 메서드 끝에서 한 번, 성공 뒤에만 `list_cache.clear()`(도전 C 대비, 지금은 None)
- 필수 범위라 잠금 없이 `find_by_id`를 쓴다(D-018). 도전 A(TKT-BE-M6-00)에서 `find_by_id_for_update`로 바꾼다
- 해산 로그(BackgroundTasks)는 도전 B(TKT-BE-M6-01) 범위라 넣지 않았다

## 계층 확인 포인트
- TKT-BE-M4-01: 서비스는 레포지토리·`security.py`·도메인만 호출하고 직접 쿼리하지 않는다. commit은 `signup`·`logout`에서 한 번씩. 도메인 예외 파일은 외부 import 없음. 시각은 `security.py`에서만 얻는다(CONV-06)
- 도메인 코드 없음. `exceptions.py`는 외부 import 없음(GATE-02 대상 grep 0줄)
- 저장소 모델·트랜잭션: 해당 없음(이후 티켓)
- TKT-BE-M3-02: 서비스는 레포지토리·도메인만 호출하고 직접 쿼리하지 않는다. 비즈니스 판단은 모두 도메인 메서드에 있고, 서비스의 조건문은 방 없음 확인과 결과 조립(방장 변경 여부)뿐이다
- TKT-BE-M3-01: 도메인은 표준 라이브러리(`dataclasses`, `datetime`, `enum`, `re`)와 `exceptions`, 같은 기능 도메인만 import. 시각은 모두 `now` 인자로 받음. `read_models.py`는 `rooms.domain`만 참조

## 보안 확인 포인트
- TKT-BE-M4-01: 비밀번호는 bcrypt 해시만 저장. 로그인 실패는 아이디 존재 여부를 드러내지 않게 같은 문구. 토큰 원문은 블랙리스트 테이블에만 저장하고 로그에 남기지 않는다. 로그아웃은 access·refresh 모두 차단(D-021). refresh 토큰으로 API 인증 불가(`token_type` 검사)
- 비밀값은 `Settings`로만 읽는다. 코드에 기본값 없음(`jwt_secret_key`, `database_url`, `seed_user_password`는 필수 — 없으면 `ValidationError`로 실패, 확인함)
- GATE-06: `.env` 미커밋, 비밀값 하드코딩 grep 0줄, `.venv` 무시 확인
- 필요한 환경변수: `.env.example` 참고

## 임시 코드
- TKT-BE-M4-03 기준: **남은 임시 코드 없음.** `X-Debug-User-Id`는 `src/`에서 지웠다(grep 0줄). 테스트(`tests/integration/*`)에는 아직 남아 있어 TKT-QA-M4-01에서 실제 토큰으로 바꿔야 한다
- TKT-BE-M4-02 기준 현황(지난 기록): rooms API는 아직 `X-Debug-User-Id` 헤더로 회원을 받는다. auth API(`/me`·`/logout`)만 실제 Bearer 토큰을 쓴다. TKT-BE-M4-03에서 `get_current_user_id`를 `get_current_user` 기반으로 바꾸고 헤더 코드를 지운다
- TKT-BE-M3-04: `src/auth/presentation/dependencies.py`의 `X-Debug-User-Id` 헤더 인증(`TODO(TKT-BE-M4-03)` 주석). TKT-BE-M4-03에서 SEQ-03(JWT·쿠키·블랙리스트)으로 바꾸고 `grep -rn "X-Debug-User-Id" src/` 0줄을 확인한다

## 프론트엔드에게 전달할 것
- TKT-BE-M4-03: rooms API도 모두 `Authorization: Bearer <access_token>`으로 부른다(TKT-BE-M4-02 안내와 같음)
- TKT-BE-M4-02: 로그인은 `application/x-www-form-urlencoded`로 `username`(=아이디)·`password`를 `POST /api/auth/token`에 보낸다. 응답의 `access_token`·`refresh_token`을 `localStorage`에 저장한다. 이후 요청은 `Authorization: Bearer <access_token>`. 401이면 `POST /api/auth/refresh`(JSON `{"refresh_token"}`)로 한 번 재발급. 로그아웃은 `POST /api/auth/logout`에 Bearer 헤더 + JSON `{"refresh_token"}`. 헤더 없이 부르면 401 `{"detail": "Not authenticated"}`(FastAPI 기본 문구). 스키마는 `src/auth/presentation/schemas.py`
- TKT-BE-M3-04: 요청·응답 스키마는 `src/rooms/presentation/schemas.py`(필드 이름은 `04-interfaces-api.md` §5.2와 같음). 오류 문구는 `src/rooms/domain/exceptions.py`. 상세 조회 410은 해산 신호(SEQ-13). 화면 라우트(PAGE)는 TKT-BE-M5-01
- TKT-BE-M2-01: 없음 (API 없음)

## 구현 중 자율 결정

#### TKT-BE-M4-02 인증 의존성을 이 티켓에서 일부 추가
- 결정: API-AUTH-03·04가 Bearer 인증을 써야 해서, `dependencies.py`에 `oauth2_scheme`·`get_current_user`를 이번 티켓에서 추가했다. rooms가 쓰는 `get_current_user_id` 교체와 X-Debug 삭제는 TKT-BE-M4-03에 남겼다 — HANDOFF TKT-BE-M4-02·03, SEQ-03
- 선택지: **A. 교안의 `get_current_user`만 먼저 추가 (권장·채택)** / B. 라우터 안에서 `service.authenticate`를 직접 호출하고 M4-03에서 옮김
- 권장 이유: M4-03에서 다시 옮길 코드를 만들지 않고, 교안 6장과 같은 위치·이름으로 한 번만 쓴다.
- trade-off: A — M4-02가 M4-03의 산출 파일을 일부 건드린다. B — 같은 인증 코드를 두 번 쓰고 옮겨야 한다.

#### TKT-BE-M4-01 닉네임 중복 확인 값
- 결정: 닉네임 중복은 `nickname.strip()`으로 확인한다 — SEQ-01, `User.register`(닉네임을 다듬어 저장)
- 선택지: **A. 다듬은 값으로 확인 (권장·채택)** / B. 입력값 그대로 확인
- 권장 이유: 저장되는 값이 다듬은 값이라, 그대로 확인하면 " 고양이 " 같은 입력이 중복 검사를 통과한 뒤 DB `unique`에서 500이 난다.
- trade-off: A — `strip`이 도메인과 서비스 두 곳에 있다. B — 앞뒤 공백 입력에서 400 대신 500.

#### TKT-BE-M4-01 토큰 문구 상수
- 결정: 401 문구 4개를 `service.py` 모듈 상수로 둔다 — `04-interfaces-api.md` §1.2·SEQ-04b
- 선택지: **A. 서비스 모듈 상수 (권장·채택)** / B. `AuthenticationError` 하위 클래스 4개
- 권장 이유: 교안 6장처럼 문구만 다른 같은 401이라 클래스를 늘릴 필요가 없다.
- trade-off: A — 테스트가 문구를 문자열로 비교해야 한다. B — 클래스가 늘어난다.

#### TKT-BE-M3-05 로깅 설정 시점
- 결정: `main.py`에서 `logging.basicConfig(level=INFO)`를 한 번 호출한다 — GATE-01("시드 로그 1회"), CONV-07(로그 형식은 TKT-BE-M5-01 미들웨어)
- 선택지: **A. 지금 최소 설정 추가 (권장·채택)** / B. M5 미들웨어 티켓까지 로깅 설정을 미룸
- 권장 이유: uvicorn은 자기 로거만 설정해 `seed` 로거의 INFO가 보이지 않으므로, 설정 없이는 GATE-01의 시드 로그를 확인할 수 없다.
- trade-off: A — M5에서 요청 로그 형식을 정할 때 이 설정과 함께 정리해야 한다. B — M5 전까지 시드 주입 여부를 로그로 확인할 수 없다.

#### TKT-BE-M3-05 422 메시지의 필드 이름
- 결정: 오류 위치(`loc`)의 마지막 요소를 필드 이름으로 쓰고, 위치가 없으면 "요청"으로 쓴다 — ADR-004
- 선택지: **A. loc 마지막 요소 (권장·채택)** / B. `body.title`처럼 위치 전체를 점으로 연결
- 권장 이유: ADR-004가 마지막 요소를 정했고, 화면에 보여 줄 문구가 짧다.
- trade-off: A — 같은 이름의 필드가 쿼리와 본문에 동시에 있으면 구분되지 않는다(현재 API에는 없음). B — 위치는 정확하지만 문구가 길고 내부 구조가 드러난다.

#### TKT-BE-M3-04 ruff B008과 FastAPI 의존성
- 결정: `pyproject.toml`에 `extend-immutable-calls = ["fastapi.Depends", "fastapi.Query", "fastapi.Header", "fastapi.Path"]`를 둔다 — ADR-005(규칙 `B` 사용), RC-12(`Depends(get_db)`)
- 선택지: **A. FastAPI 호출을 B008 예외로 등록 (권장·채택)** / B. 모든 매개변수를 `Annotated[..., Depends(...)]` 방식으로 작성
- 권장 이유: ADR-005의 규칙 집합은 그대로 두고, 발제 예시와 같은 `= Depends(get_db)` 표준 형태를 쓸 수 있다.
- trade-off: A — 설정 4줄이 늘고, 목록에 없는 다른 함수 호출 기본값은 여전히 경고된다. B — 설정은 그대로지만 모든 라우터가 발제 예시와 다른 문법이 되고 코드가 길어진다.

#### TKT-BE-M3-04 변경 API의 응답 만들기
- 결정: 생성·제목·참가·팀 변경 뒤에는 `RoomQueryService.get_room_detail(room_id, user_id)`로 상세를 다시 읽어 응답한다 — SEQ-05("router가 get_room_detail로 응답")
- 선택지: **A. 상세 재조회 (권장·채택)** / B. 서비스가 돌려준 `Room` 도메인 객체로 응답을 직접 조립
- 권장 이유: 닉네임은 조회 쿼리에만 있어 도메인 객체로는 `RoomDetailResponse`를 만들 수 없고, 상세 응답 형식이 한 곳에서 만들어진다.
- trade-off: A — 변경 요청마다 조회 쿼리가 2번 더 나간다. B — 닉네임 조회 코드가 라우터에 따로 생긴다.

#### TKT-BE-M3-03 조회 서비스의 목록 캐시 매개변수
- 결정: `RoomQueryService(db)`만 받고 `list_cache` 매개변수는 두지 않는다 — `04-interfaces-api.md` §3(`(db, list_cache=None)`), D-018
- 선택지: **A. 매개변수 생략 (권장·채택)** / B. 설계대로 `list_cache=None`을 받고 사용하지 않음
- 권장 이유: 캐시 읽기 방식(get/set)은 도전 C(ADR-007)에서 정해지고, 지금 받으면 쓰이지 않는 매개변수가 된다.
- trade-off: A — 도전 C 티켓에서 생성자에 매개변수를 추가해야 한다. B — 시그니처는 설계와 같지만 아무 일도 하지 않는 매개변수가 남는다.

#### TKT-BE-M3-03 현재 참가 방이 삭제 상태일 때
- 결정: `get_current_room`은 참가 기록이 가리키는 방이 없거나 삭제됐으면 `None`을 돌려준다 — US-07, AC-07-2
- 선택지: **A. 활성 방일 때만 반환 (권장·채택)** / B. 참가 기록만 보고 그대로 반환
- 권장 이유: 정상 흐름에서는 삭제된 방에 현재 참가가 남지 않지만(INV-06), 필수 범위에는 동시 요청 보호가 없어 어긋난 데이터가 생겨도 화면에 사라진 방 링크가 뜨지 않는다.
- trade-off: A — 어긋난 데이터를 조용히 숨긴다. B — 화면 상단에 열 수 없는 방 링크가 남을 수 있다.

#### TKT-BE-M3-02 목록 캐시 매개변수 타입
- 결정: `list_cache`를 `clear()` 하나만 가진 `ListCacheInvalidator` Protocol로 받는다 — `04-interfaces-api.md` §3(`list_cache: RoomListCache | None = None`), ADR-007
- 선택지: **A. 최소 Protocol 정의 (권장·채택)** / B. 도전 C의 `RoomListCache` 클래스를 지금 만들어 import
- 권장 이유: `RoomListCache`는 도전 C 티켓에서 만드는 파일이라 필수 범위에서 미리 만들 수 없고(D-018), 서비스가 쓰는 것은 `clear()` 하나뿐이다.
- trade-off: A — 설계 문서의 타입 이름과 다르다(도전 C에서 `RoomListCache`가 이 Protocol을 만족하면 된다). B — 요청되지 않은 도전 범위 파일이 필수 티켓에 들어간다.

#### TKT-BE-M3-02 `start_game` 반환 시각
- 결정: `GameStartResult.dissolved_at`은 도메인에 넘긴 `now`와 같은 값이다 — SEQ-09
- 선택지: **A. 같은 `now` 사용 (권장·채택)** / B. 저장된 방의 `deleted_at`을 다시 읽음
- 권장 이유: 도메인이 그 `now`로 `deleted_at`을 기록하므로 값이 같고, 조회가 한 번 줄어든다.
- trade-off: A — DB가 시각을 바꾸는 일은 없다는 전제다. B — 쿼리가 하나 늘어난다.

#### TKT-BE-M3-01 `TeamSide` 정의 위치
- 결정: `TeamSide`를 `participation.py`에 정의하고 `room.py`에서 다시 내보낸다(`from rooms.domain.room import TeamSide` 그대로 동작) — `04-interfaces-api.md` §2.3·§2.4
- 선택지: **A. participation.py에 정의 + room.py 재수출 (권장·채택)** / B. 설계대로 room.py에 정의
- 권장 이유: `room.py`가 `Participation`을 import하고 `Participation`이 `TeamSide`를 쓰므로, B는 두 모듈이 서로 import하는 순환 참조가 된다.
- trade-off: A — 정의 위치가 설계 문서와 한 줄 다르다(쓰는 쪽 import 경로는 같음). B — 순환 참조를 피하려면 지연 import 같은 우회 코드가 필요하다.

#### TKT-BE-M3-01 `RoomTitle` 직접 생성 시 검증
- 결정: `RoomTitle(value)` 생성자도 "앞뒤 공백 없음 + 1~20자"를 검사하고, `of(raw)`는 strip 후 생성자를 부른다 — INV-12
- 선택지: **A. 생성자에서도 검사 (권장·채택)** / B. `of()`에서만 검사
- 권장 이유: 레포지토리가 DB 값으로 `RoomTitle`을 만들 때도 같은 규칙이 지켜져, 잘못된 값이 도메인 안으로 들어오지 않는다.
- trade-off: A — DB에 규칙 밖의 값이 있으면 조회 시 오류가 난다(CHECK 제약이 있어 생기기 어렵다). B — 생성자로 만든 제목은 규칙을 건너뛸 수 있다.

#### TKT-BE-M3-01 `User` 검증 시점
- 결정: 아이디·닉네임 형식은 `User.register()`에서만 검사하고, 생성자(레포지토리 복원용)는 검사하지 않는다 — `04-interfaces-api.md` §2.1
- 선택지: **A. register에서만 검사 (권장·채택)** / B. 생성자에서도 검사
- 권장 이유: 설계 시그니처가 검증을 `register`에 두었고, 저장된 회원은 가입 때 이미 검사를 통과했다.
- trade-off: A — 코드에서 생성자로 직접 만든 회원은 검사를 건너뛴다. B — 규칙이 바뀌면 기존 회원 조회가 실패할 수 있다.

#### TKT-BE-M3-01 읽기 모델 `MyRecord` 추가
- 결정: `ArchivedRoom.my_records`의 항목 타입으로 `MyRecord(joined_at, left_at)`를 둔다 — `04-interfaces-api.md` §5.2 `MyRecordResponse`
- 선택지: **A. `MyRecord` 읽기 모델 추가 (권장·채택)** / B. `HistoryItem` 재사용
- 권장 이유: §3의 읽기 모델 목록에는 없지만 §5 응답 스키마 `MyRecordResponse`와 필드가 1:1로 맞는다.
- trade-off: A — §3 목록에 없는 이름이 하나 생긴다. B — 보관 정보에 필요 없는 필드(방 제목 등)까지 채워야 한다.

#### TKT-BE-M2-01 프로젝트 이름
- 결정: `pyproject.toml`의 `name = "matchmaking-2vs2"` — 설계 문서에 프로젝트 패키지 이름이 없음
- 선택지: **A. `matchmaking-2vs2` (권장·채택)** / B. 저장소 이름 `kant-ubuntu-books-claude1`
- 권장 이유: 빌드 대상이 아닌 가상 프로젝트라 기능에 영향이 없고, 서비스 내용과 맞는 이름이 팀이 읽기 쉽다.
- trade-off: A — 저장소 이름과 다르다. B — 이전 프로젝트(우분투북스) 이름이 남는다.

#### TKT-BE-M2-01 `CORS_ORIGINS` 입력 형식
- 결정: `.env`에 JSON 배열(`["http://localhost:8000"]`)로 쓴다 — ADR-003은 항목만 정함
- 선택지: **A. JSON 배열 (권장·채택)** / B. 쉼표 구분 문자열 + 직접 파싱
- 권장 이유: pydantic-settings가 `list[str]`을 JSON으로 그대로 읽어 파싱 코드가 필요 없다.
- trade-off: A — 따옴표·대괄호를 정확히 써야 한다. B — 입력은 쉽지만 파싱 코드와 검증이 늘어난다.

#### TKT-BE-M2-01 테스트 이벤트 루프 범위 설정
- 결정: `asyncio_default_test_loop_scope = "session"`도 `pyproject.toml`에 추가 — STK-11 보완
- 선택지: **A. ini 옵션으로 전체 지정 (권장·채택)** / B. STK-11대로 테스트 모듈마다 `pytestmark` 작성
- 권장 이유: 설치된 pytest-asyncio 1.4.1이 이 옵션을 지원해(`pytest --help`로 확인) 모듈마다 빠뜨릴 위험이 없다.
- trade-off: A — 일부 테스트만 다른 루프 범위가 필요하면 그 테스트에서 따로 지정해야 한다. B — 모듈마다 같은 줄을 반복하고 빠뜨리면 루프 불일치 오류가 난다.

## 설계와 다르게 한 것 / 질문 / DB 에이전트에게 요청
- TKT-BE-M4-03: 헤더가 아예 없으면 `OAuth2PasswordBearer`가 FastAPI 기본 문구 `{"detail": "Not authenticated"}`(영문)로 401을 낸다. 형식(NFR-02 문자열 `detail`·`WWW-Authenticate: Bearer`)은 맞지만 다른 오류와 달리 영문이다. 교안 6장 방식 그대로 두었다. 한글로 맞출지는 PM·ARCH 확인이 필요하다
- TKT-BE-M4-03: 통합 테스트(`tests/integration/test_rooms_api.py`·`test_errors.py`)는 아직 `X-Debug-User-Id`를 쓰므로 이제 테스트 DB에서 돌리면 401로 실패한다. TKT-QA-M4-01(선행: 이 티켓)에서 실제 토큰으로 바꾸는 범위다
- TKT-BE-M4-03: 검증 중 pyjwt가 HMAC 키가 32바이트보다 짧으면 `InsecureKeyLengthWarning`을 낸다. `.env`의 `JWT_SECRET_KEY`는 32자 이상으로 정하도록 `.env.example` 설명 보강을 제안한다(BE 담당 파일이라 다음 BE 티켓에서 반영 가능)
- TKT-BE-M4-01: **알려진 제한(사용자 결정, 2026-10-28: 교안 그대로 유지).** 페이로드가 `sub`·`exp`(초 단위)·`token_type`뿐이라 같은 회원이 같은 초에 받은 토큰은 문자열이 완전히 같다. 그래서 로그아웃 직후 1초 안에 다시 로그인·재발급하면 이미 차단된 토큰을 받아 401이 난다. **QA는 로그아웃 → 재로그인 테스트에서 재로그인 전에 1초 이상 기다려야 한다**(예: `await asyncio.sleep(1.1)`). 실사용·시연에서는 거의 생기지 않는다. 고치려면 페이로드에 `jti`(uuid4)를 더하면 된다(사용자가 이번에는 채택하지 않음)
- TKT-BE-M3-05: **완료 조건 GATE-01(실제 기동·시드 로그 1회)을 사용자 승인으로 건너뛰었다(2026-10-28).** 로컬 PostgreSQL이 없다(Docker Desktop 설치돼 있으나 꺼져 있음). 남은 확인: PostgreSQL·`.env` 준비 후 `uv run uvicorn main:app --app-dir src` 기동 → 콘솔에 `seed inserted: … total=42` 1회 → 재기동 시 `seed skipped` → `/docs` 200. TKT-QA-M3-01 또는 DB가 준비되는 첫 시점에 확인해야 한다
- TKT-BE-M3-05: 이제 `main`을 import하면 `database`가 설정을 읽으므로 `.env`(또는 환경변수) 없이는 서버가 기동하지 않는다. TKT-BE-M2-01의 "DB 없이 `/docs` 200"은 더 이상 성립하지 않는다(설계대로의 변화)
- TKT-BE-M3-04: **GATE-08 명령이 오탐**한다. `grep -rnE "import .*Model|Model,"`가 `src/rooms/presentation/schemas.py`의 `from pydantic import BaseModel, ConfigDict, Field`를 잡는다(ORM 모델 아님). 대신 `grep -rnE "infrastructure.models" src/*/application src/*/presentation`로 확인했고 0줄이다. ARCH에 GATE-08 명령을 이 형태로 바꾸도록 요청한다
- TKT-BE-M3-04: B008 예외 설정(위 자율 결정)을 `05-structure-conventions.md` 스택 주의(STK)에 추가하도록 ARCH에 제안한다
- TKT-BE-M3-03: `RoomQueryService` 생성자에서 `list_cache`를 뺐다(위 자율 결정). 상세 조회는 DB 브리핑 TKT-DB-M3-02의 사용자 확인 결과(활성 방만 반환, 서비스가 404/410 판단)를 따랐다
- TKT-BE-M3-02: `list_cache` 타입은 Protocol로 받았다(위 자율 결정). ARCH에 `04-interfaces-api.md` §3 표기 갱신(`ListCacheInvalidator`) 여부 확인 요청
- STK-11 보완(위 자율 결정): ARCH에 STK-11 문구를 "ini 옵션 `asyncio_default_test_loop_scope = "session"`으로 지정(모듈별 `pytestmark`는 필요 없음)"으로 갱신 요청
- 스택 주의 추가 제안: ruff `E501`과 `ruff format`은 한글 문자열의 폭 계산이 달라, 긴 한글 문자열을 괄호로 나누면 formatter가 다시 한 줄로 합치고 E501이 나는 경우가 있었다. 한글 문구는 100자 폭 안으로 짧게 쓰거나 상수로 분리한다.
- pytest는 `tests/`가 없어 "No files were found in testpaths" 경고를 낸다. QA가 `tests/`를 만들면 사라진다(정상).

## 검증 결과

### TKT-BE-M4-03
- GATE-05: `ruff check src` 통과, `ruff format --check src` 36 files already formatted / GATE-02·06·07 0줄 / `grep -rn "X-Debug-User-Id" src/` 0줄
- 인증 흐름(실제 `main.app`, `get_db`·레포지토리만 가짜, 실제 토큰 함수 사용, 임시 스크립트): 헤더 없음 401 "Not authenticated" + `WWW-Authenticate: Bearer` / 예전 `X-Debug-User-Id` 헤더 401 / 유효한 access 200 / refresh 토큰을 access로 사용 401 / 위조 토큰 401 / 없는 회원 토큰 401 / 블랙리스트 access 401 / `get_current_user_id`가 `User.id` 반환
- 확인하지 못함: PostgreSQL 위 동작(블랙리스트 저장·조회 포함)

### TKT-BE-M4-02
- GATE-05: `ruff check src tests` 통과, `ruff format --check src tests` 42 files already formatted
- GATE-04: 63 passed, 44 skipped(테스트 DB 없음)
- GATE-02·06·07 0줄. GATE-08은 알려진 오탐(`BaseModel`) 대신 `grep -rnE "infrastructure.models" src/*/application src/*/presentation` 0줄
- 앱 전체(lifespan 포함, 임시 SQLite + httpx `ASGITransport`, 저장소 밖 스크립트): 시드 42건 로그 / OpenAPI에 auth 경로 5개·summary 5개·OAuth2 password flow / 가입 200(해시 없음)·중복 400·필드 누락 422(문자열 `detail`) / 로그인 실패 401·성공 200(세 키) / `me`: 헤더 없음 401 "Not authenticated", 정상 200, refresh 토큰 401 / 시드 회원 `seed01` 로그인 200 / 재발급 200 / 로그아웃: 잘못된 refresh 400, 성공 200 → 같은 access로 `me` 401, 같은 refresh로 재발급 401 "로그아웃 처리되어…", 다시 로그아웃 401
- 확인하지 못함: PostgreSQL에서의 동작, 브라우저로 Swagger UI Authorize 버튼 직접 클릭

### TKT-BE-M4-01
- GATE-05: `ruff check src tests` 통과, `ruff format --check src tests` 40 files already formatted
- GATE-04: `uv run pytest -q` → 63 passed, 44 skipped(테스트 DB 없음)
- GATE-02·06·07: 명령 모두 0줄. GATE-08: 알려진 오탐 1줄(`pydantic BaseModel`)만
- 동작(임시 SQLite + aiosqlite, 저장소 밖 스크립트): 가입 성공(닉네임 다듬음, 해시 저장, id·created_at 채움) / 아이디 중복·닉네임 중복(앞뒤 공백 포함)·7자 비밀번호·대문자 아이디 → 각 예외 / 틀린 비밀번호·없는 아이디 → 같은 401 / 로그인 키 `access_token`·`refresh_token`·`token_type=bearer`, 페이로드 `sub`·`exp`·`token_type` / `authenticate`: 정상 통과, refresh 토큰·위조 토큰·없는 회원 → 401 / 재발급 성공, access 토큰으로 재발급 → 401 / 로그아웃: 잘못된 refresh → 400, 성공 후 새 세션에서 그 access → 401, 그 refresh로 재발급 → 401 "로그아웃 처리되어…", 두 번째 로그아웃 → 400 / 같은 초 재발급 토큰이 원래 토큰과 같음을 확인(위 알려진 제한)
- 확인하지 못함: PostgreSQL에서의 동작(테스트 DB 없음)

### TKT-BE-M3-05
- GATE-05: `ruff check src` 통과, `ruff format --check src` 33 files already formatted
- 전역 예외 핸들러(실제 `main.app`에 가짜 서비스를 주입, lifespan 없이 ASGI 호출, 임시 스크립트): 정원 마감·삭제된 방 → 400 `{"detail": "<문구>"}`, 없는 방 → 404, 해산 방 상세 → 410, 헤더 없음 → 401 + `WWW-Authenticate: Bearer`, 잘못된 쿼리 3개 → 422 문자열 1개("sort: …; page: …; size: …"), 본문 누락 → 422 "title: Field required", 팀 "C" → 422, 예상 못 한 예외 → 500 "서버 오류가 발생했습니다"(예외 메시지는 응답에 없고 로그에만), 없는 경로 → 404 `{"detail": "Not Found"}`
- GATE-01·lifespan(create_all·시드): **확인하지 못함 — 사용자 승인으로 건너뜀**

### TKT-BE-M3-04
- GATE-05: `ruff check src` 통과(B008 예외 설정 후), `ruff format --check src` 33 files already formatted
- GATE-07: `session.execute`·`select(` 0줄, `hashed_password` in schemas 0줄
- GATE-08: 문서 명령은 pydantic `BaseModel` 1줄을 오탐(위 질문). ORM 모델 import(`infrastructure.models`)는 0줄
- 시험 앱(가짜 서비스, 임시 스크립트): OpenAPI 경로 11개와 summary가 §4.2와 일치 / 목록 keyword strip(" Fun " → "Fun")·공백만 → None / `size=51`·`page=0`·잘못된 `sort` → 422 / 생성 시 정의되지 않은 `capacity` 필드 무시 / 상세 응답 키 10개·참가자 키 4개(입장 순서·해시 없음) / 팀 "C" → 422, "A" → `TeamSide.A`로 서비스 호출 / 나가기·시작·현재 방(없으면 null 둘)·이력·보관 정보 응답 형식 / 헤더 없으면 `AuthenticationError`(401 변환은 TKT-BE-M3-05)
- 실제 DB 위 동작: **확인하지 못함 (환경 문제)**

### TKT-BE-M3-03
- GATE-05: 30 files already formatted, check 통과 / GATE-07(application 항목)·GATE-08: 0줄
- 조회 분기 수동 검증(가짜 레포지토리, 12건 통과): 상세에서 조회 회원의 팀·방장 여부(참가자 B팀·방장·비참가자), 해산 방 410 예외, EMPTY 방·없는 방 404 예외, 목록 페이지 정보, 현재 참가 방 있음·없음, 이력 페이지, 보관 정보 본인 있음·참가 기록 없음 404
- 실제 DB 위 동작: **확인하지 못함 (환경 문제)**

### TKT-BE-M3-02
- GATE-05: `ruff check src` 통과, `ruff format --check src` 29 files already formatted / GATE-07: 0줄 / GATE-08: 0줄 / GATE-02: 0줄
- 흐름 수동 검증(가짜 레포지토리·세션, 임시 스크립트, 18건 통과): 생성(id 부여·방장), 참가 중 회원의 재생성 거부, 3명 참가 후 정원 마감 거부, 없는 방 404 예외, 같은 방 재참가 기록 유지, 방장 제목 변경, 팀 정원 거부, 방장 퇴장 시 위임 결과(`new_host_user_id`), 일반 퇴장 결과, 방장 아님 시작 거부 **실패 시 commit 0회**, 게임 시작 성공 후 GAME_STARTED·전원 종료, 반복 시작 거부, 혼자 나가면 EMPTY 삭제, 해산 뒤 새 방 생성 가능, commit마다 캐시 clear 1회
- 실제 DB 위 동작: **확인하지 못함 (환경 문제)** — TKT-QA-M3-01 통합 테스트에서 확인

### TKT-BE-M3-01
- GATE-02: 세 명령 모두 0줄
- GATE-05: `uv run ruff check src` 통과, `uv run ruff format --check src` 23 files already formatted
- GATE-07(domain 항목): 0줄
- 도메인 규칙 수동 검증(임시 스크립트, 저장소에 남기지 않음, 54건 통과): RoomTitle 경계(공백·0자·20자·21자), create(참가 중 거부·A팀·순서 1), join(자동 배정 B→A, 같은 방 재요청 기록 유지, 다른 방 거부, 정원 마감), change_team(팀 정원·같은 팀·비참가자), rename(방장 아님·제목 규칙), start_game(방장 아님·구성 불일치·성공 시 전원 종료와 GAME_STARTED), leave(일반 퇴장·방장 위임 최소 입장 순서·마지막 퇴장 EMPTY), 재입장 새 순서, 삭제 방의 모든 행위 거부, 생성자 검증(INV-07·last_join_order), Participation end·change_team 거부, 예외 계층과 문구, User.register 거부 8건, 비밀번호 7자 거부, TokenBlacklist 만료·빈 jti, PasswordHasher 해시·검증
- 정식 테스트는 TKT-QA-M3-01(`tests/unit/`)에서 작성

### TKT-BE-M2-01
- GATE-01: 통과 (`/docs` 200, `/openapi.json` 200)
- GATE-02: 대상 없음(도메인 파일 없음), 실행 결과 0줄
- GATE-03: 통과 (출력 0줄)
- GATE-05: `uv run ruff check src` 통과, `uv run ruff format --check src` 통과 (`tests` 경로 없음)
- GATE-06: 통과 (두 명령 출력 0줄)
- 설정 로딩: 환경변수로 `Settings` 생성 성공(`CORS_ORIGINS` JSON 배열 파싱 확인), 필수값 없으면 `ValidationError`
- passlib + bcrypt 4.0.1: 해시·검증 동작 확인
