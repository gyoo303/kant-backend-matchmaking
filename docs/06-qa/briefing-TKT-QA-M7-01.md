---
stage: QA
tickets: [TKT-QA-M7-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-AC, AR-GATE, AR-API, AR-CONV, FE-BRIEF, QA-BRIEF]
next_readers: [사람]
---
# QA 브리핑 – TKT-QA-M7-01 최종 통합 점검 (reference/agent-pipeline-blueprint, 기준 커밋 3438f9d)

판정: ✅ 배포 가능 (필수 범위, 머지 대상 브랜치 정리는 사람이 결정)

## 요약 (3줄 이내)
- PostgreSQL 16(Docker)에서 GATE-04를 처음으로 실제 실행했다. **145개 통과, 실패 0, 건너뜀 0**이다. TKT-QA-M5-01의 ⚠️ 조건(통합 테스트를 PostgreSQL에서 실행)이 풀려 필수 AC 100%다.
- GATE-01~07은 통과다. GATE-08은 기존과 같은 `BaseModel` 오탐뿐이다. 시드는 첫 기동에 1회 들어가고(42건), 재기동하면 건너뛴다.
- 시연 흐름(`07-screens.md` §5)은 API 리허설 33/33을 통과했다. 화면(로그인·목록·상세·폴링 반영·마감 팀 이동 안내·내 기록)도 PostgreSQL 서버에서 확인했다. 새 기능 버그는 없다.

## 실행 환경
- DB: Docker `postgres:16` 컨테이너 `matchmaking-pg`(localhost:5432)
  - `matchmaking_test`: GATE-04(`TEST_DATABASE_URL`)
  - `matchmaking_qa`: 기동·시드·시연 리허설 전용으로 새로 만들었다. 사용자 앱 DB `matchmaking`은 건드리지 않았다.
- 실행 위치: 저장소 작업 트리(커밋 안 된 변경 없음), Windows + Git Bash, uv 0.12.2

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-01~07 (방 생성·참가·팀·나가기·시작·제목) | `tests/unit/*`, `tests/integration/test_rooms_api.py`, `test_errors.py` (TKT-QA-M3-01) | PostgreSQL 통과 |
| AC-08~11, NFR-03 (인증·블랙리스트) | `tests/integration/test_auth_api.py` (TKT-QA-M4-01) | PostgreSQL 통과 |
| AC-12~14, NFR-02·06·07 (목록·이력·보관 정보·시드) | `test_rooms_api.py`, `test_history_api.py` (TKT-QA-M5-01) | PostgreSQL 통과 (M5-01의 SQLite 참고 실행을 대체) |
| AC-15~17, NFR-08 (화면·폴링) | M5-01 수동 점검표 + 이번 PostgreSQL 화면 재확인(아래 시연 2단계) | 충족 |
| NFR-01 | GATE-01 | 통과 |
| NFR-09 | GATE-06 | 통과 |
| AC-18~20 (도전 A·B·C) | 요청 안 됨(D-018) | 해당 없음 |

### 시연 흐름 리허설 (`07-screens.md` §5)

API는 작업 폴더 스크립트로 실제 서버(`uvicorn`, `matchmaking_qa`)에 요청했다. 화면은 브라우저로 확인했다.

| 단계 | 확인 내용 | 결과 |
|---|---|---|
| 1. 로그인 → 목록 | `seed01` 로그인, 시드 방 5개(최신순), 빈자리 필터 4개, 검색 `2v` 1건, `size=2&page=2` 2건. 화면 목록의 시각이 한국 시각(10-29 10:30 등)이고 4/4 방은 "정원 마감"·[참가] 비활성 | 통과 |
| 2. 방 생성 → 3명 참가 → 팀 이동 | 제목 `"  시연 방  "` → `"시연 방"`, 2:2 자동 배정. 화면: 다른 회원이 API로 참가한 뒤 2초 안에 상세 화면에 반영(B팀 2/2) | 통과 |
| 3. Swagger 정상 요청 | `/docs` 200, `OAuth2PasswordBearer`(Authorize) 존재. 참가·팀 변경 200 | 통과 |
| 4. 규칙 위반 400 | 정원 마감 방 참가 400 "방 정원이 마감되었습니다", 마감 팀 이동 400(화면에 "선택한 팀의 정원이 찼습니다" 표시), 방장 아닌 회원의 시작 400, 3명(2:1)에서 시작 400. **3:1 구성은 만들 수 없음**(기존 이슈, 아래 참고) | 통과 |
| 5. 게임 시작 → 해산 | 방장 시작 200, 목록에서 사라짐, 상세 410, 4명 모두 현재 방 없음, 이용 기록·보관 정보 200, 참가 안 한 회원 보관 정보 404. 화면 "내 이용 기록"에 해산 방 [보관 정보] 표시 | 통과 |
| 6. 로그아웃 → 401 | 로그아웃 200 → 같은 access 토큰 401, 같은 refresh 재발급 401 | 통과 |
| 7. 정리 | 도전 A 미채택이라 동시 참가 스크립트 없음 | 해당 없음 |

