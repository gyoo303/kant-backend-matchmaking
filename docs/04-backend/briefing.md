---
stage: BE
tickets: [TKT-BE-M2-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-SYS, AR-API, AR-CONV, AR-GATE, AR-ADR]
next_readers: [DB, FE, QA]
---
# 백엔드 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 | 확인 방법 |
|---|---|---|---|
| TKT-BE-M2-01 | GATE-01(`/docs` 200, DB 없이) | 충족 | `uv run uvicorn main:app --app-dir src --port 8765` 기동 → `/docs` 200, `/openapi.json` 200, 기동 오류 0 |
| | GATE-03 | 충족 | `src/` 아래 패키지 폴더 11개 모두 `__init__.py` 있음 |
| | GATE-05 | 충족 | `ruff check src` 통과, `ruff format --check src` 통과 (`tests/`는 아직 없음) |

## 만든 것
### TKT-BE-M2-01
- `pyproject.toml`: 런타임 의존성(`02-system-architecture.md` §3 그대로, `bcrypt==4.0.1` 고정), dev 그룹(pytest·pytest-asyncio·httpx·ruff), `[tool.ruff]`(ADR-005), `[tool.pytest.ini_options]`(STK-01·STK-11)
- `uv.lock`: 설치된 주요 버전 — fastapi 0.162.0, starlette 1.10.0, sqlalchemy 2.1.6, asyncpg 0.32.0, pydantic 2.14.1, pydantic-settings 2.16.1, pyjwt 2.15.1, passlib 1.7.4, bcrypt 4.0.1, jinja2 3.1.6, python-multipart 0.0.32, uvicorn 0.54.0, pytest 9.2.0, pytest-asyncio 1.4.1, httpx 0.28.1, ruff 0.17.3 (Python 3.13.14)
- 패키지 골격: `src/__init__.py`, `src/{auth,rooms}/__init__.py`, 각 기능의 `{domain,infrastructure,application,presentation}/__init__.py` (모두 빈 파일)
- `src/config.py`: `Settings(BaseSettings)` — `database_url`, `jwt_secret_key`, `seed_user_password`(필수), `jwt_expire_minutes=60`, `cors_origins=["http://localhost:8000"]`, `cookie_secure=False`, `db_pool_size=10`, `db_max_overflow=10`. `env_file=".env"`, `extra="ignore"`(STK-10). `get_settings()`는 `lru_cache`
- `src/exceptions.py`: `DomainError(ValueError)`·`DomainRuleError`·`NotFoundError`·`GoneError`, `AuthenticationError(Exception)`. 모두 `message` 속성을 가진다(`04-interfaces-api.md` §1.1)
- `src/main.py`: 최소 FastAPI 앱(제목·설명·버전). 설정·DB를 읽지 않으므로 `.env` 없이 기동된다
- `.env.example`: ADR-003의 항목 전부 + 테스트 전용 `TEST_DATABASE_URL`(주석)

## 계층 확인 포인트
- 도메인 코드 없음. `exceptions.py`는 외부 import 없음(GATE-02 대상 grep 0줄)
- 저장소 모델·트랜잭션: 해당 없음(이후 티켓)

## 보안 확인 포인트
- 비밀값은 `Settings`로만 읽는다. 코드에 기본값 없음(`jwt_secret_key`, `database_url`, `seed_user_password`는 필수 — 없으면 `ValidationError`로 실패, 확인함)
- GATE-06: `.env` 미커밋, 비밀값 하드코딩 grep 0줄, `.venv` 무시 확인
- 필요한 환경변수: `.env.example` 참고

## 임시 코드
- 없음

## 프론트엔드에게 전달할 것
- 없음 (API 없음)

## 구현 중 자율 결정

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
- STK-11 보완(위 자율 결정): ARCH에 STK-11 문구를 "ini 옵션 `asyncio_default_test_loop_scope = "session"`으로 지정(모듈별 `pytestmark`는 필요 없음)"으로 갱신 요청
- 스택 주의 추가 제안: ruff `E501`과 `ruff format`은 한글 문자열의 폭 계산이 달라, 긴 한글 문자열을 괄호로 나누면 formatter가 다시 한 줄로 합치고 E501이 나는 경우가 있었다. 한글 문구는 100자 폭 안으로 짧게 쓰거나 상수로 분리한다.
- pytest는 `tests/`가 없어 "No files were found in testpaths" 경고를 낸다. QA가 `tests/`를 만들면 사라진다(정상).

## 검증 결과
- GATE-01: 통과 (`/docs` 200, `/openapi.json` 200)
- GATE-02: 대상 없음(도메인 파일 없음), 실행 결과 0줄
- GATE-03: 통과 (출력 0줄)
- GATE-05: `uv run ruff check src` 통과, `uv run ruff format --check src` 통과 (`tests` 경로 없음)
- GATE-06: 통과 (두 명령 출력 0줄)
- 설정 로딩: 환경변수로 `Settings` 생성 성공(`CORS_ORIGINS` JSON 배열 파싱 확인), 필수값 없으면 `ValidationError`
- passlib + bcrypt 4.0.1: 해시·검증 동작 확인
