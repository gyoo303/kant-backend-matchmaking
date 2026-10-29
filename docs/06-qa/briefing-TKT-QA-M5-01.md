---
stage: QA
tickets: [TKT-QA-M5-01]
status: partial
inputs_read: [AR-MAP, AR-HAND, PM-AC, AR-GATE, AR-API, AR-CONV, BE-BRIEF, DB-BRIEF, FE-BRIEF]
next_readers: [FE, 사람]
---
# QA 브리핑 – TKT-QA-M5-01 목록·이력·보관 정보 통합 테스트, 화면 수동 점검 (matchmaking-jump5, 기준 커밋 dff72c6)

판정: ⚠️ 조건부

## 요약 (3줄 이내)
- 통합 테스트 19개를 추가했다(AC-12·13·14, NFR-06·07). 이 저장소에는 PostgreSQL이 없어 GATE-04에서는 건너뛰기로 끝난다. 참고로 작업 폴더의 SQLite 복사본(시간대 보정)에서는 기존 포함 145개가 모두 통과했다.
- 화면 수동 점검 AC-15~17·NFR-08은 모두 충족이다. FE 브리핑의 브라우저 확인 결과를 모으고, 남아 있던 AC-15-2(해산 후 현재 방 링크가 사라짐)를 이번에 직접 확인했다.
- 조건: `TEST_DATABASE_URL`(PostgreSQL)에서 GATE-04를 다시 돌려 0 실패를 확인해야 필수 AC 100%로 판정할 수 있다.

## 수용기준 검증

### 자동 테스트 (API)
| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-12-1 | `test_rooms_api.py::test_ac_12_1_default_list_newest_without_deleted` | PG 미실행 / SQLite 참고 통과 |
| AC-12-2 | `test_ac_12_2_available_only_filter` | 같음 |
| AC-12-3 | `test_ac_12_3_keyword_trimmed_and_case_insensitive` | 같음 |
| AC-12-4 | `test_ac_12_4_keyword_percent_is_literal` | 같음 |
| AC-12-5 | `test_ac_12_5_oldest_sort_breaks_ties_by_id` | 같음 |
| AC-12-6 | `test_ac_12_6_page_size_limits` | 같음 |
| AC-12-7 | `test_ac_12_7_page_beyond_last_is_empty_with_total` | 같음 |
| AC-12-8 | `test_ac_12_8_full_room_marked` | 같음 |
| AC-13-1 | `test_history_api.py::test_ac_13_1_history_newest_first_with_current` | 같음 |
| AC-13-2 | `test_ac_13_2_other_members_history_not_visible` | 같음 |
| AC-13-3 | `test_ac_13_3_rejoin_same_room_creates_two_records` | 같음 |
| AC-13-4 | `test_ac_13_4_history_size_51_is_422` | 같음 |
| AC-14-1 | `test_ac_14_1_archived_room_shows_only_my_records`, `test_ac_14_1_dissolved_room_is_archived` | 같음 |
| AC-14-2 | `test_ac_14_2_never_joined_deleted_room_is_404`, `test_ac_14_2_active_room_is_not_archived` | 같음 |
| NFR-02 | `test_errors.py`(기존 5개) + AC-12-6·13-4·14-2의 `detail` 문자열 확인 | 같음 |
| NFR-03 (이력 노출) | AC-13-2, AC-14-1(다른 회원 닉네임 없음), AC-14-2 | 같음 |
| NFR-06 | `test_nfr_06_seed_twenty_rows_and_idempotent` | 같음 |
| NFR-07 | `test_nfr_07_room_list_default_10_max_50_newest`, `test_nfr_07_history_default_10_newest` | 같음 |

