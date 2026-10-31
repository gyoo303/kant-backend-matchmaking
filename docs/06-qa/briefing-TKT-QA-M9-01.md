---
stage: QA
tickets: [TKT-QA-M9-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-AC, PM-DEC, AR-GATE, AR-DB, AR-API, BE-BRIEF, DB-BRIEF]
next_readers: [사람]
---
# QA 브리핑 – TKT-QA-M9-01 현재 참가·이용 로그 분리 검증 (reference/agent-pipeline-blueprint)

판정: ✅ 배포 가능 (단, 기존 개발 DB는 재생성 필요)

## 요약 (3줄 이내)
- `participations`를 복합 PK(`room_id`+`user_id`)·`user_id` unique로 바꾸고, 끝난 이용을 `participation_logs`로 옮기는 변경(D-025, ADR-011)을 PostgreSQL 16에서 검증했다. 테스트 **164개 통과, 실패 0, 건너뜀 0**.
- GATE-01~08 모두 통과. 새 DB에서 시드 1회 60건(현재 참가 11 + 로그 11), 재기동하면 건너뛴다. API 리허설에서 퇴장·재입장·해산 후 이력과 보관 정보가 맞게 나왔다.
- API 변화는 이용 이력 항목에서 `participation_id`가 빠진 것 하나다(AC-13-5). 화면 템플릿은 이 필드를 쓰지 않는다.

## 실행 환경
- DB: 로컬 PostgreSQL 16(conda-forge, 세션 임시 폴더, 포트 55432). Docker·Homebrew PostgreSQL은 이 환경에 없었다
  - `matchmaking_test`: GATE-04. conftest가 `drop_all`·`create_all`로 새 스키마를 만든다
  - `matchmaking_m9`: 기동·시드·리허설용 새 DB
- 사용자의 기존 앱 DB는 건드리지 않았다(옛 스키마라서 재생성 필요, 아래 "사람이 결정할 것")

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-02-7 (같은 방 반복 참가 → 기록 변화 없음) | `test_ac_02_7_join_same_room_again_keeps_records` | 통과 |
| AC-02-8 (재입장 → 새 기록, 이전 기록은 로그) | `test_ac_02_8_rejoin_creates_new_record`, `test_risk_14_rejoin_keeps_old_log_and_adds_current`(로그 입장 순서 2·3, 현재 4) | 통과 |
| AC-05-3 (마지막 퇴장 → 방 삭제, 기록 보존) | 기존 테스트 + `test_risk_14_leave_moves_participation_to_log` | 통과 |
| AC-06-1 (해산 → 전원 종료, 결과 테이블 없음) | 기존 테스트(테이블 목록에 `participation_logs` 추가), `test_risk_14_start_game_moves_all_to_logs` | 통과 |
| AC-13-1~4 (이력 최신순·본인만·재입장 2건·size 51 → 422) | 기존 테스트. AC-13-3은 기록 ID 비교 대신 현재/종료 구분으로 바꿈 | 통과 |
| AC-13-5 (이력 항목에 기록 ID 없음, 신규) | `test_ac_13_5_history_item_has_no_record_id` | 통과 |
| AC-14-1·2 (보관 정보 = 본인 로그만) | 기존 테스트 | 통과 |
| INV-04 (DB: PK·`user_id` unique) | `\d participations`로 `participations_pkey (room_id, user_id)`, `participations_user_id_key` 확인 | 통과 |
| RISK-14 (로그 이동 누락·중복) | 위 `test_risk_14_*` 3개 | 통과 |
| NFR-06 (시드 20건 이상, 재기동 2회 그대로) | `test_nfr_06_seed_twenty_rows_and_idempotent`(+ `participations == 11`, `participation_logs == 11`) | 통과 |
| 그 밖의 AC·NFR | 기존 테스트 | 통과 |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| GATE-01 기동 | 새 DB `matchmaking_m9`: `/docs` 200. 1회차 `seed inserted: users=14 rooms=8 teams=16 participations=11 participation_logs=11 total=60`, 2회차 `seed skipped` | 통과 |
| GATE-02 계층 격리 | 출력 0줄 | 통과 |
| GATE-03 `__init__.py` | 출력 0줄 | 통과 |
| GATE-04 테스트 | 통과 164 / 실패 0 / 건너뜀 0 / 실행 164개 (기존 160 + 신규 4) | 통과 |
| GATE-05 린트·포맷 | `ruff check` 통과, `ruff format --check` 49 files | 통과 |
| GATE-06 비밀값 | 출력 0줄 | 통과 |
| GATE-07 금지 패턴 | 출력 0줄 | 통과 |
| GATE-08 ORM 누출 | 출력 0줄 (정규식에 `ParticipationLogModel` 포함) | 통과 |
| 시드 데이터 | D2 "아무도 없음" 로그: seed12 순서 1·3, seed13 순서 2 (재입장 예시) | 통과 |
| API 리허설 | seed12 이력 2건(D2 로그) → "초보 환영" 참가·퇴장·재입장 후 4건(현재 1 + 로그 3) → 퇴장. seed01 "2vs2 시연 방" 게임 시작 200 → 상세 410 → 보관 정보 본인 기록 1건. 서버 로그 500·Traceback 0건 | 통과 |
| 의존성 | 변경 없음 | 해당 없음 |
| 브랜치 충돌 | 작업 브랜치에 바로 커밋(원격 비교 안 함) | 확인하지 못함 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 | 로컬 앱 DB(`matchmaking` 등) | 옛 스키마(`participations.id`·`left_at`)가 남아 있으면 `create_all`이 고치지 않아 참가·이력에서 오류가 난다 | 옛 DB로 기동 후 참가 | DB를 지우고 다시 만든다(DB 브리핑 TKT-DB-M9-01) | 원인 확인(코드 경로) | 사람 |

