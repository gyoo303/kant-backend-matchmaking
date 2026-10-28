---
stage: QA
tickets: [TKT-QA-M4-01]
status: partial
inputs_read: [AR-MAP, AR-HAND, PM-AC, AR-GATE, AR-API, AR-CONV, BE-BRIEF, DB-BRIEF]
next_readers: [BE, 사람]
---
# QA 브리핑 – TKT-QA-M4-01 인증 검증 (matchmaking-jump5, 기준 커밋 63fe6e9)

판정: ⚠️ 조건부

## 요약 (3줄 이내)
- 인증 통합 테스트 19개(AC-08~11, NFR-03, 재발급)를 쓰고, 기존 통합 테스트 44개를 실제 access 토큰 방식으로 바꿨다.
- 정식 테스트 DB(PostgreSQL)가 없어 GATE-04에서는 통합 63개가 건너뛰어졌다. 대신 QA 작업 폴더에서 SQLite로 임시 실행해 113 통과 / 13 실패를 얻었고, 실패 13개는 모두 SQLite의 시간대 미지원 때문이다(PostgreSQL에서는 생기지 않음). 인증 테스트 19개는 모두 통과했다.
- 프로덕션 코드 버그는 발견하지 못했다. PostgreSQL 위 최종 확인과 AC-11-3(화면 리다이렉트, M5 범위)이 남았다.

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-08-1 | `test_auth_api.py::test_ac_08_1_signup_hides_password_and_stores_hash` | SQLite 임시 실행 통과 / PostgreSQL 미실행 |
| AC-08-2 | `test_ac_08_2_signup_rejects_invalid_login_id` | 〃 통과 |
| AC-08-3 | `test_ac_08_3_signup_rejects_invalid_nickname` | 〃 통과 |
| AC-08-4 | `test_ac_08_4_signup_rejects_short_password` | 〃 통과 |
| AC-08-5 | `test_ac_08_5_signup_rejects_duplicates` | 〃 통과 |
| AC-09-1 | `test_ac_09_1_login_returns_bearer_tokens` | 〃 통과 |
| AC-09-2 | `test_ac_09_2_login_failure_has_same_detail` | 〃 통과 |
| API-AUTH-05 재발급 (US-09) | `test_refresh_issues_new_access_token`, `test_refresh_rejects_access_token` | 〃 통과 |
| AC-10-1 | `test_ac_10_1_logout_blacklists_tokens` (access·refresh 둘 다 블랙리스트) | 〃 통과 |
| AC-10-2 | `test_ac_10_2_logged_out_token_is_401_everywhere` (`/me`·`/api/rooms`·재발급) | 〃 통과 |
| AC-10-3 | `test_ac_10_3_logout_keeps_participation_and_host` (재로그인 후 같은 방, AC-07-3 실제 확인 포함) | 〃 통과 |
| 로그아웃 잘못된 refresh 400 | `test_logout_with_invalid_refresh_is_400` | 〃 통과 |
| AC-11-1 | `test_ac_11_1_room_api_without_token_is_401` | 〃 통과 |
| AC-11-2 | `test_ac_11_2_expired_or_forged_token_is_401`, `test_refresh_token_cannot_call_api` | 〃 통과 |
| AC-11-3 | — | **범위 밖(보류)**: 화면 리다이렉트는 M5(TKT-BE-M5-01·FE). D-021로 화면 라우트는 인증하지 않으므로 JS 쪽 처리 확인이 필요 |
| AC-11-4 | `test_ac_11_4_signup_and_login_need_no_token` | 〃 통과 |
| NFR-03 | `test_nfr_03_no_password_hash_in_responses`, `test_nfr_03_history_shows_only_own_records`, AC-10-2 | 〃 통과 |
| AC-01~07, NFR-02 (토큰 전환) | `test_rooms_api.py` 39개, `test_errors.py` 5개 | SQLite 임시 실행 31·5 중 13개가 시간대 비교 오류(환경 차이), 나머지 통과 / PostgreSQL 미실행 |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| 테스트 (GATE-04, 저장소 그대로) | `uv run pytest -q` → 통과 63 / 실패 0 / 건너뜀 63 / 실행 63개 | 단위 통과. 통합 63개는 환경 문제(`TEST_DATABASE_URL` 없음) |
| 테스트 (QA 작업 폴더, SQLite 임시) | `TEST_DATABASE_URL=sqlite+aiosqlite:///…/qa.db uv run --with aiosqlite pytest -q` → 통과 113 / 실패 13 / 실행 126개. 인증 파일만: 통과 19 / 실패 0 | 실패 13개 전부 `TypeError: can't compare offset-naive and offset-aware datetimes` — SQLite가 `DateTime(timezone=True)`의 시간대를 저장하지 않아 생김. 환경 차이(아래 "QA 자율 결정") |
| 린트·포맷 (GATE-05) | `uv run ruff check src tests` 통과, `uv run ruff format --check src tests` 43 files already formatted | 통과 |
| GATE-02·03·06·07 | 0줄 | 통과 |
| GATE-08 | 알려진 오탐 1줄(pydantic `BaseModel`), `infrastructure.models` import 0줄 | 실제 위반 없음 |
| `X-Debug-User-Id` | `src/`·`tests/` 모두 0줄 | 통과(임시 인증 흔적 없음) |
| 기동 (GATE-01) | 미실행 | 환경 문제 |
| 브랜치 충돌 | TKT-QA-M3-01 브리핑과 같음(`origin/main`과 프로젝트 교체성 충돌) | 사람 결정 대기 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | `tests/integration/*` | 통합 테스트가 여전히 PostgreSQL에서 실행된 적이 없다 | `uv run pytest -q -rs` → 63 skipped | 테스트용 PostgreSQL + `TEST_DATABASE_URL` 준비 후 실행 | 재현됨 | 사람(환경) |
| 하 | `src/auth/presentation/dependencies.py` (`OAuth2PasswordBearer`) | 토큰 없이 부르면 401 `detail`이 FastAPI 기본 영문 "Not authenticated"다. 다른 오류는 모두 한글 | `GET /api/rooms` 헤더 없이 | PM·ARCH가 한글 통일 여부를 정함(BE 브리핑 TKT-BE-M4-03에서도 질문) | 재현됨 | PM·ARCH |
| 하 | 인증 토큰 (BE 브리핑 TKT-BE-M4-01 알려진 제한) | 같은 회원이 같은 초에 받은 토큰은 같아서, 로그아웃 직후 1초 안에 재로그인하면 차단된 토큰을 받는다 | `test_ac_10_3_*`에서 `asyncio.sleep(1.1)` 없이 재로그인하면 401 | 사용자 결정으로 교안 그대로 유지(BE 브리핑). 테스트는 1초 대기로 처리 | 재현됨 | (결정됨) |

