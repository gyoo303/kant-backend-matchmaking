# 04. 인터페이스·API & 실행 흐름 (AR-API)

- 입력: AR-DB, ADR-002·003·004·006·008, PM-AC, PM-SCR
- BE는 §2·§3·§5, FE는 §1·§2·§4를 읽는다. 함수·파일 이름은 그대로 쓴다.

## 1. TS 타입
### 1.1 `types/product.ts` (KANT-R3·C5, 고정 경로)
```ts
export const THEMES = ['nature', 'food', 'ecology', 'local'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_LABELS: Record<Theme, string> = { nature: '자연', food: '식문화', ecology: '생태', local: '로컬' };

export interface Product {
  id: string;            // KANT 필수
  name: string;          // KANT 필수
  price: number;         // KANT 필수, 원 단위 정수
  imageUrl: string;      // KANT 필수
  description: string;   // KANT 필수
  theme: Theme;
  author: string;
  keeperNote: string;
  publisherDescription: string | null;
  stock: number;
  createdAt: string;     // ISO, "새로 들어온 책" 정렬
}
```
### 1.2 도메인 타입 (`domains/<d>/types/<n>.types.ts`, ADR-009)
| 파일 | 타입 |
|---|---|
| `domains/orders/types/order.types.ts` | `OrderStatus`, `OrderSummary { id, orderNumber, status, totalAmount, createdAt, cancelRejected: boolean, items: { productId, productName, unitPrice, quantity }[] }`, `ShippingSnapshot { recipientName, phone, address }` |
| `domains/cart/types/cart.types.ts` | `CartLine { product: Product; quantity: number; purchasable: boolean }` |
| `domains/subscriptions/types/round.types.ts` | `RoundStatus`, `WindowView` (§4.3), `UnboxedRound { roundId, product: Pick<Product,'id'|'name'|'imageUrl'|'author'>, replyLetter, postcardUrl: string | null, unboxedAt, memo: { body, updatedAt } | null }`, `KeeperRound`(서재 작업용, 편지 전문·내용·코드 포함) |
| `domains/payments/types/payment.types.ts` | `PaymentTarget = { kind: 'order'; orderId: string } | { kind: 'round'; roundId: string }`, `PaymentRequest { pgOrderId, amount, orderName, customerKey }` |
- DB 행 타입은 `types/database.ts`의 `Tables<'…'>`만 쓴다. 화면 타입으로의 변환은 `lib/data/*`에서만 한다.

## 2. 에러 모델
```ts
// lib/http/result.ts
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
  | 'OUT_OF_STOCK' | 'AMOUNT_MISMATCH' | 'INVALID_STATE' | 'ALREADY_PROCESSING'
  | 'ROUND_IN_PROGRESS' | 'CANCEL_REQUESTED' | 'MISSING_SHIPMENT_FIELDS'
  | 'WRONG_CODE' | 'WITHDRAW_BLOCKED' | 'PG_FAILED' | 'CONFIG_MISSING' | 'UNKNOWN';
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string> } };
```
- `message`는 화면에 그대로 보여 줄 한국어 문장(PM-AC 문구). 로그용 상세(DB 오류, PG 응답)는 `console.error('[<API-ID>]', detail)`로 서버에만 남기고 응답에 넣지 않는다.
- RPC 예외는 `raise exception using errcode = 'P0001', message = '<ErrorCode>'`로 던지고, `lib/data`가 `ErrorCode`로 바꾼다.
- Route Handler는 리다이렉트로 결과를 전달한다(`/checkout/result?status=fail&code=<ErrorCode>`). JSON API는 만들지 않는다.