새로 발견한 기능 버그는 없다.

## AI 부채 체크
- 사람이 이해하기 어려운 코드: `RoomRepository.save`의 짝짓기 키가 (`user_id`, `join_order`)인 이유(같은 `Room` 객체 안 재입장)는 DB 브리핑 자율 결정에 적혀 있다
- 미래 위험과 최소화 방법:
  - 같은 `Room` 객체로 `save`를 두 번 부르면 끝난 참가가 로그에 두 번 들어간다(DB 브리핑 "다음 단계가 쓸 것"). 지금 서비스·시드는 한 번만 부른다. 서비스를 바꿀 때 `save`가 돌려준 `Room`을 쓰도록 유지한다
  - 같은 회원의 동시 참가는 `participations_user_id_key` 위반 → 500(필수 범위, D-018). 도전 A에서 400 변환

## 추가한 테스트
- `tests/integration/test_history_api.py`: `test_ac_13_5_history_item_has_no_record_id` 1개(AC-13-5). AC-13-3의 기록 ID 비교를 현재/종료 구분으로 바꿈
- `tests/integration/test_rooms_api.py`: `test_risk_14_*` 3개(퇴장·재입장·해산 후 두 테이블 행), 테이블 목록·시드 건수에 `participation_logs` 추가, 4인 방 조건에서 `left_at` 제거
- `tests/unit/test_participation.py`·`test_room.py`·`test_team.py`: `Participation` 생성 인자에서 `id` 제거
- `tests/conftest.py`: TRUNCATE 목록에 `participation_logs` 추가

## QA 자율 결정

#### 로그 이동은 API 응답이 아니라 테이블 행으로 확인
- 결정: RISK-14 테스트는 `session_factory`로 `participations`·`participation_logs`를 직접 세어 확인한다 — ADR-011, RISK-14
- 선택지: **A. 테이블 행 직접 확인 (권장·채택)** / B. 이력 API 응답만 확인
- 권장 이유: 이력 API는 두 테이블을 합쳐 보여 주므로, 행이 지워지지 않고 로그가 추가되는 실수(이력 중복)를 응답 건수만으로는 정확히 구분하기 어렵다.
- trade-off: A — 테스트가 테이블 이름에 묶인다. B — 구현 세부와 무관하지만 이동 누락·중복 원인을 가려내기 어렵다.

## 사람이 결정할 것
- 기존 로컬 DB(`matchmaking`, 이전 QA DB들)를 지우고 다시 만들지. 이 변경은 스키마 재생성이 필요하다