## AI 부채 체크
- 사람이 이해하기 어려운 코드/과설계: 없음. 인증은 교안 6장 1강 함수 이름·흐름 그대로다.
- 미래 위험과 최소화 방법:
  - SQLite로는 시각 관련 경로를 검증할 수 없다 → PostgreSQL 테스트 DB로 반드시 한 번 실행한다(06-quality-gates §2 "SQLite 대체 금지"와 같은 이유)
  - 1초 안 재로그인 문제는 시연 중 "로그아웃 → 바로 로그인"을 연달아 하면 드러날 수 있다 → 시연 흐름에서 로그아웃 뒤 잠깐 기다리거나 다른 계정으로 로그인

## 추가한 테스트
- `tests/integration/test_auth_api.py`: 19개 — 가입(형식·중복·해시 저장), 로그인(성공·실패 문구 동일), 재발급(성공·access 토큰 거부), 로그아웃(두 토큰 차단·이후 401·참가 유지·잘못된 refresh 400), 비로그인·만료·위조·refresh 토큰 거부, 가입·로그인은 토큰 불필요, 해시 비노출, 본인 이력만
- `tests/conftest.py`: `auth_header(user_id)`가 실제 access 토큰(`create_access_token({"sub": 아이디})`)을 만든다. `make_users`가 테스트 비밀번호 `password123`의 bcrypt 해시를 넣는다(해시는 한 번만 계산). 테스트용 `JWT_SECRET_KEY`를 32바이트 이상으로 바꿈(pyjwt 경고 방지)
- `tests/integration/test_rooms_api.py`·`test_errors.py`: 임시 헤더 헬퍼를 지우고 `from conftest import auth_header`로 전환(테스트 내용은 그대로)

