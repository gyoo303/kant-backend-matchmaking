---
stage: QA
tickets: [TKT-QA-M8-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-AC, PM-DEC, AR-GATE, AR-DB, AR-API, BE-BRIEF, DB-BRIEF]
next_readers: [사람]
---
# QA 브리핑 – TKT-QA-M8-01 팀 엔티티·A팀 우선 배정 검증 (reference/agent-pipeline-blueprint 작업 트리, 커밋 전)

판정: ✅ 배포 가능 (단, 기존 개발 DB는 재생성 필요)

## 요약 (3줄 이내)
- 팀을 도메인 `Team`과 `teams` 테이블로 분리한 변경(D-023, ADR-010)과 A팀 우선 배정(D-024)을 PostgreSQL에서 검증했다. 테스트는 **160개 통과, 실패 0, 건너뜀 0**이다.
- GATE-01~08을 모두 통과했다. 새 DB에서 시드는 1회 58건(팀 16행)이 들어가고, 재기동하면 건너뛴다. 시연 리허설은 33/33을 통과했다.
- API 응답 모양은 바뀌지 않았다. 바뀐 동작은 "두 번째 참가자가 A팀"(AC-02-1) 하나다.

## 실행 환경
- DB: Docker `postgres:16` 컨테이너 `matchmaking-pg`
  - `matchmaking_test`: GATE-04. conftest가 `drop_all`·`create_all`로 새 스키마를 만든다
  - `matchmaking_m8`: 기동·시드·리허설용으로 새로 만들었다
- 사용자 앱 DB(`matchmaking`)와 이전 QA DB(`matchmaking_qa`)는 옛 스키마라서 건드리지 않았다. 지우는 것은 사용자 확인이 필요하다(아래 "사람이 결정할 것")

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-02-1 (두 번째 참가자 A팀) | `test_rooms_api.py::test_ac_02_1_join_assigns_team_a_first_and_order`, `test_room.py::test_d_024_join_fills_team_a_first` | 통과 |
| AC-02-2 (A2·B1 → B) | `test_ac_02_2_join_assigns_team_b_when_a_is_full`, `test_d_024_join_goes_to_b_when_a_is_full` | 통과 |
| AC-02-9 (A1·B2 → A, 신규) | `test_ac_02_9_join_assigns_team_a_when_a_has_space`, `test_d_024_join_goes_to_a_when_a_has_space_after_move` | 통과 |
| AC-02-3~8 | 기존 테스트 | 통과 |
| AC-04-1~6 (팀 변경) | 기존 테스트 (A·A·B·B 배치에서도 기대값 같음) | 통과 |
| AC-06-1·4 (게임 시작·구성) | 기존 테스트, 테이블 목록 단언에 `teams` 추가 | 통과 |
| INV-01·03 (팀 정원) | `tests/unit/test_team.py` 6개, `test_inv_03_three_to_one_composition_cannot_be_built`(B팀 회원이 A로 이동 → 거부) | 통과 |
| RISK-13 (참가의 팀 = 같은 방의 팀) | `test_risk_13_participation_team_belongs_to_same_room`, `test_constructor_fills_team_members_from_current_participations` | 통과 |
| NFR-06 (시드) | `test_nfr_06_seed_twenty_rows_and_idempotent` (+ `teams == rooms × 2`) | 통과 |
| 그 밖의 AC·NFR | 기존 테스트 | 통과 |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| GATE-01 기동 | 새 DB `matchmaking_m8`: `/docs` 200. 1회차 `seed inserted: users=14 rooms=8 teams=16 participations=20 total=58`, 2회차 `seed skipped` | 통과 |
| GATE-02 계층 격리 | 출력 0줄 | 통과 |
| GATE-03 `__init__.py` | 출력 0줄 | 통과 |
| GATE-04 테스트 | 통과 160 / 실패 0 / 건너뜀 0 / 실행 160개 (기존 145 + 신규 15) | 통과 |
| GATE-05 린트·포맷 | `ruff check` 통과, `ruff format --check` 49 files | 통과 |
| GATE-06 비밀값 | 출력 0줄 | 통과 |
| GATE-07 금지 패턴 | 출력 0줄 | 통과 |
| GATE-08 ORM 누출 | 출력 0줄 (정규식에 `TeamModel` 추가) | 통과 |
| 시드 데이터 | 활성 방 `2vs2 시연 방` A1·A2·B3·B4, `한 자리 남음` A5·A6·B7, `Fun Room` A8·A9, `teams` 16행, 방이 어긋난 참가 0건 | 통과 |
| 시연 리허설 | API 33/33 OK (07-screens §5 1~6단계), 서버 로그 500·Traceback 0건 | 통과 |
| 의존성 | 변경 없음 | 해당 없음 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | 로컬 DB `matchmaking`·`matchmaking_qa` | 옛 스키마(`participations.team` 문자열, `teams` 없음)라서 이 코드로 기동하면 방 조회·참가에서 오류가 난다. `create_all`은 기존 테이블을 고치지 않는다 | 옛 DB로 기동 후 방 목록·참가 | DB를 지우고 다시 만든다(DB 브리핑 TKT-DB-M8-01) | 원인 확인(코드 경로) | 사람 |

