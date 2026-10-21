# ADR-004: 결제 대행사(PG)와 결제 확정·환불 방식
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [인프라] [모듈 협력 구조]
- 근거: D-002, D-003, D-031, DRV-C-05, RISK-01~04, INV-04·06, NFR-07·19, AC-08-4~8, AC-10-2~5, AC-11-10, →ARCH A-01

## 맥락
주문과 회차가 같은 단건 결제를 쓰고(D-002), 관리자 [환불]이 PG 전액 취소까지 해야 한다. 확정은 반드시 서버에서 금액을 대조하고 1회만 일어나야 한다.
(출처: docs.tosspayments.com/reference, developers.portone.io v2 — 2026-10 조사)

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 토스페이먼츠 직접 연동(결제창 SDK `@tosspayments/tosspayments-sdk` 2.x + 서버 `POST /v1/payments/confirm`, 취소 `POST /v1/payments/{paymentKey}/cancel`) | 가입만으로 테스트 키, 서버 승인 API가 금액을 함께 받음, 모든 POST에 `Idempotency-Key` 공식 지원 | 웹훅 서명 없음(본문 secret 비교) → 웹훅은 재조회 용도로만 | 낮음 | 없음 | 중 |
| B. 포트원 V2(`@portone/browser-sdk` + `@portone/server-sdk`) | PG 교체 쉬움, 웹훅 표준 서명 | confirm 없이 조회 검증 → 확정 경로가 리다이렉트·웹훅 2개, 멱등키 미확인, 패키지 2개 | 중 | 없음 | 중 |

## 계층 관점 설명 (A 기준)
```
1 Server Action createPayment: 서버가 금액 계산 → payments(status=ready, amount, order_id|round_id, pg_order_id) 저장
2 브라우저: 토스 결제창(requestPayment, orderId=pg_order_id, amount) → successUrl / failUrl
3 GET /api/payments/toss/success?paymentKey&orderId&amount (Route Handler)
   ├ payments 조회(pg_order_id) → amount 불일치면 확정 안 함(승인 호출 전 차단, NFR-19)
   ├ lib/payments/toss.confirm(paymentKey, orderId, amount, Idempotency-Key=pg_order_id)
   └ rpc confirm_payment(pg_order_id, paymentKey, approvedAmount) — 재고·상태 원자 반영
      실패(재고 부족·금액 불일치) → toss.cancel(전액, Idempotency-Key=cancel-<id>) 보상 (RISK-03)
4 환불: rpc begin_refund(잠금) → toss.cancel → rpc complete_refund / fail_refund
```
- [모듈 협력 구조] 확정 1회 보장은 ① `payments.pg_payment_key unique` ② RPC의 `where status = 'ready'` 조건부 갱신 ③ PG 멱등키 3중이다(RISK-01). 웹훅은 이번 범위에 두지 않는다(리다이렉트 확정 + 실패 시 사용자가 [다시 결제하기]). 

## 결정
선택 **A** — 서버 승인 API 1개와 공식 멱등키로 확정·환불 경로가 각각 1개가 된다. 4일 일정에 가장 단순하다.

## 결과
- 좋아지는 점: 확정 진입점 1개, 클라이언트 금액 불신(NFR-19) 구조로 강제
- 감수할 점: 승인 후 브라우저가 success 리다이렉트 전에 닫히면 결제는 승인 대기로 남다가 10분 뒤 만료(돈은 빠지지 않음) → 주문은 `pending_payment` 유지(AC-08-4)
- 후속: TKT-BE-M3-02~05, TKT-DB-03(`payments`, RPC)
