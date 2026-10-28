---
stage: QA
tickets: [TKT-QA-M3-01]
status: partial
inputs_read: [AR-MAP, AR-HAND, PM-AC, AR-GATE, DB-BRIEF, BE-BRIEF, PM-DOMAIN, AR-API, AR-CONV]
next_readers: [BE, DB, 사람]
---
# QA 브리핑 – TKT-QA-M3-01 M3 검증 (matchmaking-jump5 작업 트리)

판정: ⚠️ 조건부

## 요약 (3줄 이내)
- 도메인 단위 테스트 63개를 작성해 모두 통과했다. INV-01~12와 상태 머신, 회원·블랙리스트 규칙을 다룬다.
- rooms API 통합 테스트(AC-01~07 39개)와 오류 형식 테스트(NFR-02 5개)는 작성했지만, 테스트 DB(`TEST_DATABASE_URL`)가 없어 **실행하지 못했다**(44개 건너뜀). 실제 DB 동작은 아직 검증되지 않았다.
- 정적 게이트는 GATE-08 오탐 1건 외에 모두 통과했다. AC-06-4의 "3:1 구성"은 도메인 규칙상 만들 수 없는 사례라 PM 확인이 필요하다.

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-01-1~5 | `tests/integration/test_rooms_api.py::test_ac_01_1_*` ~ `test_ac_01_5_*` | 작성, **미실행**(환경 문제) |
| AC-02-1~8 | `test_ac_02_1_*` ~ `test_ac_02_8_*` | 작성, **미실행** |
| AC-03-1~4 | `test_ac_03_1_*` ~ `test_ac_03_4_*` | 작성, **미실행** |
| AC-04-1~6 | `test_ac_04_1_*` ~ `test_ac_04_6_*` | 작성, **미실행** |
| AC-05-1~5 | `test_ac_05_1_*` ~ `test_ac_05_5_*` | 작성, **미실행** |
| AC-06-1~3, 5, 6 | `test_ac_06_1_*` ~ `test_ac_06_6_*` | 작성, **미실행** |
| AC-06-4 | `test_ac_06_4_start_rejected_without_two_per_team` (참가자 3명만 검증) | 작성, **미실행**. "A팀 3명·B팀 1명" 사례는 만들 수 없음 → 사람이 결정할 것 |
| AC-07-1~5 | `test_ac_07_1_*` ~ `test_ac_07_5_*` | 작성, **미실행**. AC-07-3(로그아웃 후 재로그인)은 M3에서 "같은 회원의 새 요청"으로만 검증, 실제 재로그인은 TKT-QA-M4-01 |
| NFR-02 (400·401·404·410·422 형식) | `tests/integration/test_errors.py::test_nfr_02_*` | 작성, **미실행** |
| INV-01~12 (도메인) | `tests/unit/test_room.py`, `test_participation.py` | 통과 |
| Q-04·D-011 가입 형식, INV-14 블랙리스트 만료 | `tests/unit/test_user.py` | 통과 |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| 테스트 (GATE-04) | `uv run pytest -q` → 통과 63 / 실패 0 / 건너뜀 44 / 실행 63개 | 단위 통과. 통합 44개는 환경 문제(테스트 DB 없음) |
| 린트·포맷 (GATE-05) | `uv run ruff check src tests` 통과, `uv run ruff format --check src tests` 39 files already formatted | 통과 |
| 계층 격리 (GATE-02) | 세 명령 0줄 | 통과 |
| `__init__.py` (GATE-03) | 0줄 | 통과 |
| 비밀값 (GATE-06) | 두 명령 0줄, `.gitignore` 항목 있음 | 통과 |
| 금지 패턴 (GATE-07) | 모든 명령 0줄 | 통과 |
| ORM 누출 (GATE-08) | 문서 명령 1줄 — `src/rooms/presentation/schemas.py:6` pydantic `BaseModel` 오탐. `infrastructure.models` import는 0줄 | 실제 위반 없음(명령 결함, BE 브리핑에서도 보고됨) |
| 기동 (GATE-01) | 미실행 | 환경 문제 — TKT-BE-M3-05에서 사용자 승인으로 건너뜀 |
| 의존성 취약점 | 설계에 점검 도구(pip-audit 등)가 없어 실행하지 않음 | 확인하지 못함 |
| 브랜치 충돌 (`origin/main`, 마지막 커밋 2026-10-22 `355e0b8`) | 충돌 다수: `.env.example`·`.gitignore`·`AGENTS.md`·`scripts/check-handoff.mjs`(내용), `docs/01-pm/*`·`docs/02-arch/*`·브리핑(add/add), `README.md`·`app/*`·`components/*`·`lib/*`·`package*.json`·`next.config.ts`(이 브랜치에서 삭제·main에서 수정) | 이 브랜치가 main의 이전 프로젝트(우분투북스 Next.js)를 대체하는 구조라 생긴 충돌. 머지 대상 결정 필요 → 사람이 결정할 것 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | `docs/01-pm/06-acceptance-criteria.md` AC-06-4 | "A팀 3명·B팀 1명에서 시작 거부"는 INV-03(팀당 2명) 때문에 API로 만들 수 없는 구성이다 | `tests/unit/test_room.py::test_inv_03_three_to_one_composition_cannot_be_built` — 4명 방에서 A팀 이동 시 `TeamFullError` | AC-06-4에서 3:1 사례를 지우거나 "참가자 3명 이하"로 바꾼다 | 재현됨 | PM |
| 중 | `tests/integration/*` | 통합 테스트 44개가 실제 DB에서 한 번도 실행되지 않았다. 레포지토리 쿼리·트랜잭션·시드가 모두 미검증 상태 | `uv run pytest -q -rs` → 44 skipped("TEST_DATABASE_URL이 없어…") | 테스트용 PostgreSQL을 준비해 `TEST_DATABASE_URL`을 넣고 다시 실행 | 재현됨 | 사람(환경) |
| 하 | `docs/02-arch/06-quality-gates.md` GATE-08 | grep 패턴이 pydantic `BaseModel`을 잡는 오탐 | GATE-08 명령 실행 | `grep -rnE "infrastructure\.models" src/*/application src/*/presentation`로 교체 | 재현됨 | ARCH |