## 3. API spec (Server Action = `app/**/actions.ts`, Route Handler = `app/api/**/route.ts`)
권한: `P` 공개, `M` 로그인 회원, `K` 책방지기. 멱등: `✓` 2회 호출해도 결과 1회.
| ID | 이름(파일) | 주체 | 권한 | 입력 | 출력 | 에러 | 멱등 | US/AC |
|---|---|---|---|---|---|---|---|---|
| API-01 | `getProducts(theme?)` (`lib/data/products.ts`) | 서버 컴포넌트 | P | `Theme | undefined` | `Product[]` 최신순 | `UNKNOWN`(→ AC-01-4 문구) | ✓ | AC-02-1~5 |
| API-02 | `getProduct(id)` | 서버 컴포넌트 | P | `string`(uuid 아니면 null) | `Product | null` | — | ✓ | AC-03-1·4 |
| API-03 | `getNewArrivals()` | 서버 컴포넌트 | P | — | `Product[]` 재고>0 최신 4권 | — | ✓ | AC-01-1, D-035 |
| API-04 | `saveProduct` (`app/admin/products/actions.ts`) | 폼 | K | `ProductInput`(zod) + 표지 파일 | `{ id }` | `VALIDATION`, `FORBIDDEN` | — | AC-06-1~5 |
| API-05 | `addToCart` / `updateCartQuantity` / `removeCartItem` (`app/cart/actions.ts`) | 폼 | M | `{ productId, quantity }` | `{ quantity, adjusted?: true }` | `OUT_OF_STOCK`, `UNAUTHENTICATED` | ✓ | AC-07-1~5 |
| API-06 | `saveShippingAddress` (`app/mypage/address/actions.ts`) | 폼 | M | `ShippingInput` | — | `VALIDATION` | ✓ | AC-08-2 |
| API-07 | `startOrderPayment` (`app/checkout/actions.ts`) | 폼 | M | `ShippingInput` | `PaymentRequest` | `VALIDATION`, `OUT_OF_STOCK` | — | AC-08-1·7 |
| API-08 | `retryPayment` (`app/checkout/actions.ts`) | 버튼 | M | `PaymentTarget` | `PaymentRequest` | `INVALID_STATE` | — | AC-08-4, AC-11-8 |
| API-09 | `GET /api/payments/toss/success` | PG 리다이렉트 | 세션 불필요(서버 검증) | `paymentKey, orderId, amount` | 302 → `/checkout/result?status=ok&target=…` | `AMOUNT_MISMATCH`, `OUT_OF_STOCK`, `PG_FAILED` | ✓ | AC-08-1·5·6·8, AC-11-3·10 |
| API-10 | `GET /api/payments/toss/fail` | PG 리다이렉트 | — | `code, message, orderId` | 302 → result `status=fail` | — | ✓ | AC-08-4, AC-11-6 |
| API-11 | `requestCancel` / `withdrawCancel` (`app/mypage/actions.ts`) | 버튼 | M | `{ kind, id }` | 새 상태 | `INVALID_STATE` | ✓ | AC-09-2·5·7, AC-20-* |
| API-12 | `cancelPending` | 버튼 | M | `{ kind, id }` | — | `INVALID_STATE` | ✓ | D-037, AC-11-8 |
| API-13 | `shipOrder` / `refund` / `rejectCancel` (`app/admin/orders/actions.ts`) | 버튼 | K | `{ kind, id }` | 새 상태 | `CANCEL_REQUESTED`, `ALREADY_PROCESSING`, `PG_FAILED` | ✓ | AC-10-*, AC-20-* |
| API-14 | `GET /api/admin/shipping-list` | 링크 | K | — | `text/csv; charset=utf-8` 첨부 또는 302 `?empty=1` | `FORBIDDEN` | ✓ | AC-19-* |
| API-15 | `postLetter` (`app/letters/new/actions.ts`) | 폼 | M | `{ body, shipping }` | `PaymentRequest` | `ROUND_IN_PROGRESS`, `VALIDATION` | — | AC-11-1~5·8 |
| API-16 | `getWindow()` (`lib/data/rounds.ts`) | 서버 컴포넌트 | M | — | `WindowView` | — | ✓ | AC-12-* |
| API-17 | `openRound` (`app/admin/desk/actions.ts`) | 화면 진입 시 서버 호출 | K | `roundId` | — | — | ✓ | AC-13-2·3 |
| API-18 | `saveRoundContents` | 폼 | K | `{ roundId, productId, replyLetter, postcard?: File }` | — | `OUT_OF_STOCK`, `VALIDATION` | ✓ | AC-14-* |
| API-19 | `shipRound` | 버튼 | K | `{ roundId, teaser }` | `{ code }` | `MISSING_SHIPMENT_FIELDS`, `OUT_OF_STOCK`, `CANCEL_REQUESTED` | ✓ | AC-15-* |
| API-20 | `unbox` (`app/mypage/rounds/[id]/actions.ts`) | 폼 | M | `{ roundId, code }`(`/^\d{6}$/`) | `UnboxedRound` | `WRONG_CODE` | ✓ | AC-16-* |
| API-21 | `saveMemo` / `deleteMemo` (`app/mypage/shelf/actions.ts`) | 폼 | M | `{ roundId, body ≤100 }` | — | `VALIDATION`, `FORBIDDEN` | ✓ | AC-17-* |
| API-22 | `endSubscription` (`app/mypage/farewell/actions.ts`) | 버튼 | M | `{ note ≤1000 }` | — | `INVALID_STATE` | ✓ | AC-18-* |
| API-23 | `withdraw` (`app/mypage/actions.ts`) | 버튼 | M | — | redirect `/` | `WITHDRAW_BLOCKED` | ✓ | AC-05-4·7·8·9 |
| API-24 | `GET /auth/callback` | OAuth | — | `code`, `next` | 302 `next`(내부 경로만) | 실패 → `/login?error=1` | ✓ | AC-05-2·5·6 |
| API-25 | `getCurrentMember()` (`lib/auth/guards.ts`) | 서버 | — | — | `{ id, nickname, role } | null` | — | ✓ | 전체 |
| API-26 | `requireMember(next)` / `requireKeeper()` (`lib/auth/guards.ts`) | 서버 | — | — | 회원 / `redirect('/login?next=')`·`notFound()` | — | ✓ | AC-05-6, AC-06-5 |

