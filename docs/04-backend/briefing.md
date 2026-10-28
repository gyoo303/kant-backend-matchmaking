---
stage: BE
tickets: [TKT-BE-M2-01, TKT-BE-M3-01, TKT-BE-M3-02, TKT-BE-M3-03]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-SYS, AR-API, AR-CONV, AR-GATE, AR-ADR, DB-BRIEF, PM-DOMAIN]
next_readers: [DB, FE, QA]
---
# 백엔드 에이전트 브리핑

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

## 만든 것
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
- 도메인 코드 없음. `exceptions.py`는 외부 import 없음(GATE-02 대상 grep 0줄)
- 저장소 모델·트랜잭션: 해당 없음(이후 티켓)
- TKT-BE-M3-02: 서비스는 레포지토리·도메인만 호출하고 직접 쿼리하지 않는다. 비즈니스 판단은 모두 도메인 메서드에 있고, 서비스의 조건문은 방 없음 확인과 결과 조립(방장 변경 여부)뿐이다
- TKT-BE-M3-01: 도메인은 표준 라이브러리(`dataclasses`, `datetime`, `enum`, `re`)와 `exceptions`, 같은 기능 도메인만 import. 시각은 모두 `now` 인자로 받음. `read_models.py`는 `rooms.domain`만 참조

## 보안 확인 포인트
- 비밀값은 `Settings`로만 읽는다. 코드에 기본값 없음(`jwt_secret_key`, `database_url`, `seed_user_password`는 필수 — 없으면 `ValidationError`로 실패, 확인함)
- GATE-06: `.env` 미커밋, 비밀값 하드코딩 grep 0줄, `.venv` 무시 확인
- 필요한 환경변수: `.env.example` 참고

## 임시 코드
- 없음

## 프론트엔드에게 전달할 것
- 없음 (API 없음)

## 구현 중 자율 결정

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
- TKT-BE-M3-03: `RoomQueryService` 생성자에서 `list_cache`를 뺐다(위 자율 결정). 상세 조회는 DB 브리핑 TKT-DB-M3-02의 사용자 확인 결과(활성 방만 반환, 서비스가 404/410 판단)를 따랐다
- TKT-BE-M3-02: `list_cache` 타입은 Protocol로 받았다(위 자율 결정). ARCH에 `04-interfaces-api.md` §3 표기 갱신(`ListCacheInvalidator`) 여부 확인 요청
- STK-11 보완(위 자율 결정): ARCH에 STK-11 문구를 "ini 옵션 `asyncio_default_test_loop_scope = "session"`으로 지정(모듈별 `pytestmark`는 필요 없음)"으로 갱신 요청
- 스택 주의 추가 제안: ruff `E501`과 `ruff format`은 한글 문자열의 폭 계산이 달라, 긴 한글 문자열을 괄호로 나누면 formatter가 다시 한 줄로 합치고 E501이 나는 경우가 있었다. 한글 문구는 100자 폭 안으로 짧게 쓰거나 상수로 분리한다.
- pytest는 `tests/`가 없어 "No files were found in testpaths" 경고를 낸다. QA가 `tests/`를 만들면 사라진다(정상).

## 검증 결과

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