- 프로덕션 코드의 버그는 이번 범위(단위 테스트·정적 점검)에서 발견하지 못했다. 실제 DB 실행 전이라 쿼리 수준 버그는 판단하지 못한다.

## AI 부채 체크
- 사람이 이해하기 어려운 코드/과설계: 없음. 도메인 규칙은 `Room` 한 클래스에 모여 있고 테스트 이름이 INV·AC 번호를 그대로 쓴다.
- 미래 위험과 최소화 방법:
  - 필수 범위에는 동시 요청 보호가 없다(D-018, ADR-009 감수할 점). 마지막 자리 동시 참가 등에서 정원 초과·중복 참가, `uq_participations_room_join_order` 충돌로 500이 날 수 있다 → 시연은 순차 조작, 도전 A 요청 시 TKT-DB-M6-01·TKT-BE-M6-00·TKT-QA-M6-01 (반려 사유 아님)
  - 통합 테스트가 실행된 적이 없어, 처음 실행할 때 테스트 코드 자체의 오류도 함께 드러날 수 있다 → 테스트 DB가 준비되면 이 티켓 테스트부터 먼저 돌린다
  - M3 임시 인증 헤더(`X-Debug-User-Id`)가 운영 코드에 있다 → TKT-BE-M4-03에서 제거, TKT-QA-M4-01에서 테스트도 토큰으로 전환

