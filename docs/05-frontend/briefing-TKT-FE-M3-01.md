---
stage: FE
tickets: [TKT-FE-M3-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [구매] TKT-FE-M3-01 `/cart`, `/checkout`, `/checkout/result`, `/mypage/address`
결론: 화면 4개를 실제 액션(API-05·06·07·08)과 토스 결제창에 연결 · 회원 세션이 없어 실제 결제 한 바퀴는 돌려 보지 못함(아래 표)

## 사람이 결정할 것
- 없음

## 이해 가이드
- 장바구니: `app/cart/page.tsx`가 `<Suspense>` 안에서 `requireMember('/cart')` → `getCartLines()`. 줄마다 `components/CartLineControls.tsx`(client)가 `updateCartQuantity`·`removeCartItem`(API-05)을 부르고, 액션의 `refresh()`가 합계를 다시 그린다.
- 주문서: `app/checkout/page.tsx`가 `getCartLines()`·`getShippingAddress()`로 그린다. `components/CheckoutForm.tsx`가 ① `shippingErrors()`(BE `shippingInputSchema`와 같은 스키마)로 빈칸·형식을 먼저 막고 ② `startOrderPayment`(API-07) → `PaymentRequest` ③ `components/toss-payment.ts`의 `openTossPayment()`로 결제창을 연다.
- 결제창 결과는 토스가 API-09·10으로 보내고, BE가 `/checkout/result?status&code&target&id&contact`로 보낸다. 결제창을 닫아 Promise가 실패하면 `openTossPayment`가 API-10(`/api/payments/toss/fail`)으로 보내 같은 결과 화면으로 간다.
- 결과: `app/checkout/result/page.tsx`가 쿼리를 읽어 주문 완료(`getMyOrder`로 번호·금액) / 편지 회차 완료 / 미완료(코드별 문구 + `RetryPaymentButton` → `retryPayment` API-08)를 그린다.
- 먼저 읽을 파일: `components/toss-payment.ts` — 결제창·닫기 처리 / `components/CheckoutForm.tsx` — 결제 전 검사 / `app/checkout/result/page.tsx` — 결과 분기

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-07-1 | 담으면 "장바구니에 담았어요" + Header 개수 | TKT-FE-03 | 상세 [장바구니 담기](TKT-FE-03), Header 개수는 `getCartCount`(TKT-FE-01) |
| AC-07-2 | 수량 2→3이면 합계가 바로 바뀜 | 코드 | 수량 버튼 → `updateCartQuantity` → 액션 `refresh()`로 서버가 합계를 다시 계산 |
| AC-07-3 | 같은 책 다시 담으면 수량 +1 | BE | `addToCart`(upsert) |
| AC-07-4 | 재고 2권에 3 → 2로 맞춤 + "남은 책은 2권이에요" | 충족(미리보기) | [+] 클릭 → 액션의 `message`를 그 줄 안 `--accent` 상자로(`SCR-09-cart-*.png`). 담은 뒤 재고가 줄어든 줄도 서버 렌더 때 같은 문구 |
| AC-07-5 | 담은 뒤 품절 → "품절", 주문 대상에서 빠짐 | 충족(미리보기) | 품절 배지 + "주문에서 빠져요", 수량 조절 없음. 합계는 `cartTotal()`(품절 줄 제외), 주문서는 `purchasable` 줄만 |
| AC-08-2 | 다음 주문서에 배송지가 미리 채워짐 | 코드 | `getShippingAddress()` → 기본값 + "기본 배송지를 채워 두었어요" |
| AC-08-7 | 빈칸이면 결제창이 열리지 않음 | 충족(미리보기) | 빈 칸으로 [결제하기] → 세 칸 `aria-invalid`, 첫 칸 포커스, 결제창 iframe 0개(`SCR-10-checkout-empty-*.png`). 서버도 같은 스키마로 다시 검사 |
| AC-08-1 | 테스트 결제 → 주문 접수·주문 번호 | 부분 | 값을 채우면 토스 샌드박스 결제창이 서버 금액(36,500원)으로 열림(`SCR-10-checkout-toss-1280.png`, 가짜 주문 값). 실제 결제·확정·완료 화면은 회원 세션이 없어 못 봄 |
| AC-08-4 | 결제창 닫음 → 결제 대기, [다시 결제하기] | 부분 | 결제창의 닫기(X)를 누르면 `/api/payments/toss/fail?orderId=…&code=USER_CANCEL` → `/checkout/result?status=fail&code=PG_FAILED`로 이동 확인. 결과 화면 자체는 세션이 없어 로그인으로 갔다 |
| AC-08-5 | 확정 직전 재고 부족 → 품절 안내 | 코드 | `code=OUT_OF_STOCK`이면 품절 문구, [다시 결제하기] 대신 [장바구니로 가기] |
| AC-08-8 | 금액 불일치 → "결제 금액이 맞지 않아 결제를 취소했어요" | 코드 | `code=AMOUNT_MISMATCH` 문구(REJ-56 그대로) |
| AC-05-6 | 비회원 `/cart`·`/checkout`·`/checkout/result`·`/mypage/address` → 로그인 후 원래 주소 | 충족 | 네 주소 모두 307 `/login?next=<원래 주소+쿼리>` |
| UX-15 | 오류는 칸 아래, `aria-invalid`, `aria-describedby` | 충족(미리보기) | 배송지 연락처 `12` → `address-phone-error` 연결, 포커스(`SCR-07-address-error-*.png`) |
| UX-14 | 빈 장바구니 "장바구니가 비어 있어요" + 다음 행동 | 코드 | [테마 서가로 가기] |

"충족(미리보기)": 커밋하지 않는 임시 경로에서 같은 컴포넌트를 가짜 데이터·가짜 액션으로 그려 확인했다(TKT-FE-M2-01과 같은 방법). 세션이 필요한 실제 조회는 코드로만 확인했다.

## 선택과 이유
- 결제창을 닫으면 토스 SDK는 failUrl로 가지 않고 Promise를 실패시킨다. 그대로 두면 결제가 `ready`로 남고 회원은 그 화면에 머문다. 그래서 실패 Route Handler(API-10)로 보내 결제를 `failed`로 기록하고 결과 화면의 [다시 결제하기]로 잇는다. 외부 결제 흐름이라 `window.location.assign`을 쓴다(CONV-04 예외).
- 토스 SDK는 결제할 때만 동적 import한다. 다른 화면 번들을 키우지 않으려는 것이다.
- 배송지 검사는 BE `shippingInputSchema`를 그대로 쓴다(문구 중복 없음). `ShippingFields`는 SCR-07·10이 같이 쓰고, 편지 띄우기(SCR-14)도 쓸 수 있다.
- 결과 화면은 쿼리 `id`를 그대로 믿지 않는다: uuid가 아니면 대상 없음, 주문 번호는 `getMyOrder`(본인 주문만)로 읽는다.
- 외곽선 버튼: `components/ui/button`의 `outline`은 `bg-background`·`border-border`이고 그 파일의 `cn` 패키지는 겹치는 클래스를 정리하지 않아 덮어쓸 수 없다. `ghost` + `components/button-styles.ts`(`border-input`)로 시안의 외곽선 버튼을 만든다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 실제 결제 한 바퀴(결제 → 확정 → 완료 화면 → 재고·장바구니 반영)를 못 봄 | 결제창 열림·닫기 경로까지 확인 | 카카오 로그인 설정 뒤 QA-M3 |
| 주문서를 열 때마다가 아니라 [결제하기]마다 `create_order`가 새 주문을 만든다(BE 설계) | 결제 대기 주문은 주문 현황에서 [다시 결제하기]·[주문 거두기] | 결제창을 여러 번 닫으면 결제 대기 주문이 쌓인다 — QA·BE가 볼 것 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY`가 비면 결제창을 열 수 없음 | [결제하기] 아래에 필요한 값 안내 | — |
| 결과 화면을 세션 없이 그리지 못해 스크린샷 없음 | 분기는 코드로 확인 | QA-M3 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류·경고 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄, `'use client'` 파일의 `@/lib` import는 `lib/supabase/client`만
- UX-1 새 파일 0건 / UX-5·19 0건
- 스크린샷: `SCR-07-address-error-*`, `SCR-09-cart-*`, `SCR-10-checkout-empty-*`, `SCR-10-checkout-toss-1280` (모두 미리보기, dev 서버라 왼쪽 아래에 Next 표시가 보인다)
- audit: 새 의존성 없음(토스 SDK는 TKT-FE-00에서 추가) — 해당 없음

## 명세와 다르게 한 것
- 결과 화면 미완료 문구: 재고 부족 "결제하는 사이 품절된 책이 있어 주문을 확정하지 못했어요. 결제는 취소했어요.", 회차 "편지는 그대로 있어요. 준비되면 다시 결제해 주세요.", 보상 취소 실패(`contact=1`) "결제 취소를 마치지 못했어요. 번거로우시겠지만 책방으로 문의해 주세요." — 명세에 없는 문구다.
- 편지 회차 결제 성공은 "편지를 띄웠어요" + 창가 문구 + [창가로 가기]만 둔다. 우체통 전환(D-041)은 TKT-FE-M4-01이 이 자리에 넣는다.
- 장바구니에서 주문할 책이 없을 때(모두 품절) 안내 "주문할 수 있는 책이 없어요. 품절된 책은 주문에서 빠져요." — BE `startOrderPayment`의 `OUT_OF_STOCK` 문구와 같다.
- 로딩 문구("장바구니를 살피는 중이에요." 등)는 명세에 없다.

## 기록 필요
- 외곽선 버튼을 `ghost` + `border-input`으로 만든 방식(위 "선택과 이유"). `components/ui/button`의 `outline` 변형을 토큰에 맞게 고칠지는 공통 파일 PR로 따로 정한다.

## 변경 범위
- 추가: `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/checkout/result/page.tsx`, `app/mypage/address/page.tsx`, `components/CartLineControls.tsx`, `CheckoutForm.tsx`, `RetryPaymentButton.tsx`, `ShippingFields.tsx`, `ShippingAddressForm.tsx`, `toss-payment.ts`, `button-styles.ts`, 이 브리핑, 스크린샷
- 다른 담당 영역 수정 없음(액션·스키마는 import만)
- 새 의존성 없음

## 확인하지 못한 것
- 실제 테스트 결제 확정·완료 화면·재고 감소·장바구니 비우기(AC-08-1), 중복 확정(AC-08-6, BE 테스트 범위)
- 결과 화면 세 갈래의 실제 렌더링
- 모바일 기기에서 토스 결제창(리다이렉트 방식) 동작
