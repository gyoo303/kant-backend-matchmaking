# 06. 품질 게이트 & 테스트 전략 (A7)

- 입력: `docs/01-pm/06-acceptance-criteria.md`(AC·NFR), `05-structure-conventions.md`, ADR-005·009
- 모든 명령은 저장소 루트에서 실행한다. Windows에서는 Git Bash 기준이다.

## 1. 게이트

| GATE | 내용 | 통과 기준 | 근거 |
|---|---|---|---|
| GATE-01 | 기동 | 기동 오류 0, `/docs` 응답 200, 시드 로그 1회 | EV-10, RC-02, NFR-01 |
| GATE-02 | 계층 격리 | 세 명령 모두 출력 0줄 | EV-01, RC-03·09, ADR-001 |
| GATE-03 | 패키지 `__init__.py` | 출력 0줄 | RC-02 |
| GATE-04 | 테스트 | 실패 0 (통합·동시성은 `TEST_DATABASE_URL` 필요) | AC 전체 |
| GATE-05 | 린트·포맷 | 오류 0 | ADR-005 |
| GATE-06 | 비밀값 | 앞 두 명령 출력 0줄, `.gitignore`에 `.venv`·`__pycache__`·`.env*`·`!.env.example` 존재 | EV-09, NFR-09, RISK-09 |
| GATE-07 | 금지 패턴 | 모든 명령 출력 0줄 | `05-structure-conventions.md` §4 |
| GATE-08 | ORM 누출 | 출력 0줄 | EV-03, RC-07, RISK-02 |
| GATE-09 | (도전 A 적용 후에만) 잠금 조회 강제 | 출력 0줄 | ADR-009, CONV-08 |

```bash
# GATE-01 (서버를 띄운 다른 터미널에서)
uv sync
uv run uvicorn main:app --app-dir src
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/docs

# GATE-02
grep -rnE "^(from|import) (fastapi|sqlalchemy|pydantic|starlette|jwt|passlib)" src/*/domain/
grep -rnE "^from (auth|rooms)\.presentation" src/*/application src/*/domain src/*/infrastructure
grep -rnE "^(from|import) rooms" src/auth

# GATE-03
for d in $(find src -type d -not -path "*/templates*" -not -path "*/static*" -not -name "__pycache__"); do [ -f "$d/__init__.py" ] || echo "$d"; done

# GATE-04
uv run pytest -q

# GATE-05
uv run ruff check src tests
uv run ruff format --check src tests

# GATE-06
git ls-files | grep -E "(^|/)\.env($|\.)" | grep -v "\.env\.example"
grep -rnE "(SECRET|PASSWORD)\s*=\s*['\"][^'\"]+['\"]" src/

# GATE-07
grep -rn "except:" src/
grep -rn "hashed_password" src/*/presentation/schemas.py
grep -rnE "session\.execute|select\(" src/*/presentation src/*/application
grep -rnE "datetime\.now|random\." src/*/domain/
grep -rniE "winner|loser|game_result" src/

# GATE-09 (도전 A 적용 후에만): 방 변경 서비스에서 잠금 없는 조회 0줄
grep -rn "find_by_id(" src/rooms/application/service.py

# GATE-08
grep -rnE "import .*Model\b|Model," src/*/application src/*/presentation
```

- 게이트 실패 시 구현 에이전트는 오류 요약만 브리핑에 남기고 수정을 반복한다. 같은 게이트를 3회 연속 실패하면 설계 문제로 보고 Architect에 질문한다.

## 2. 테스트 전략

| 순위 | 대상 | 위치 | DB | 방식 |
|---|---|---|---|---|
| 1 | 도메인 불변 규칙(INV-01~15)·거부 순서 | `tests/unit/` | 없음 | `Room`·`Participation`·`User`를 직접 만들고 메서드 호출. 시각은 고정 `datetime` 인자 |
| 2 | 상태 전이(§10 상태 머신 전 행) | `tests/unit/test_room.py` | 없음 | 같음 |
| 3 | 인증·블랙리스트(401) | `tests/integration/test_auth_api.py` | 테스트 DB | `httpx.AsyncClient(transport=ASGITransport(app))` |
| 4 | 예외 형식(400·404·410·422 본문이 문자열 `detail`) | `tests/integration/test_errors.py` | 테스트 DB | 같음 |
| 5 | API 통합(AC-01~14) | `tests/integration/` | 테스트 DB | 같음 |
| 6 | (도전 A, 요청 시) 동시성(AC-18-1~5, CH-A) | `tests/concurrency/` | 테스트 DB | `asyncio.gather`로 동시 요청, 결과 건수 단언 |

- **테스트 작성 담당**: `tests/` 아래 테스트 파일은 QA 티켓이 쓴다(티켓 "산출"에 테스트 경로가 있는 티켓만 테스트를 쓴다). DB·BE·FE 티켓은 테스트를 쓰지 않고, 완료 조건을 확인한 방법(curl·Swagger·브라우저·스크립트)과 결과를 브리핑에 적는다. 다른 단계가 테스트를 남기고 싶으면 브리핑에 제안으로 적고 QA가 옮긴다.
- pytest 설정은 `05-structure-conventions.md` STK-01·STK-11대로 `pyproject.toml`에 둔다(TKT-BE-M2-01).
- 테스트 DB: 환경변수 `TEST_DATABASE_URL`(별도 PostgreSQL DB). `tests/conftest.py`가 세션 시작 시 `drop_all`·`create_all`, 테스트마다 테이블을 `TRUNCATE … RESTART IDENTITY CASCADE`. 시드는 주입하지 않는다(테스트가 직접 만든다). 앱의 `get_db`는 `dependency_overrides`로 테스트 세션 팩토리를 쓴다. 동시성 테스트는 요청마다 다른 세션이 필요하므로 오버라이드도 요청마다 새 세션을 연다.
- SQLite 대체 금지: `timestamptz`(시간대 보존), (도전 A의) 부분 유니크 인덱스·`FOR UPDATE`가 PostgreSQL 동작이다.
- 도메인 테스트에 목(mock)이 필요하면 설계 결함으로 보고 A4·A5로 되돌린다.
- 화면(US-15~17)의 폴링 동작(AC-15-5·6, AC-16-3~6)은 자동 테스트 대상이 아니다. QA가 브라우저 수동 점검 체크리스트로 확인한다.

## 3. AC ↔ 테스트 연결 규칙

- 테스트 함수 이름은 `test_<ac_id_소문자>_<요약>`이다. 예: `AC-02-3` → `test_ac_02_3_join_full_room_rejected`.
- AC 하나에 테스트 하나 이상. 도메인 단위 테스트가 같은 규칙을 덮어도 AC 테스트는 API 수준으로 따로 둔다.
- NFR은 `test_nfr_<번호>_…`(NFR-02·03·05·06) 또는 GATE로 확인한다(NFR-01 → GATE-01, NFR-09 → GATE-06). NFR-04는 AC-18-*과 단위 테스트, NFR-08은 수동 점검.
- QA 브리핑은 AC-ID별 테스트 이름과 결과를 표로 남긴다.