### 화면 수동 점검표 (브라우저, 작업 폴더 임시 서버: 실제 `main.app` + SQLite + 시간대 보정)
| 수용기준 | 확인 방법 | 결과 | 출처 |
|---|---|---|---|
| AC-15-1 | 로그인 → `/`에 목록·생성 폼(제목 1칸)·"2vs2 · 4명 고정" | 충족 | FE-M5-03 |
| AC-15-2 | 참가 중이면 상단 현재 방 링크 / 4인 방에서 다른 회원이 게임 시작 → 목록 화면의 링크가 378ms 뒤 사라짐 | 충족 | FE-M5-03 + 이번 QA(해산 부분) |
| AC-15-3 | 4/4 방 "정원 마감", [참가] `disabled` | 충족 | FE-M5-03 |
| AC-15-4 | 조건 바꿔 제출 → `page` 없음(1페이지), 페이지 링크에 조건 유지 | 충족 | FE-M5-03 |
| AC-15-5 | 목록 요청 간격 997·999·1002ms, 동시 진행 최대 1건 | 충족 | FE-M5-01·03 |
| AC-15-6 | 숨김 중 조회 0건, 복귀 즉시 1건 | 충족(`document.hidden` 바꿔 확인, 실제 탭 전환은 미확인) | FE-M5-01 |
| AC-15-7 | 참가 중 회원이 생성 → "이미 다른 방에 참가 중입니다", 버튼 다시 활성, 제목 유지 | 충족 | FE-M5-03 |
| AC-16-1~7 | 인원·팀·방장 표시, 다른 회원 참가 448ms 반영, 방장만 제목 변경·게임 시작, 시작 성공 → `/`, 다른 참가자 → `/?notice=dissolved`, 통신 실패 시 마지막 정보 유지, 401 → `/login?expired=1`, 없는 방 "방을 찾을 수 없습니다" | 충족 | FE-M5-04 |
| AC-17-1 | 가입 실패 시 사유 표시, 아이디·닉네임 유지, 비밀번호만 비움 | 충족 | FE-M5-02 |
| AC-17-2~4 | 0건 안내, 11건 → 10건 + 다음 페이지, 삭제 방만 [보관 정보] → 보관 정보 화면 | 충족 | FE-M5-05 |
| AC-14-3 | 보관 정보 화면 버튼 0개 | 충족 | FE-M5-05 |
| NFR-08 | 목록·상세 1초 조회, 다른 사용자 변경 2초 안 반영(참가 448ms, 해산 링크 378ms) | 충족 | FE-M5-03·04 + 이번 QA |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| GATE-01 기동 | PostgreSQL 없음으로 실행 못 함. 같은 `main.app`을 SQLite 임시 서버로 띄워 화면 확인 | 환경 문제 |
| GATE-02 계층 격리 | 출력 0줄 | 통과 |
| GATE-03 `__init__.py` | 출력 0줄 | 통과 |
| GATE-04 테스트 | 통과 63 / 실패 0 / 건너뜀 82 (통합 테스트는 `TEST_DATABASE_URL` 없어 건너뜀). 참고: SQLite 복사본 145 통과 / 0 실패 | 환경 문제(통합 미실행) |
| GATE-05 린트·포맷 | `ruff check` 통과, `ruff format --check` 47개 파일 통과 | 통과 |
| GATE-06 비밀값 | 출력 0줄, `.gitignore`에 `.venv`·`__pycache__`·`.env*`·`!.env.example` 있음 | 통과 |
| GATE-07 금지 패턴 | 출력 0줄 | 통과 |
| GATE-08 ORM 누출 | 2줄(`from pydantic import BaseModel`) — 정규식이 `BaseModel`에 걸리는 오탐 | 기존 오류(오탐, M3·M4 브리핑과 같음) |
| 프론트 금지 패턴 | `innerHTML` 사용 0건(주석 1줄만), 템플릿 인라인 스타일 0건 | 통과 |
| 의존성 | 변경 없음 | 해당 없음 |
| 브랜치 충돌 | `origin/main`과 충돌 다수(머지 대상 미정, 이전 브리핑과 같음) | 기존 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | GATE-04 | 통합 테스트가 PostgreSQL에서 한 번도 실행되지 않았다 | `uv run pytest -q` → 82 skipped | `TEST_DATABASE_URL`을 준비해 다시 실행 | 재현됨 | 사람 |
| 하 | `06-quality-gates.md` GATE-08 | 정규식이 pydantic `BaseModel`을 잡는 오탐(기존) | GATE-08 명령 | `Model,`·`import .*Model\b` 대신 ORM 모델 이름(`RoomModel` 등)으로 좁히기 | 재현됨 | ARCH |

새로 발견한 기능 버그는 없다.

## AI 부채 체크