리허설 중 서버 로그에 500·Traceback 0건이었다.

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| GATE-01 기동 | `/docs` 200. 1회차 `seed inserted: users=14 rooms=8 participations=20 total=42`, 2회차 `seed skipped: seed01 already exists`, 건수 그대로 | 통과 |
| GATE-02 계층 격리 | 출력 0줄 | 통과 |
| GATE-03 `__init__.py` | 출력 0줄 | 통과 |
| GATE-04 테스트 | 통과 145 / 실패 0 / 건너뜀 0 / 실행 145개 (PostgreSQL, 10.3초) | 통과 |
| GATE-05 린트·포맷 | `ruff check` All checks passed, `ruff format --check` 47 files already formatted | 통과 |
| GATE-06 비밀값 | 출력 0줄. `.gitignore`에 `.venv/`·`__pycache__/`·`.env*`·`!.env.example` 있음. 로컬 `.env`는 무시됨(`git check-ignore`) | 통과 |
| GATE-07 금지 패턴 | 출력 0줄 | 통과 |
| GATE-08 ORM 누출 | 2줄(`from pydantic import BaseModel`) — 정규식 오탐 | 기존 오류(오탐) |
| 프론트 금지 패턴 | `innerHTML` 0건(주석 1줄만) | 통과 |
| 의존성 | 변경 없음(`uv sync` 그대로) | 해당 없음 |
| 브랜치 충돌 | `origin/dev`(020e23c, 2026-10-26)와 **공통 조상 없음**. 그대로는 PR·머지가 안 된다 | 기존(머지 대상 정리 필요) |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | 브랜치 | 작업 브랜치와 머지 대상 `origin/dev`의 히스토리가 이어져 있지 않다. `origin/main`은 원격에서 삭제됐다 | `git merge-base origin/dev HEAD` → 출력 없음 | `--allow-unrelated-histories`로 머지하고 `README.md` 충돌을 해결하거나, `dev`를 이 브랜치로 맞춘다 | 재현됨 | 사람 |
| 하 | `06-quality-gates.md` GATE-08 | 정규식이 pydantic `BaseModel`을 잡는 오탐(기존) | GATE-08 명령 | ORM 모델 이름(`RoomModel` 등)으로 좁히기 | 재현됨 | ARCH |
| 하 | `docs/01-pm/06-acceptance-criteria.md` AC-06-4, `07-screens.md` §5-4 | "3:1 구성에서 게임 시작"은 팀당 2명 규칙(INV-03) 때문에 만들 수 없다(기존, M3-01) | 리허설 4단계: 4명 방에서 마감 팀 이동 400 | 시연 대본을 "3명(2:1)에서 게임 시작 400"으로 바꾼다 | 재현됨 | PM |

새로 발견한 기능 버그는 없다.

## AI 부채 체크

- 사람이 이해하기 어려운 코드/과설계: 이번 티켓은 코드 변경이 없다. 시연에 쓰는 화면·API 흐름은 문서(§5)와 1:1로 맞았다.
- 미래 위험과 최소화 방법:
  - 테스트가 `TEST_DATABASE_URL` 없이도 "통과"로 끝난다(통합 테스트는 건너뜀). README §7에 적혀 있지만, 결과의 skipped 수를 꼭 확인해야 한다. CI를 붙이면 PostgreSQL 서비스와 `TEST_DATABASE_URL`을 넣는다.
  - 시연 리허설 스크립트는 작업 폴더에만 있고 저장소에 넣지 않았다(QA 산출물 범위 밖). 시연 직전에는 같은 흐름을 Swagger로 손으로 한 번 더 따라간다.

## 추가한 테스트

- 없음. 티켓 산출이 브리핑뿐이다. 리허설 스크립트는 작업 폴더 전용이다.

## QA 자율 결정

#### 기동·시연 리허설은 별도 QA DB에서
- 결정: 사용자 앱 DB(`matchmaking`)는 그대로 두고, `matchmaking_qa`를 새로 만들어 `DATABASE_URL` 환경변수로 덮어 실행했다.
- 선택지: **A. 별도 QA DB (권장·채택)** / B. 앱 DB를 지우고 다시 만들기
- 권장 이유: "첫 기동 시드 1회"를 빈 DB에서 확인하면서 사용자가 이미 넣은 데이터를 지우지 않는다.
- trade-off: A — 로컬에 DB가 하나 더 남는다(`dropdb -U postgres matchmaking_qa`로 지울 수 있다). B — 사용자 데이터를 잃는다.

#### 시연 리허설을 API 스크립트 + 화면 일부 확인으로
- 결정: 7단계를 API 스크립트로 전부 확인하고, 화면은 로그인·목록·상세·폴링 반영·오류 안내·내 기록만 브라우저로 확인했다. 해산 시 4개 화면이 목록으로 돌아가는 부분은 M5-01 점검(AC-16-3·4)을 그대로 쓴다.
- 선택지: **A. API 전체 + 화면 핵심 (권장·채택)** / B. 브라우저 4개로 모든 단계를 화면에서
- 권장 이유: 판정에 필요한 규칙·상태 변화는 API로 확실히 확인되고, 화면 동작은 이미 점검표가 있다. PostgreSQL에서 달라질 수 있는 부분(시각 표시·목록·폴링)만 다시 봤다.
- trade-off: A — 실제 시연처럼 브라우저 4개를 동시에 쓰는 장면은 리허설하지 않았다. B — 확실하지만 시간이 많이 든다.

## 사람이 결정할 것

- **머지 대상 정리**: `origin/dev`와 히스토리가 이어져 있지 않다. unrelated-histories 머지로 갈지, `dev`를 이 브랜치로 맞출지 정해 주세요.
- (기존) AC-06-4·시연 4단계의 "3:1 구성" 문구 수정(PM), GATE-08 정규식 수정(ARCH), 비로그인 401 영문 문구 "Not authenticated" 한글 통일 여부(PM·ARCH)
- 시연 전 리허설: 실제 브라우저 4개로 2·5단계(동시 참가, 해산 후 4개 화면 복귀)를 한 번 더 따라갈지