새로 발견한 기능 버그는 없다.

## AI 부채 체크

- 사람이 이해하기 어려운 코드/과설계:
  - `Room`의 팀원 목록(`Team.members`)과 참가 기록(`Participation.team`)이 같은 정보를 두 곳에 가진다. `Room` 생성자가 팀원을 참가 기록으로 다시 채우고, 변경은 `Room` 메서드를 통해서만 해서 어긋나지 않게 했다. 그래도 `Team.add`/`remove`를 `Room` 밖에서 부르면 어긋날 수 있다.
  - 이 내용은 `04-interfaces-api.md` §2.4에 "`Team`은 `Room`을 통해서만 바뀐다"로 적혀 있다.
- 미래 위험과 최소화 방법:
  - `participations.room_id`와 `teams.room_id`의 일치는 DB가 아니라 `RoomRepository.save`가 보장한다(RISK-13). 다른 경로로 `team_id`를 쓰는 코드가 생기면 깨질 수 있다. 회귀 테스트 `test_risk_13_…`이 있다.
  - 도전 A(동시성)를 진행하면 팀 행 잠금이라는 선택지가 새로 생긴다. ADR-009는 방 행 잠금 기준이라 그대로 동작한다.

## 추가한 테스트

- `tests/unit/test_team.py`(신규): 6개 — 팀 정원, 빈 팀, `add`가 편을 바꿈, 2명이면 거부, 종료 기록 거부, `remove`
- `tests/unit/test_room.py`: 8개 추가·변경
  - 추가: 팀 생성, A팀 우선 3개(D-024), 생성자 팀 검사(3개 매개변수), 팀원 채우기
  - 변경: 팀 변경·3:1 테스트를 A·A·B·B 배치에 맞춤, 생성자 테스트에 `teams` 인자
- `tests/integration/test_rooms_api.py`
  - AC-02-1 기대값 B → A, AC-02-2를 "A 마감 → B"로 바꿈
  - AC-02-9 신규, RISK-13 신규
  - 테이블 목록·시드 건수에 `teams` 추가
- `tests/conftest.py`: `TABLES`에 `teams` 추가

## QA 자율 결정

#### 기동·리허설은 새 DB에서
- 결정: 옛 스키마 DB를 지우지 않고 `matchmaking_m8`을 새로 만들어 `DATABASE_URL`을 덮어 실행했다.
- 선택지: **A. 새 DB (권장·채택)** / B. 기존 `matchmaking`을 지우고 다시 만듦
- 권장 이유: 사용자 데이터를 지우는 일은 사용자 확인이 필요하다. 새 DB로도 "빈 DB에서 첫 기동·시드"를 그대로 확인할 수 있다.
- trade-off: A — 로컬에 DB가 하나 더 남는다. B — 확인 없이 사용자 데이터를 잃는다.

#### AC-02-2 테스트 시나리오 변경
- 결정: 기존 테스트(팀 이동 후 A1·B2 → A)는 AC-02-9로 옮기고, AC-02-2는 AC 문장 그대로 "A2·B1 → B"로 다시 썼다.
- 선택지: **A. AC 문장과 1:1 (권장·채택)** / B. 기존 테스트 이름만 유지
- 권장 이유: 테스트 이름의 AC 번호가 AC 문장과 같은 상황을 검증해야 추적표가 맞는다(`06-quality-gates.md` §3).
- trade-off: A — 테스트 이름이 바뀐다. B — AC-02-2 이름으로 다른 상황을 검증하게 된다.

## 사람이 결정할 것

- **로컬 DB 재생성**: `matchmaking`(앱 DB)와 `matchmaking_qa`는 옛 스키마다. 지우고 다시 만들어야 이 코드로 서버를 띄울 수 있다(명령은 DB 브리핑). 확인용으로 만든 `matchmaking_m8`은 필요 없으면 지워도 된다.
- 팀 노션 등에 올린 ERD·API 명세 원본이 있다면 갱신 여부를 정한다. 저장소 문서는 모두 갱신했다.