- 사람이 이해하기 어려운 코드/과설계: 없음. 테스트는 기존 도우미(`create_room`·`join`·`leave`) 방식을 그대로 썼다. 목록 테스트용 `make_listing`은 회원 18명 구성을 docstring에 적었다.
- 미래 위험과 최소화 방법:
  - SQLite 참고 실행은 `timestamptz`·`ILIKE`·`TRUNCATE` 동작이 PostgreSQL과 다르다. PostgreSQL에서 다시 실행하기 전까지 통과로 보지 않는다.
  - AC-12-5 테스트는 SQL `UPDATE`로 생성 시각을 같게 만든다. 컬럼 이름(`rooms.created_at`)이 바뀌면 함께 고쳐야 한다.
  - NFR-06 테스트는 `seed_initial_data`를 직접 세 번 부른다(lifespan 재시작 대신). 시드 함수 이름·인자가 바뀌면 함께 고쳐야 한다.

## 추가한 테스트

- `tests/integration/test_rooms_api.py`: 10개 추가 — AC-12-1~8, NFR-07(목록), NFR-06(시드 20건 이상·4인 방·재실행 2회 건수 유지)
- `tests/integration/test_history_api.py`(새 파일): 9개 — AC-13-1~4, AC-14-1(삭제·해산 2개), AC-14-2(참가 안 한 삭제 방·활성 방 2개), NFR-07(이력)
- 합계: 19개 테스트 함수(기존 포함 통합 82개)

## QA 자율 결정

#### SQLite 복사본으로 참고 실행
- 결정: 작업 폴더에 `tests/`를 복사하고 conftest의 `TRUNCATE`를 `DELETE`로, 시각에 UTC를 붙이는 보정을 넣어 SQLite로 실행했다. 판정 근거로는 쓰지 않고 테스트 로직 확인용으로만 쓴다 — `06-quality-gates.md` §2(SQLite 대체 금지)
- 선택지: **A. 작업 폴더 참고 실행 (권장·채택)** / B. 실행하지 않고 작성만
- 권장 이유: PostgreSQL이 없어도 새 테스트의 오타·기대값 실수를 미리 잡을 수 있고, 저장소에는 SQLite 흔적이 남지 않는다.
- trade-off: A — PostgreSQL 고유 동작(ILIKE·시간대)은 확인하지 못해 "통과"로 오해할 수 있다(브리핑에서 구분). B — 첫 PostgreSQL 실행에서 단순 실수가 섞여 원인 찾기가 늦어진다.

#### 화면 수동 점검은 FE 브리핑 결과를 모으고 빈 칸만 재확인
- 결정: AC-15~17은 FE 티켓에서 브라우저로 확인한 결과를 출처와 함께 옮기고, "부분 충족"이었던 AC-15-2 해산 부분만 이번에 다시 확인했다 — `06-quality-gates.md` §2(폴링은 수동 점검)
- 선택지: **A. 모으고 빈 칸만 재확인 (권장·채택)** / B. 모든 항목을 처음부터 다시 확인
- 권장 이유: 같은 코드·같은 임시 서버로 이미 확인한 항목이라 다시 하면 토큰만 든다.
- trade-off: A — FE 확인 이후 바뀐 공통 CSS(`.cell-title`·`[hidden]`)는 목록·상세 화면 표시만 재확인했다. B — 확실하지만 시간이 많이 든다.

#### AC-14-2에 활성 방 케이스 추가
- 결정: "참가 중인 활성 방도 보관 정보는 404"를 AC-14-2 테스트로 넣었다 — US-14·API-ROOM-11은 삭제 방 대상, PAGE-06 404 문구
- 선택지: **A. 추가 (권장·채택)** / B. AC 문장 그대로 삭제 방만
- 권장 이유: 보관 정보가 활성 방 정보를 새로 노출하지 않는지 확인하는 경계값이다.
- trade-off: A — AC 문장보다 한 걸음 넓다(이름에 의도를 적음). B — 활성 방 노출을 놓칠 수 있다.

## 사람이 결정할 것

- PostgreSQL 테스트 DB(`TEST_DATABASE_URL`)를 준비해 GATE-04를 실행할지. 실행 전까지 판정은 ⚠️ 조건부다.
- (기존) GATE-08 오탐 정규식 수정 여부(ARCH), `origin/main`과의 충돌 정리 시점(머지 대상 결정)
- (기존, 이전 브리핑) AC-06-4·시연 4단계의 3:1 구성은 만들 수 없음, 401 영문 문구 "Not authenticated"