- 모든 Server Action 첫 줄: `requireMember`/`requireKeeper` → zod `safeParse` → `lib/data` 호출. 성공 후 `revalidatePath`/`updateTag`.
- 관리자 화면 비권한 접근은 `notFound()`(관리자 화면 존재를 드러내지 않음, NFR-06).

## 4. 페이지 데이터 계약
| 경로 | 파일 | 데이터 | 비고 |
|---|---|---|---|
| `/` | `app/page.tsx` | `getNewArrivals()` | 실패 시 영역 안 문구(AC-01-4) |
| `/products` | `app/products/page.tsx` | `searchParams: Promise<{ theme?: string | string[] }>` → `parseTheme()`(잘못되면 `undefined`) → `getProducts(theme)` → `products.map(p => <ProductCard key={p.id} product={p} />)` | KANT-R5·C11, AC-02-5 |
| `/products/[id]` | `app/products/[id]/page.tsx` | `params: Promise<{ id: string }>` → `await params` → `getProduct(id)` → null이면 `notFound()` | KANT-R6·C12 |
| 없는 ID | `app/products/[id]/not-found.tsx` | "상품을 찾을 수 없습니다" + `<Link href="/products">` | KANT-C14 |
| `/mypage/window` | `app/mypage/window/page.tsx` | `<Suspense>` 안 `getWindow()` | ADR-006 |
| `/mypage/rounds/[id]` | 동일 패턴 | 언박싱 전: `{ status, teaser }`만 / 후: `UnboxedRound` | NFR-08 |

### 4.1 `ProductCard` Props (KANT-C8)
```ts
interface ProductCardProps { product: Product; href?: string; }  // href 기본값 `/products/${product.id}`
```
### 4.2 `WindowView`
```ts
type WindowView =
  | { kind: 'empty' }                                    // "지금 진행 중인 편지가 없어요"
  | { kind: 'pending_payment'; roundId: string }
  | { kind: 'arrived' | 'reading'; roundId: string; cancelRequested: boolean; cancelRejected: boolean }
  | { kind: 'shipped'; roundId: string; teaser: string };
```
상태 문구는 `domains/subscriptions/window-copy.ts` 상수 1곳(D-043, 대체 텍스트와 공용).

## 5. 실행 흐름 (TRD Layer 3)
### SEQ-01 로그인
1. `/login` → `supabase.auth.signInWithOAuth({ provider: 'kakao' | 'custom:naver', options: { redirectTo: SITE_URL + '/auth/callback?next=' + next } })`
2. 제공자 동의 → Supabase → `/auth/callback?code&next` → `exchangeCodeForSession(code)` → `next`가 `/`로 시작하는 내부 경로일 때만 이동(오픈 리다이렉트 방지)
3. 첫 로그인: `handle_new_user` 트리거가 `profiles`(role `member`) 생성. 실패·취소 → `/login?error=1` "로그인을 마치지 못했어요"
4. `proxy.ts`: 모든 요청에서 `updateSession`. `/mypage`, `/cart`, `/checkout`, `/letters`, `/admin` 비로그인 → `/login?next=` (낙관적). 최종 판단은 각 페이지·액션의 가드.

