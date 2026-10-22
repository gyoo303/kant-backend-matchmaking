---
stage: FE
tickets: [TKT-FE-M3-02]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [주문 현황·주문 처리] TKT-FE-M3-02 `/mypage/orders`, `/admin/orders`
결론: 두 화면을 실제 액션(API-11·12·13)에 연결 · 상태별 모양은 미리보기로 확인, 실제 상태 전이는 세션이 없어 못 봄

## 사람이 결정할 것
- 없음

## 이해 가이드
- 회원: `app/mypage/orders/page.tsx` → `requireMember` → `getMyOrders()`(RLS + 본인 행만, AC-09-4) → 주문 상자. 버튼은 `components/MemberOrderActions.tsx`(client)가 `requestCancel`·`withdrawCancel`·`cancelPending`·`retryPayment`를 부른다. 성공하면 BE `revalidateCancelScreens()`가 화면을 다시 그리고, 지금 상태에서 안 되는 요청이면 액션이 준 "현재 상태" 문구를 상자 안에 보인다(AC-09-7).
- 책방지기: `app/admin/orders/page.tsx` → `getKeeperOrders()`(paid·cancel_requested, 결제 순) → 상자. `components/KeeperOrderActions.tsx`가 `shipOrder`·`refund`·`rejectCancel`. 처리 중에는 그 상자의 버튼을 모두 막는다.
- 먼저 읽을 파일: `app/mypage/orders/page.tsx` — 상태별 표시 / `components/KeeperOrderActions.tsx` — 환불·거절·발송 / `components/OrderSteps.tsx` — 2단계 표시

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-09-1 | 주문 접수 → "주문 접수 → 발송됨" 2단계 중 1단계 | 충족(미리보기) | `OrderSteps`, `aria-label="주문 접수, 발송됨 중 주문 접수 단계"`(`SCR-12-orders-*.png`) |
| AC-09-2 | [취소 요청] → "취소 요청을 책방지기에게 전했어요" | 충족(미리보기) | `cancel_requested` 상자의 `--accent` 안내 + [취소 요청 철회]. 문구는 `CANCEL_REQUESTED_MESSAGE` |
| AC-09-3 | 발송된 주문엔 [취소 요청] 없음 | 충족(미리보기) | shipped 상자 버튼 0개 |
| AC-09-4 | 남의 주문 안 보임 | BE | 목록만 있고 주문 상세 주소가 없다. 조회는 본인 행만 |
| AC-09-5 | [취소 요청 철회] → 주문 접수 | 코드 | `withdrawCancel` |
| AC-09-6 | 거절된 주문 문구 | 충족(미리보기) | `CANCEL_REJECTED_MESSAGE`, 버튼 없음(시안대로) |
| AC-09-7 | 환불 완료 주문 철회 시도 → 현재 상태 안내 | 코드 | 액션 `INVALID_STATE`의 `message`를 상자 안 `role="alert"`로 |
| AC-10-1 | [발송 완료] → 회원 화면 "발송됨" | 코드 | `shipOrder` 후 BE가 `/mypage/orders` revalidate |
| AC-10-2 | 취소 요청 [환불] → 환불 완료 | 코드 | `refund` |
| AC-10-3 | 환불 실패 → "환불하지 못했어요" | 충족(미리보기) | 실패 문구가 그 상자 안에 보임(`SCR-13-admin-orders-refund-failed-*.png`) |
| AC-10-4 | 취소 요청 주문 [발송 완료] 막힘 | 충족(미리보기) | 버튼 `disabled` + REJ-22 문구, 상자 테두리 `--destructive`(`SCR-13-admin-orders-*.png`) |
| AC-10-5 | [환불] 2회 → 1회만 | 부분 | 처리 중 버튼을 막는다(화면). 최종 보장은 BE `begin_refund` 잠금 |
| AC-10-6 | [취소 거절] → 주문 접수, 발송 가능 | 코드 | `rejectCancel` |
| UX-D-09 | 회원 화면 빨간 버튼 없음, 환불만 빨간 외곽선 | 충족 | 회원 버튼은 외곽선·글자, 관리자 [환불]만 `--destructive` 외곽선 |
| AC-05-6 | 비회원 `/mypage/orders`·`/admin/orders` → 로그인 | 충족 | 307 `/login?next=…` |

## 선택과 이유
- 결제 대기 주문(`pending_payment`)도 목록에 보인다: 결제창을 닫은 주문을 다시 찾을 곳이 여기뿐이다. [다시 결제하기](API-08) + [주문 거두기](API-12, D-037)를 둔다. 결제 전 취소·환불 완료는 2단계 표시 대신 상태 배지(`ORDER_STATUS_LABELS`).
- 날짜는 `components/format-date.ts`가 한국 시각으로 `YYYY-MM-DD`를 만든다(서버·브라우저 같은 결과).
- 관리자 상자에 주문 번호를 한 줄 더 넣었다. 회원 문의와 맞춰 보기 위해서다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 실제 상태 전이(취소 요청 → 거절·환불 → 회원 화면)를 못 봄 | 액션 결과 메시지·버튼 막기 확인 | QA-M3 |
| 결제 대기 주문이 쌓일 수 있음(TKT-FE-M3-01 위험과 같음) | [주문 거두기] 제공 | — |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류·경고 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄 / UX-1 새 파일 0건 / UX-5·19 0건
- 스크린샷: `SCR-12-orders-*`(상태 6가지), `SCR-13-admin-orders-*`, `SCR-13-admin-orders-refund-failed-*` (미리보기)
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- [주소록 내려받기]와 "지금 보낼 책이 없어요"의 주소록 안내(AC-19)는 HANDOFF대로 TKT-FE-M4-03에서 붙인다. 다만 목록이 비었을 때 문구는 같은 PM 문구 "지금 보낼 책이 없어요"를 미리 썼다.
- 결제 대기 주문 안내 "결제가 끝나지 않았어요. 다시 결제하거나 주문을 거둘 수 있어요."와 버튼 이름 [주문 거두기]는 명세에 없다(SCR-12 시안에 결제 대기 상태가 없음).
- 주문 처리 목록 실패 문구 "주문을 불러오지 못했어요", 로딩 문구는 명세에 없다.

## 기록 필요
- 주문 현황에 결제 대기 주문을 보이고 [다시 결제하기]·[주문 거두기]를 둔 판단.

## 변경 범위
- 추가: `app/mypage/orders/page.tsx`, `app/admin/orders/page.tsx`, `components/MemberOrderActions.tsx`, `KeeperOrderActions.tsx`, `OrderSteps.tsx`, `format-date.ts`, 이 브리핑, 스크린샷
- TKT-FE-M3-01의 `RetryPaymentButton`, `button-styles.ts`를 함께 쓴다
- 새 의존성 없음

## 확인하지 못한 것
- 실제 취소 요청·철회·거절·환불·발송과 두 화면 사이 반영
- 마이페이지 "주문 현황" 옆 건수(TKT-FE-M2-01에서 미룬 것)는 이번에도 넣지 않았다
