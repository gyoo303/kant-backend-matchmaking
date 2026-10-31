# ADR-009: 동시 요청 무결성을 도전 A로 이동
- 상태: Accepted (user, 2026-10-28)
- 관련 계층: [모듈 협력 구조] [인프라]
- 근거: D-018(D-002 번복), RISK-03~05, ARCH-Q-02, INV-02~08, REQ-098~104, REQ-107, NFR-04, AC-18-*, CH-A
- 대체: ADR-006
- 일부 대체됨: 한 회원 한 방 부분 유니크 인덱스(`uq_participations_user_current`) → ADR-011의 `participations.user_id` `unique=True`. 도전 A에 남은 범위는 방 행 잠금, `IntegrityError` → `AlreadyParticipatingError` 변환, 재현 테스트다

## 맥락
사용자가 동시 요청 무결성을 필수에서 빼고 도전 A로 옮기기로 했다(D-018). 방 행 잠금과 한 회원 한 방 부분 유니크 인덱스도 도전 A에 포함한다. 필수 범위에서 무엇이 남고, 도전 A가 무엇을 추가하는지 경계를 다시 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 필수: 잠금 없는 `find_by_id` → 도메인 검사 → `save` → `commit`. 도전 A: `find_by_id_for_update`(방 행 `FOR UPDATE`)로 교체 + `uq_participations_user_current` 부분 유니크 인덱스 + `IntegrityError` → `AlreadyParticipatingError` 변환 + 재현 테스트 | 필수 구현이 가장 단순, 도전 A는 레포지토리 메서드 1개·인덱스 1개·서비스 조회 호출 교체로 끝남 | 필수 범위에서는 동시 요청 시 정원 초과·중복 참가가 생길 수 있음 | 낮음 — 교체 지점이 서비스 5개 메서드의 조회 한 줄 | 충족(도전은 필수 아님) | 낮음 |
| B. 필수에 잠금을 두고 인덱스만 도전으로 | 같은 방 경합은 필수에서 막음 | 사용자 결정(D-018)과 어긋남 | 중 | 충족 | 낮음 |

## 계층 관점 설명
[모듈 협력 구조] 필수 흐름은 `RoomRepository.find_by_id(room_id)` → 도메인 메서드 → `save` → `commit`이다. 도메인 규칙(정원·팀 정원·방장·삭제 상태·한 방)은 순차 요청에서 그대로 지켜진다. 도전 A는 서비스의 조회 호출만 `find_by_id_for_update`로 바꿔 같은 방 요청을 차례로 처리하게 하고, 서로 다른 방에 걸친 한 회원 한 방 규칙은 부분 유니크 인덱스로 DB에서 막는다. 도메인 코드는 바뀌지 않는다.
[인프라] 커넥션 풀 값(`pool_size=10`, `max_overflow=10`)은 처음부터 설정(ADR-003)으로 두고, 도전 A에서 동시 요청 재현으로 값을 확인한다. 도전 A 재현은 `tests/concurrency/test_room_concurrency.py`가 실제 DB에 `asyncio.gather`로 AC-18-1~5 요청을 동시에 보내고 결과 건수를 단언한다.

## 결정 / 추천
결정: A — 필수 범위를 가장 가볍게 두고, 도전 A가 교체·추가할 지점을 한정한다.

## 결과
- 좋아지는 점: M3 구현 분량 감소, 도전 A 범위가 티켓 3개(DB·BE·QA)로 분리됨
- 감수할 점: 필수 범위에서는 마지막 자리 동시 참가 등에서 규칙이 깨질 수 있고, `uq_participations_room_join_order` 충돌이 500으로 나올 수 있음. 시연은 순차 조작으로 진행한다
- 후속 작업: TKT-DB-M6-01, TKT-BE-M6-00, TKT-QA-M6-01 (사용자 요청 시에만 착수)