### SEQ-02 주문
`/checkout` [결제하기] → API-07: `create_order` → `create_payment` → `PaymentRequest` → 브라우저 토스 결제창 → SEQ-03. 발송: API-13 `ship_order`(`paid`만, `cancel_requested`면 `CANCEL_REQUESTED`).

### SEQ-03 결제 확정 (주문·회차 공용, ADR-004)
| 단계 | 주체 | 동작 | 실패 분기 |
|---|---|---|---|
| 1 | Server Action | `create_payment`: 서버 금액 계산, `payments(ready)` | 상태 불가 → `INVALID_STATE` |
| 2 | 브라우저 | 토스 `requestPayment({ orderId: pgOrderId, amount, successUrl, failUrl })` | 창 닫기/실패 → API-10 → `fail_payment`, 주문·회차 `pending_payment` 유지 |
| 3 | API-09 | `payments` 조회(`pg_order_id`), `amount` 쿼리값 ≠ 저장 금액 → 승인 호출 없이 `fail_payment('AMOUNT_MISMATCH')` | NFR-19 |
| 4 | `lib/payments/toss.ts` | `confirm({ paymentKey, orderId, amount }, idempotencyKey = 'confirm-' + pgOrderId)` | PG 실패 → `fail_payment`, `PG_FAILED` |
| 5 | `lib/data` → RPC | `confirm_payment(pgOrderId, paymentKey, approvedAmount)` | `OUT_OF_STOCK`/`AMOUNT_MISMATCH` → 6 |
| 6 | 보상 | `toss.cancel(paymentKey, '재고 부족', idempotencyKey = 'compensate-' + pgOrderId)` → `fail_payment` | 보상 실패 → `console.error('[API-09] COMPENSATION_FAILED')` + 결과 화면 "책방으로 문의" (RISK-03 잔여) |
| 7 | 응답 | 이미 `paid`(새로고침·중복) → RPC `{already:true}`, 같은 성공 화면 | — |

### SEQ-04 편지 띄우기
API-15: `create_round`(편지 + 회차 `pending_payment`, 배송지 사본) → `create_payment(round)` → 결제창(봉투 닫힘 전환은 클라이언트) → SEQ-03 → 성공 시 결과 화면에서 우체통 전환(D-041) → `/mypage/window`. `confirm_payment`가 활성 구독이 없으면 `subscriptions` 생성 후 연결(D-003·D-024).

### SEQ-05 편지 열람
`/admin/desk?round=<id>` 진입 시 서버에서 API-17 `open_round` → `update … set status='reading', opened_at=now() where id=$1 and status='arrived'`(영향 0이어도 성공). 회원 창가는 다음 진입 때 반영(ADR-006).

### SEQ-06 발송·코드 발급
1. API-19: `teaser` 검증 → 코드 생성 `generateUnboxingCode(randomInt)` (`domains/subscriptions/unboxing-code.ts`, 인자로 받은 `randomInt`; 실제 주입은 `lib/crypto.ts`의 `node:crypto.randomInt`)
2. RPC `ship_round(roundId, code)`: `select … for update` → 이미 `shipped`면 기존 코드 반환 / 취소 요청이면 `CANCEL_REQUESTED` / 책·답장·힌트 누락 `MISSING_SHIPMENT_FIELDS` / `update products set stock = stock-1 where id=… and stock>=1` 영향 0 → `OUT_OF_STOCK` / `insert unboxing_codes` unique 위반 → `CODE_COLLISION`(액션이 새 코드로 최대 3회 재시도) / 회차 `shipped`
3. 화면에 코드 크게 표시(AC-15-1), 다시 열면 같은 코드(AC-15-2)