## QA 자율 결정

#### 테스트에서 토큰을 얻는 방법
- 결정: rooms 테스트는 로그인 API 대신 `create_access_token({"sub": 아이디})`로 토큰을 바로 만들고, 인증 테스트만 실제 로그인 API를 쓴다 — `06-quality-gates.md` §2, 교안 6장
- 선택지: **A. 토큰 함수로 직접 생성 (권장·채택)** / B. 모든 테스트가 `/api/auth/token`으로 로그인
- 권장 이유: rooms 테스트의 관심사는 방 규칙이고, 토큰 서명·검증 경로는 서버의 실제 `get_current_user`를 그대로 통과한다. 로그인 경로는 인증 테스트가 따로 검증한다.
- trade-off: A — rooms 테스트는 로그인 API의 결함을 잡지 못한다(인증 테스트가 맡음). B — 테스트마다 bcrypt 검증과 로그인 요청이 더해져 느려진다.

#### `auth_header` 공유 방법
- 결정: `conftest.py`에 `auth_header`를 두고 테스트 모듈이 `from conftest import auth_header`로 가져온다 — `pyproject.toml`의 `pythonpath = ["src"]`
- 선택지: **A. conftest에서 import (권장·채택)** / B. 모듈마다 같은 헬퍼 복사 / C. pythonpath에 `.` 추가
- 권장 이유: 토큰이 회원 ID→아이디 기록(`make_users`가 채움)을 써야 해서 한 곳에 있어야 하고, BE 담당 파일(`pyproject.toml`)을 고치지 않는다.
- trade-off: A — pytest가 `tests/`를 경로에 넣는 기본 동작(prepend 모드)에 기댄다. B — 아이디 기록을 공유할 수 없다. C — 다른 단계 파일을 고친다.

#### PostgreSQL 대신 SQLite로 임시 실행
- 결정: 저장소 밖 QA 작업 폴더에서만 `aiosqlite`(일회성 `uv run --with`)로 통합 테스트를 돌려 참고 결과를 얻었다. 저장소의 테스트·설정은 바꾸지 않았다 — `06-quality-gates.md` §2("SQLite 대체 금지"), qa-agent §2(일회성 도구는 작업 폴더에서만)
- 선택지: **A. 작업 폴더 임시 실행 + 결과는 참고로만 (권장·채택)** / B. 테스트 DB가 생길 때까지 통합 테스트 실행 안 함
- 권장 이유: 테스트 코드와 대부분의 API 흐름을 실제로 돌려 볼 수 있고, SQLite에서만 나는 실패는 원인이 분명해 분리할 수 있다.
- trade-off: A — 통과 결과가 PostgreSQL 통과를 보장하지 않는다(판정은 여전히 조건부). B — 테스트 코드 자체의 오류도 DB가 생길 때까지 모른다.

## 사람이 결정할 것
- **테스트 DB 준비**: PostgreSQL 테스트 DB에서 통합 63개를 한 번 실행해야 M3·M4 검증이 끝난다(지금은 SQLite 참고 결과만 있음).
- **비로그인 401 문구**: "Not authenticated"(영문)를 한글로 맞출지 PM·ARCH가 정해 주세요.
- **AC-11-3**: 화면 리다이렉트는 M5에서 확인합니다(이번 티켓 범위 밖).
- (지난 브리핑에서 이어짐) AC-06-4 수정, 머지 대상 브랜치.