## 추가한 테스트
- `tests/conftest.py`: 테스트용 환경변수, 테스트 DB 엔진(세션 시작 시 drop/create), 테스트마다 TRUNCATE, `get_db` 교체 ASGI 클라이언트(lifespan·시드 없음), 회원 생성 헬퍼. `TEST_DATABASE_URL`이 없으면 통합 픽스처가 건너뛴다
- `tests/unit/test_room.py`: 36케이스(매개변수 포함) — RoomTitle 경계, 생성, 자동 팀 배정, 정원·팀 정원, 다른 방 참가 거부, 같은 방 재참가, 재입장 순서, 제목·팀 변경, 나가기·위임·EMPTY 삭제, 게임 시작·거부, 삭제 방 5개 행위 거부, 생성자 검증
- `tests/unit/test_participation.py`: 7케이스 — 종료, 종료 시각 검증, 종료 후 재종료·팀 변경 거부, 입장 순서·퇴장 시각 생성자 검증
- `tests/unit/test_user.py`: 20케이스 — 아이디·닉네임 거부·경계, 비밀번호 8자, 블랙리스트 만료·빈 jti
- `tests/integration/test_rooms_api.py`: AC-01~07 39개 (미실행)
- `tests/integration/test_errors.py`: NFR-02 5개 (미실행)

## QA 자율 결정

#### 테스트 DB가 없을 때의 통합 테스트 처리
- 결정: 통합 픽스처가 `TEST_DATABASE_URL`이 없으면 `pytest.skip`으로 건너뛴다 — `06-quality-gates.md` §2(GATE-04 "통합·동시성은 TEST_DATABASE_URL 필요")
- 선택지: **A. 없으면 건너뜀 (권장·채택)** / B. 없으면 실패로 처리
- 권장 이유: DB 없이도 단위 테스트와 GATE-04를 돌릴 수 있고, 건너뛴 개수와 이유가 출력에 남는다.
- trade-off: A — "건너뜀"을 통과로 오해할 수 있어 브리핑에 개수를 반드시 적어야 한다. B — DB가 없는 PC에서는 GATE-04가 항상 실패한다.

#### 인증 헤더 헬퍼 위치
- 결정: `auth_header()`를 각 통합 테스트 모듈에 둔다(2줄 중복) — `pyproject.toml`의 `pythonpath = ["src"]`
- 선택지: **A. 모듈마다 정의 (권장·채택)** / B. `pyproject.toml`의 pythonpath에 `.`을 추가해 `tests.conftest`에서 import
- 권장 이유: `pyproject.toml`은 BE 담당 파일이고, 헬퍼는 TKT-QA-M4-01에서 토큰 방식으로 바뀔 임시 코드다.
- trade-off: A — 같은 함수가 두 파일에 있다. B — 다른 단계 파일을 고쳐야 한다.

#### AC-06-4 테스트 범위
- 결정: AC-06-4는 "참가자 3명" 사례만 API 테스트로 쓰고, "3:1 구성"은 만들 수 없음을 단위 테스트로 남긴다 — PM-AC AC-06-4, INV-03
- 선택지: **A. 가능한 사례만 테스트 + 불가 사례 보고 (권장·채택)** / B. DB에 3:1 행을 직접 넣어 시작 거부를 테스트
- 권장 이유: 실제 API로 만들 수 없는 상태를 DB에 직접 넣으면 운영에서 생기지 않는 상황을 검증하게 된다. 판단은 PM에 맡긴다.
- trade-off: A — AC-06-4의 문구 일부가 테스트로 덮이지 않는다. B — 도메인 거부 순서는 확인되지만 DB 제약 우회 코드가 테스트에 생긴다.

## 사람이 결정할 것
- **AC-06-4 수정**: "A팀 3명·B팀 1명" 사례는 만들 수 없다. PM 문서에서 지우거나 바꿀지 결정해 주세요.
- **테스트 DB 준비**: 통합 테스트 44개를 실행하려면 테스트용 PostgreSQL과 `TEST_DATABASE_URL`이 필요합니다. 준비 전까지 M3의 실제 DB 동작(레포지토리·트랜잭션·시드)은 미검증입니다.
- **머지 대상 브랜치**: `origin/main`에는 이전 프로젝트(우분투북스 Next.js)가 있어 이 브랜치와 충돌이 많습니다. 이 브랜치를 main에 합칠지(이전 프로젝트를 대체), 별도로 유지할지 정해 주세요. main에 합친다면 충돌은 이 브랜치 쪽으로 정리하는 것이 자연스럽지만, 그 판단은 사람이 합니다.
- **의존성 취약점 점검**: 설계에 Python 의존성 점검 도구가 없습니다. 필요하면 도구 추가(ADR)를 결정해 주세요.
