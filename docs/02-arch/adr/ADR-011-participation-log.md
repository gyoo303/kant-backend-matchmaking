# ADR-011: participations 복합 PK와 이용 로그 테이블 `participation_logs`
- 상태: Accepted (user, 2026-10-31)
- 관련 계층: [모듈 협력 구조] [레이어]
- 근거: D-025, REQ-045·046·058, INV-04·10·11·15, RISK-04, ARCH-Q-03, AC-02-8, AC-13-3·5, AC-14-1
- 일부 대체: ADR-009의 "한 회원 한 방 부분 유니크 인덱스" → 이 ADR의 `participations.user_id` `unique=True`

## 맥락
지금까지 `participations`는 자체 `id`를 PK로 두고 현재 참가와 끝난 이용 기록을 한 테이블에 담았다(`left_at IS NULL` = 현재 참가). 사용자가 PK를 `(room_id, user_id)` 복합키로 바꾸고, 같은 방 재입장 이력은 로그 테이블에 남기기로 했다(D-025). 복합 PK에서는 한 방에 같은 회원 행이 하나뿐이므로, 나간 뒤의 행을 어떻게 다룰지 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 기록 유지: 퇴장 때 `left_at`만 채우고 행을 남김. 재입장 때 이전 값을 로그로 옮긴 뒤 같은 행을 UPDATE | 퇴장 흐름이 지금과 같음 | 한 행이 "왔던 사람"과 "지금 있는 사람"을 함께 뜻함, 덮기 전 로그 이동을 빠뜨리면 이력 손실 | 높음 — 재입장 분기가 레포지토리에 숨음 | 충족 | 중 |
| B. 현재 상태: `participations`는 현재 참가만. 퇴장 때 그 체류를 `participation_logs`에 INSERT하고 `participations` 행을 DELETE. 재입장은 새 INSERT | 재입장 PK 충돌 없음, `user_id` `unique=True`로 INV-04를 교안 수준 제약으로 지킴, 로그는 INSERT만 함 | 퇴장·해산마다 두 테이블을 한 트랜잭션으로 씀, 이력 조회가 두 테이블을 합침 | 중 — 이동 규칙이 `RoomRepository.save` 한 곳에 모임 | 충족 | 중 |

## 계층 관점 설명
[모듈 협력 구조] 도메인 흐름은 그대로다. `Room.leave`·`Room.start_game`이 `Participation.end(now)`로 `left_at`을 채우면, `RoomRepository.save`가 (방, 회원)으로 짝지어 `left_at`이 있는 참가를 `participation_logs`로 INSERT하고 `participations` 행을 지운다. 새 참가(행 없음)는 INSERT, 남아 있는 참가는 `team_id`만 갱신한다. 같은 요청(= 한 트랜잭션, commit은 서비스)에서 처리하므로 이력이 사라지거나 두 번 남지 않는다.
[레이어] 도메인 `Participation`은 `id`를 갖지 않고 (`room_id`, `user_id`)로 식별된다. `left_at`은 "이번 요청에서 끝남"을 레포지토리에 알리는 값으로 남는다. 로그는 조회 전용 데이터라 도메인 클래스를 만들지 않고, `RoomQueryRepository`가 읽기 모델(`HistoryItem`, `MyRecord`)로 바꾼다. 이력 응답에서는 기록 ID(`participation_id`)를 뺀다(사용자 결정).

```
participations (현재)        participation_logs (끝난 이용, INSERT만)
PK(room_id, user_id)   ──퇴장·해산──▶  id PK, room_id, user_id,
user_id unique                        join_order, team_id, joined_at, left_at
```

## 결정 / 추천
결정: B — 사용자 선택(D-025). 로그 테이블 이름은 `participation_logs`, ORM 모델은 `ParticipationLogModel`. 퇴장 사유 컬럼은 정의된 요구가 없어 두지 않는다.

## 결과
- 좋아지는 점: 현재 참가 조회에 `left_at IS NULL` 조건이 사라지고, 방을 읽을 때 지난 기록을 함께 읽지 않는다. INV-04가 필수 범위에서도 DB 제약(`unique=True`)으로 지켜진다
- 감수할 점: 이용 이력 = 현재 참가 + 로그를 파이썬에서 합쳐 정렬·페이지를 자른다. 필수 범위에서 같은 회원의 동시 참가·생성은 `unique` 위반 → `IntegrityError` → 500이다(가입 중복과 같은 처리, D-018). 400 변환은 도전 A(TKT-DB-M6-01). 기존 DB는 `create_all`이 테이블을 고치지 않으므로 지우고 다시 만든다. `HistoryItemResponse`에서 `participation_id`가 빠진다
- 후속 작업: TKT-BE-M9-01, TKT-DB-M9-01, TKT-QA-M9-01