### SEQ-07 언박싱
API-20 → RPC `unbox_round(roundId, code)`: `auth.uid()` 소유 + `status='shipped'` + 코드 일치 → `unboxed`·`used_at`, true. 그 밖에는 모두 false → `WRONG_CODE` "코드가 맞지 않아요…"(AC-16-3·4 같은 문구). 횟수 제한 없음(NFR-18). 성공 후 `round_contents` 조회 + 엽서 서명 URL(600초).

### SEQ-08 취소 요청·거절·환불 (주문·회차 공용)
`request_cancel` → (회원 `withdraw_cancel` | 책방지기 `reject_cancel` | 환불). 환불: `begin_refund`(결제 `paid→refunding`, 영향 0 → `ALREADY_PROCESSING`) → `toss.cancel(paymentKey, '고객 취소 요청', idempotencyKey='refund-'+paymentId)` → 성공 `complete_refund`(주문 `refunded`+재고 복구 / 회차 `cancelled`) / 실패 `fail_refund`(`paid` 복귀) + "환불하지 못했어요".

### SEQ-09 구독 마무리
API-22 → `end_subscription(note)`: 구독 `active→ended`, 결제 대기 회차 `cancelled`, 안부 저장. `arrived`·`reading`·`shipped` 회차는 그대로(INV-14). 확인 팝업 없음(INV-13).

### SEQ-10 탈퇴 — AR-DB §7. SEQ-11 주소록 — ADR-007, `list_shipping_targets()` → `toShippingCsv(rows)`(BOM + CRLF, 열: 구분·번호·받는 사람·연락처·주소·책) → `shipping_list_downloads` insert.

## 6. 상태 머신 (표에 없는 전이는 RPC가 `INVALID_STATE`)
### 6.1 Order
| 현재 | 이벤트 | 다음 | 주체 | 부수 효과 |
|---|---|---|---|---|
| pending_payment | confirm_payment | paid | 시스템 | 재고 차감, 장바구니 해당 줄 삭제, 기본 배송지 upsert, `paid_at` |
| pending_payment | cancel_pending / 탈퇴 | cancelled | 회원 / 시스템 | — |
| paid | request_cancel | cancel_requested | 회원 | `cancel_rejected_at = null` |
| cancel_requested | withdraw_cancel | paid | 회원 | — |
| cancel_requested | reject_cancel | paid | 책방지기 | `cancel_rejected_at = now()` |
| cancel_requested | complete_refund | refunded | 시스템(환불 성공) | 재고 복구 |
| paid | ship_order | shipped | 책방지기 | `shipped_at` |

### 6.2 SubscriptionRound (단방향, INV-09)
| 현재 | 이벤트 | 다음 | 주체 | 부수 효과 |
|---|---|---|---|---|
| pending_payment | confirm_payment | arrived | 시스템 | 구독 연결/생성, `paid_at` |
| pending_payment | cancel_pending / end_subscription / 탈퇴 | cancelled | 회원 / 시스템 | — |
| arrived | open_round | reading | 책방지기 | `opened_at` |
| arrived, reading | ship_round (취소 요청 없음) | shipped | 책방지기 | 재고−1, 코드 발급 |
| arrived, reading (취소 요청) | complete_refund | cancelled | 시스템 | 진행 중 자리 비움 |
| shipped | unbox_round | unboxed | 회원 | `used_at` |
- 취소 요청 표시: `arrived`·`reading`에서 `cancel_requested_at` 설정(request) / 해제(withdraw, reject + `cancel_rejected_at`). 상태는 바뀌지 않는다.

### 6.3 Subscription: `active → ended`(end_subscription). Payment: `ready → paid | failed`, `paid → refunding → refunded | paid`.

## 7. 외부 I/O 격리 규칙
- `domains/**`는 `Date`·`Math.random`·`crypto`·`fetch`·Supabase를 호출하지 않는다. 시간은 `now: Date`, 난수는 `randomInt: (min, max) => number` 인자로 받는다.
- 앱 쪽 난수 생성 위치는 `lib/crypto.ts` 하나(`node:crypto.randomInt`, 언박싱 코드용). `pg_order_id`(`'ub' || replace(gen_random_uuid()::text,'-','')`)와 주문 번호는 RPC 안에서 DB가 만든다.
- PG HTTP는 `lib/payments/toss.ts`, Supabase는 `lib/supabase/*`·`lib/data/*`에서만.
