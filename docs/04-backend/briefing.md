---
stage: BE
tickets: [TKT-BE-M2-01, TKT-BE-M2-02, TKT-BE-M2-03, TKT-BE-M3-01, TKT-BE-M3-02, TKT-BE-M3-03, TKT-BE-M4-01, TKT-BE-M4-02, TKT-BE-M4-03, TKT-BE-M4-04]
status: partial
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, AR-ADR, DB-BRIEF, DB-TYPES, PM-AC, PM-US, PM-DOMAIN, PM-SCR]
next_readers: [FE, QA]
---
# 백엔드 에이전트 브리핑

> `status: partial` 이유: 10개 티켓 코드와 GATE-01~06은 모두 통과했다(2026-10-22, `0050` 원격 적용·타입 재생성 후). 남은 것은 TKT-BE-M2-02 네이버 스파이크 하나로, 키 발급·대시보드 설정이 필요해 사람이 해야 한다. 끝나면 `done`으로 바꾼다.

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-BE-M2-01 | AC-05-2·5·6 | 코드 완료. `safeNextPath` 테스트 통과. 실제 카카오 로그인(AC-05-2·5·6)은 아래 "카카오 로그인 확인 절차"대로 사람이 확인 |
| TKT-BE-M2-02 | AC-05-1·2(네이버) | **미완료(사람 작업 필요)**. 네이버 키 미발급. 아래 "네이버 스파이크 절차"대로 확인 후 결과를 이 표에 적는다. ADR-003 A(`custom:naver`)는 BE 코드가 필요 없다(콜백 공용) |
| TKT-BE-M2-03 | AC-06-1·2·4 | 코드·테스트 완료(AC-06-1·2·4 스키마 테스트 통과). 저장 후 목록 반영은 FE·QA 확인 |
| TKT-BE-M3-01 | AC-07-1~5, AC-08-2·3 | 코드·테스트 완료(AC-07-2·3·4·5, AC-08-2·7 도메인 테스트 통과) |
| TKT-BE-M3-02 | AC-08-1·4~8, NFR-07·19 | 코드·테스트 완료, GATE-01·04 통과(0050 적용 후). 실결제는 토스 테스트 키 입력 후 QA |
| TKT-BE-M3-03 | AC-09-*, AC-10-* | 코드·테스트 완료(AC-09-7 문구 테스트). 전이 자체는 DB pgTAP(AC-09·10)로 검증됨 |
| TKT-BE-M4-01 | AC-11-1~10, AC-12-* | 코드·테스트 완료(AC-11-5, AC-12-1~7 창가 매핑 테스트) |
| TKT-BE-M4-02 | AC-13-*, AC-14-*, AC-15-* | 코드·테스트 완료(코드 생성 INV-08, AC-14-3, AC-15-3) |
| TKT-BE-M4-03 | AC-16-*, AC-17-*, AC-18-*, AC-20-*, AC-05-4·7~9 | 코드·테스트 완료(AC-16-5, AC-17-4, AC-18-5 한도 테스트) |
| TKT-BE-M4-04 | AC-19-* | 코드·테스트 완료(AC-19-1 BOM·CRLF·열 순서, AC-19-2) |

## 만든 것
### 엔드포인트
| API-ID | 이름 (파일) | 권한 | 성공 | 실패(ErrorCode / 상태 코드) |
|---|---|---|---|---|
| API-04 | `saveProduct(formData)` (`app/admin/products/actions.ts`) | K | `{ id }` | `VALIDATION`(fieldErrors), `FORBIDDEN`, `UNAUTHENTICATED`, `NOT_FOUND` |
| API-05 | `addToCart` / `updateCartQuantity` / `removeCartItem` (`app/cart/actions.ts`) | M | `{ quantity, adjusted?, message? }` / `null` | `OUT_OF_STOCK`, `NOT_FOUND`, `VALIDATION`, 비로그인 → `/login?next=` |
| API-06 | `saveShippingAddress` (`app/mypage/address/actions.ts`) | M | `null` | `VALIDATION` |
| API-07 | `startOrderPayment(shipping)` (`app/checkout/actions.ts`) | M | `PaymentRequest` | `VALIDATION`, `OUT_OF_STOCK` |
| API-08 | `retryPayment(target)` (`app/checkout/actions.ts`) | M | `PaymentRequest` | `INVALID_STATE`, `NOT_FOUND` |
| API-09 | `GET /api/payments/toss/success` | 세션 불필요 | 303 → `/checkout/result?status=ok&target=<order|round>&id=<uuid>` | 303 → `?status=fail&code=<AMOUNT_MISMATCH|OUT_OF_STOCK|PG_FAILED|INVALID_STATE|NOT_FOUND>[&contact=1]` |
| API-10 | `GET /api/payments/toss/fail` | — | 303 → `?status=fail&code=PG_FAILED&target=…&id=…` | — |
| API-11 | `requestCancel` / `withdrawCancel` (`app/mypage/actions.ts`) | M | 주문: 새 `OrderStatus` / 회차: `null` | `INVALID_STATE`(현재 상태 문구), `NOT_FOUND` |
| API-12 | `cancelPending` (`app/mypage/actions.ts`) | M | 같음 | 같음 |
| API-13 | `shipOrder` / `refund` / `rejectCancel` (`app/admin/orders/actions.ts`) | K | `OrderStatus` / `null` / `OrderStatus | null` | `CANCEL_REQUESTED`, `ALREADY_PROCESSING`, `PG_FAILED`("환불하지 못했어요…"), `INVALID_STATE` |
| API-14 | `GET /api/admin/shipping-list` | K | 200 `text/csv; charset=utf-8` 첨부 / 302 `/admin/orders?empty=1` | 401 비로그인, 403 비관리자, 500 |
| API-15 | `postLetter({ body, shipping })` (`app/letters/new/actions.ts`) | M | `PaymentRequest`(30,000원) | `ROUND_IN_PROGRESS`, `VALIDATION` |
| API-16 | `getWindow()` (`lib/data/rounds.ts`) | M | `WindowView` | 던짐(페이지 오류 처리) |
| API-17 | `openRound(roundId)` (`app/admin/desk/actions.ts`) | K | `null` | `FORBIDDEN`, `NOT_FOUND` |
| API-18 | `saveRoundContents(formData)` (`app/admin/desk/actions.ts`) | K | `null` | `OUT_OF_STOCK`("다른 책을 골라 주세요"), `VALIDATION`, `INVALID_STATE` |
| API-19 | `shipRound({ roundId, teaser })` (`app/admin/desk/actions.ts`) | K | `{ code }` | `MISSING_SHIPMENT_FIELDS`, `OUT_OF_STOCK`, `CANCEL_REQUESTED`, `INVALID_STATE` |
| API-20 | `unbox({ roundId, code })` (`app/mypage/rounds/[id]/actions.ts`) | M | `UnboxedRound` | `WRONG_CODE`(틀림·남의 회차·형식 오류 모두 같은 문구) |
| API-21 | `saveMemo` / `deleteMemo` (`app/mypage/shelf/actions.ts`) | M | `null` | `VALIDATION`, `FORBIDDEN` |
| API-22 | `endSubscription({ note? })` (`app/mypage/farewell/actions.ts`) | M | `null` | `INVALID_STATE`, `VALIDATION` |
| API-23 | `withdraw()` (`app/mypage/actions.ts`) | M | redirect `/` | `WITHDRAW_BLOCKED` |
| API-24 | `GET /auth/callback` | — | 302 `next`(내부 경로만) | 302 `/login?error=1` |
| API-25·26 | `getCurrentMember` / `requireMember(next)` / `requireKeeper()` / `authorizeKeeper()` (`lib/auth/guards.ts`) | — | 회원 / null | 화면: redirect·notFound, 액션: `ActionResult` |

### 파일
- 공통: `lib/http/result.ts`(ErrorCode·ActionResult·`AppError`·`runAction`·문구), `lib/auth/guards.ts`, `proxy.ts` + `lib/supabase/proxy.ts`(updateSession), `app/auth/callback/route.ts`, `lib/crypto.ts`, `lib/payments/toss.ts`
- `lib/data/*`(BE 담당): `rpc-error.ts`(P0001 → ErrorCode), `session.ts`, `product-admin.ts`, `cart.ts`, `orders.ts`, `payments.ts`, `rounds.ts`, `members.ts`, `admin.ts`
- `domains/`: `products/product.schema.ts`, `cart/cart.ts`·`types/cart.types.ts`, `shipping/shipping.schema.ts`·`shipping-list.ts`, `orders/order.ts`·`types/order.types.ts`, `payments/payment.ts`·`types/payment.types.ts`, `subscriptions/subscription.schema.ts`·`unboxing-code.ts`·`window-copy.ts`·`types/round.types.ts` (+ 각 `*.test.ts`)
- `shared/utils/safe-next-path.ts`(+테스트), `shared/utils/uuid.ts`
- 화면 보조(서버 전용, 액션 아님): `app/checkout/payment-request.ts`(결제 준비 공용), `app/mypage/cancel-flow.ts`(취소 흐름 공용)
- `supabase/migrations/0050_create_payment_default_args.sql` (절차 예외, 아래)

## 레이어 계층 확인 포인트
- 진입점(`actions.ts`·`route.ts`) → `domains`(zod·규칙) → `lib/data`(Supabase) 순서. Supabase 호출은 `lib/data/*`와 `lib/auth/guards.ts`(프로필 조회)·`app/auth/callback`(세션 교환)·`lib/supabase/proxy.ts`뿐이다. 콜백·가드는 세션 처리라 `lib/data`를 거치지 않았다.
- 모든 Server Action은 `runAction(apiId, …)` 안에서 첫 줄 가드 → `safeParse` → `lib/data` 호출. `redirect`·`notFound`는 `unstable_rethrow`로 다시 던진다.
- RPC 오류는 `lib/data/rpc-error.ts`의 `toAppError`가 `P0001` 메시지를 `ErrorCode`로 바꾸고 그 밖은 `UNKNOWN`. DB 오류 상세는 `console.error('[API-xx]', …)`로 서버에만 남는다.
- 회원 화면용 조회는 RLS에 더해 `.eq('member_id', 세션 사용자)`로 좁혔다(`lib/data/session.ts`). 책방지기 계정은 RLS상 모든 회원 행을 읽을 수 있어서, 책방지기가 회원 화면을 열 때 남의 데이터가 섞이지 않게 하기 위해서다.

## 애플리케이션 계층 확인 포인트
- 권한: 회원 액션 `requireMember(next)`(비로그인 → `/login?next=`, AC-05-6·03-3), 책방지기 액션 `authorizeKeeper()`(→ `UNAUTHENTICATED`/`FORBIDDEN`), 관리자 화면 `requireKeeper()`(→ `notFound()`, NFR-06). RPC·RLS가 다시 확인한다.
- 클라이언트 값 불신: 담기 수량은 서버에서 재고·담긴 수량을 다시 읽어 보정, 주문 합계·회차 금액은 DB(RPC)만 계산, 결제 금액은 `payments.amount`와 비교(NFR-19). `amount` 쿼리값과 다르면 PG 승인을 부르지 않는다.
- 결제(SEQ-03): `decideConfirm` → `toss.confirm`(멱등키 `confirm-<pgOrderId>`) → `confirm_payment`(service_role). 확정 실패면 `toss.cancel`(멱등키 `compensate-<pgOrderId>`) → `fail_payment`. 보상 취소 실패는 `[API-09] COMPENSATION_FAILED` 로그 + 결과 주소 `contact=1`.
- 환불(SEQ-08): `begin_refund`(잠금, 두 번째 클릭은 `ALREADY_PROCESSING`) → `toss.cancel`(멱등키 `refund-<paymentId>`) → `complete_refund` / 실패 시 `fail_refund` + "환불하지 못했어요. 잠시 후 다시 눌러 주세요".
- 민감 정보: `pg_payment_key`·언박싱 코드는 회원 응답에 넣지 않는다(코드는 책방지기 `KeeperRound`에만). 언박싱 전 `round_contents`는 RLS 0행이고, 엽서 서명 URL(600초)은 언박싱 후 RLS로 읽은 경로에만 admin으로 발급한다(NFR-08).
- service role 사용처: `confirm_payment`·`fail_payment`·`complete_refund`·`fail_refund`, API-09·10의 `payments` 조회(pg_order_id → 대상·금액, 응답에 넣지 않음), 엽서 서명 URL, 탈퇴(엽서 삭제·계정 삭제).
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(결제 확정·탈퇴), `TOSS_SECRET_KEY`(`lib/payments/toss.ts`만), `NEXT_PUBLIC_TOSS_CLIENT_KEY`(FE 결제창). env가 없으면 `CONFIG_MISSING`으로 응답하고 `proxy.ts`는 요청을 그대로 통과시킨다(AC-21-4).

## 프론트엔드 에이전트에게 전달할 것
- 타입 위치: `lib/http/result.ts`(`ActionResult`, `ErrorCode`, `ERROR_MESSAGES`), `domains/*/types/*.types.ts`(`CartLine`, `OrderSummary`, `KeeperOrder`, `PaymentRequest`, `PaymentTarget`, `WindowView`, `UnboxedRound`, `KeeperRound`). 액션 반환의 `error.message`는 화면에 그대로 보여 주고, `fieldErrors`는 칸 옆에 붙인다(키 = 입력 이름, 배송지는 `shipping.recipientName`처럼 점 경로).
- 입력 스키마(화면 검증 공용): `domains/products/product.schema.ts`, `domains/cart/cart.ts`, `domains/shipping/shipping.schema.ts`, `domains/subscriptions/subscription.schema.ts`(한도 상수 `LETTER_MIN/MAX`, `TEASER_MAX`, `MEMO_MAX`, `FAREWELL_MAX` 등 — 버튼 비활성·글자 수 표시용).
- 문구 상수: `domains/subscriptions/window-copy.ts`(`windowCopy`, `windowNotice`, `ROUND_STATUS_LABELS`), `domains/orders/order.ts`(`ORDER_STATUS_LABELS`, `CANCEL_REQUESTED_MESSAGE`, `CANCEL_REJECTED_MESSAGE`), `domains/shipping/shipping-list.ts`(`SHIPPING_LIST_EMPTY_MESSAGE`, `SHIPPING_LIST_NOTICE`), `domains/cart/cart.ts`(`remainingStockMessage`).
- 폼 액션 두 개는 `FormData`를 받는다: `saveProduct`(필드 `id?`, `name`, `author`, `price`, `theme`, `description`, `keeperNote`, `publisherDescription`, `stock`, 파일 `cover` — 새 책은 표지 필수), `saveRoundContents`(필드 `roundId`, `productId`, `replyLetter`, 파일 `postcard?`). `useActionState`로 쓰려면 `(prev, formData) => saveProduct(formData)`로 감싼다. 나머지 액션은 객체를 받는다.
- 화면용 조회 함수(서버 컴포넌트에서, `<Suspense>` 안): `getCurrentMember`, `lib/data/cart.ts`(`getCartLines`, `getCartCount`, `getShippingAddress`), `lib/data/orders.ts`(`getMyOrders`, `getMyOrder`, `getKeeperOrders`), `lib/data/rounds.ts`(`getWindow`, `getLetterPageState`, `getMemberRound`, `getUnboxedRound`, `getShelf`, `getSubscriptionState`, `getDeskRounds`, `getKeeperRound`, `getFarewellNotes`), `lib/data/admin.ts`(`getKeeperCounts`), 합계는 `domains/cart/cart.ts`의 `cartTotal`.
- 결제 흐름에서 프론트가 할 일: 액션이 준 `PaymentRequest`로 토스 결제창 `requestPayment({ orderId: pgOrderId, amount, orderName, customerKey, successUrl: SITE_URL + '/api/payments/toss/success', failUrl: SITE_URL + '/api/payments/toss/fail' })`. 결과는 `/checkout/result`의 `status`·`code`·`target`·`id`·`contact` 쿼리로 그린다(`contact=1`이면 "책방으로 문의" 안내). [다시 결제하기]는 `retryPayment({ kind, orderId|roundId })`.
- 서재 작업: `/admin/desk?round=<id>` 진입 시 서버에서 `openRound(id)` 후 `getKeeperRound(id)`로 그린다(같은 요청 안이라 `reading`이 바로 보인다).
- 로그인: `/login`은 브라우저 클라이언트로 `signInWithOAuth({ provider: 'kakao' | 'custom:naver', options: { redirectTo: SITE_URL + '/auth/callback?next=' + encodeURIComponent(next) } })`. 실패 안내는 `/login?error=1`.
- 회차의 `requestCancel`·`withdrawCancel`·`rejectCancel`은 `null`을 돌려준다. 화면을 다시 읽어 표시를 정한다(액션이 관련 경로를 revalidate한다).

## 설계와 다르게 한 것 / 질문 / DB 에이전트에게 요청
### 절차 예외
| 승인자 | 날짜 | 막힌 ID | 이유 |
|---|---|---|---|
| user(채팅 선택) | 2026-10-22 | DB-TYPES (`create_payment` 인자) | 생성 타입이 `p_order_id`·`p_round_id`를 둘 다 필수 `string`으로 적어, 한쪽을 `null`로 넘기려면 타입 우회(금지 패턴 1)가 필요했다. 사용자가 "DB 마이그레이션 추가"를 골라 BE가 `supabase/migrations/0050_create_payment_default_args.sql`(본문 동일, 두 인자에 `default null`)을 썼다. 사람이 원격 적용(SQL 편집기, `migration list` 0050 local=remote 확인)·타입 재생성을 했다. 재생성 파일이 PowerShell `>` 때문에 UTF-16으로 저장돼 BE가 UTF-8로 인코딩만 바꿨다(실제 변경은 `create_payment` Args가 `p_order_id?`·`p_round_id?`가 된 한 줄). AR-DB §5·§9 표에 0050 한 줄 추가는 ARCH 몫이다. 이후 타입 재생성은 Git Bash에서 하거나 PowerShell이면 `| Out-File -Encoding utf8`을 쓴다 |

### 설계에 없어 정한 것 (FE·QA 참고)
- `authorizeKeeper()`를 `lib/auth/guards.ts`에 추가했다(API-26 목록에 없음). 책방지기 Server Action은 `notFound()` 대신 `FORBIDDEN`/`UNAUTHENTICATED`를 `ActionResult`로 돌려준다(API-04·13 에러 목록에 `FORBIDDEN`이 있어서). 화면 가드는 설계대로 `requireKeeper()`.
- 회원 액션의 비로그인은 `UNAUTHENTICATED` 대신 `requireMember(next)` 리다이렉트로 처리했다(AR-API §3 "첫 줄 requireMember"). 담기는 `next=/products/<id>`라 로그인 후 같은 상세로 돌아온다(AC-03-3).
- API-09 결과 주소는 `target=<order|round>&id=<uuid>`로 나눴다(spec은 `target=…`만 적음). 보상 취소 실패는 `contact=1`을 더한다(SEQ-03 6단계 "책방으로 문의").
- 결제창 상품명(`orderName`)은 "첫 책 외 N권", 회차는 "우분투북스 편지 구독". `customerKey`는 회원 id.
- `lib/crypto.ts`를 TKT-BE-M2-03에서 먼저 만들었다(표지 파일 이름 uuid, `randomUuid`). M4-02의 `randomInt`도 같은 파일.
- `lib/supabase/proxy.ts`는 HANDOFF TKT-BE-M2-01 산출이라 BE가 썼다(AGENTS.md 지도상 `lib/supabase/`는 DB 영역).
- `shared/utils/safe-next-path.ts`·`uuid.ts`를 추가했다(콜백·액션·도메인 공용). `lib/data/products.ts`의 uuid 정규식과 같은 규칙.
- 장바구니 변경 뒤 `refresh()`(Next 16)를 같이 불러 Header 개수(AC-07-1)를 새로 그리게 했다.
- 화면 데이터용 조회 함수(`getLetterPageState`, `getMemberRound`, `getShelf`, `getSubscriptionState`, `getDeskRounds`, `getKeeperRound`, `getFarewellNotes`, `getKeeperOrders`, `getMyOrder(s)`, `getCartLines`, `getCartCount`)는 AR-API에 이름이 없어 HANDOFF "산출"의 `lib/data` 파일 안에 정했다. `KeeperOrder` 타입(주문 요약 + 배송지 사본)을 `order.types.ts`에 더했다.
- 책 저장 시 Storage 업로드 후 DB 저장이 실패하면 고아 표지 파일이 남는다(공개 버킷, 정리 작업 없음).
- 서재 작업 저장(API-18)에서 품절 책은 서버에서 재고를 다시 보고 `OUT_OF_STOCK`으로 막는다(AC-14-2). RLS가 `arrived`·`reading`이 아닌 회차 저장을 막으면 `INVALID_STATE`.
- `list_shipping_targets`의 생성 타입은 `order_number`·`books`를 `string`으로 적지만 실제로는 `null`이 온다(DB 브리핑). `lib/data/admin.ts`에서 `?? null`로 받는다. 타입 재생성 시 DB 쪽에서 nullable로 보이게 할 방법이 있으면 좋겠다(요청, 급하지 않음).

### 남은 위험
- `complete_refund`가 PG 환불 성공 뒤 실패하면 결제가 `refunding`에 남는다(`[API-13] REFUND_DB_FAILED` 로그). 다시 누르면 `ALREADY_PROCESSING`이라 운영자가 SQL로 `complete_refund`를 다시 불러야 한다.
- API-09 보상 취소 실패(RISK-03 잔여): 결제는 `failed`(`failure_code`에 `:COMPENSATION_FAILED`), PG 관리자 화면에서 직접 취소 필요.
- 탈퇴: `withdraw_member` 성공 뒤 엽서·계정 삭제가 실패하면 다시 눌러야 한다(두 번째 RPC는 빈 목록).

### 카카오 로그인 확인 절차 (TKT-BE-M2-01, 사람)
BE 쪽 코드는 콜백(`/auth/callback`)·세션 갱신(`proxy.ts`)·가드뿐이고, 로그인 버튼(`/login`)은 TKT-FE-M2-01이 만든다. 1~3은 지금 할 수 있고, 4~7은 `/login` 화면이 생긴 뒤 한다.
1. 카카오 디벨로퍼스(developers.kakao.com) → 내 애플리케이션 → 앱 생성
   - 앱 키의 **REST API 키**를 Client ID로 쓴다
   - 제품 설정 → 카카오 로그인 → **활성화 ON**, 보안 → **Client Secret 발급·사용 ON**
   - 카카오 로그인 → Redirect URI에 `https://<project-ref>.supabase.co/auth/v1/callback` 등록(우리 앱 주소가 아니라 Supabase 주소 1개)
   - 동의항목: 닉네임(`profile_nickname`)만 켠다. 이메일은 비즈 앱 전용이라 켜지 않는다(ADR-003)
2. Supabase 대시보드 → Authentication → Sign In / Providers → **Kakao**
   - Enable, Client ID = REST API 키, Client Secret = 1의 Secret
   - **Allow users without an email**(이메일 없이 허용) 켜기 — 안 켜면 이메일이 없어 가입이 실패한다
3. Supabase 대시보드 → Authentication → URL Configuration
   - Site URL `http://localhost:3000`, Redirect URLs에 `http://localhost:3000/auth/callback` (배포 후 운영 도메인의 `/auth/callback` 추가)
   - `.env.local`의 `NEXT_PUBLIC_SITE_URL=http://localhost:3000` 확인
4. AC-05-2 처음 로그인: `npm run dev` → 상품 상세 등 아무 화면에서 `/login?next=<그 경로>` → [카카오로 시작하기] → 카카오 동의 → 원래 화면으로 돌아오는지 확인
   - Supabase 대시보드 Table Editor → `profiles`에 새 행(role `member`)이 생기고 `nickname`이 카카오 닉네임인지 확인. `독자`로 들어오면 가입 트리거가 찾는 키(`name`·`full_name`·`nickname`·`user_name`)에 카카오 값이 없다는 뜻이다. Authentication → Users에서 그 사용자의 `raw_user_meta_data` 키 이름을 적어 DB 에이전트에 넘긴다(DB 브리핑 질문)
   - 두 번째 로그인에서 `profiles` 행이 더 생기지 않는지 확인
5. AC-05-5 취소: 카카오 동의 화면에서 [취소] → `/login?error=1`로 돌아와 "로그인을 마치지 못했어요" 안내가 보이는지 확인
6. AC-05-6 보호 경로: 로그아웃 상태로 `/mypage`, `/cart` 주소에 직접 들어가면 `/login?next=%2Fmypage`처럼 이동하고, 로그인 후 그 주소로 돌아오는지 확인
7. 오픈 리다이렉트: `/auth/callback?code=x&next=//evil.com` 같은 주소로 들어와도 외부로 나가지 않는지 확인(코드가 가짜라 `/login?error=1`로 간다)
8. 책방지기 계정: 4에서 만든 계정을 SQL 편집기에서 `update public.profiles set role = 'keeper' where id = '<uuid>';`로 바꾸고, `/admin` 화면이 열리는지(일반 계정은 404인지, AC-06-5) 확인
- 결과는 이 표 TKT-BE-M2-01 행에 "확인함(날짜)"으로 적는다.

### 네이버 스파이크 절차 (TKT-BE-M2-02, 사람)
1. 네이버 개발자센터 앱의 Client ID·Secret 발급, Callback URL `https://<project-ref>.supabase.co/auth/v1/callback` 등록, 시연 계정을 테스트 ID로 등록.
2. Supabase 대시보드 Authentication → Providers → Custom provider `naver`(OAuth2): authorize `https://nid.naver.com/oauth2.0/authorize`, token `https://nid.naver.com/oauth2.0/token`, userinfo `https://openapi.naver.com/v1/nid/me`, 이메일 선택(`email_optional`).
3. FE `/login`의 [네이버로 시작하기]로 로그인 → `profiles`에 행이 생기고 닉네임이 채워지는지 확인(응답이 `response.{id,…}` 한 단계 안쪽이라 sub 매핑이 되는지가 핵심, RISK-11).
4. 실패하면 ADR-003 B(`app/auth/naver/*/route.ts` + `lib/auth/naver.ts`)로 전환한다. 이 경우 BE 작업을 다시 요청해 주세요.

## 검증 결과 (2026-10-22)
- GATE-01 `npx tsc --noEmit`: 통과(오류 0, 0050 적용·타입 재생성 후 재실행)
- GATE-02 `npm run lint`: 통과(오류 0)
- GATE-03 `npm test`: tests 70 / pass 70 / fail 0
- GATE-04 `npm run build`: 통과(Next 16.4.2, Route Handler 4개 `/api/admin/shipping-list`·`/api/payments/toss/fail`·`/api/payments/toss/success`·`/auth/callback` + Proxy)
- GATE-05: `.env` 추적 0줄, `NEXT_PUBLIC_*SECRET|SERVICE_ROLE` 0줄
- GATE-06: 금지 패턴 grep 0줄, `domains/`의 시간·난수·fetch·supabase 0줄(테스트 제외), `'use client'` 파일 없음
- GATE-07: 해당 없음(0050은 본문 변경 없음). 적용 후 기존 pgTAP(`payments.test.sql`, `subscription.test.sql`)을 다시 돌려 회귀가 없는지 확인 권장

### AC-ID별 단위 테스트
| AC/NFR | 테스트 파일 | 결과 |
|---|---|---|
| AC-05-2·6 | `shared/utils/safe-next-path.test.ts` | 통과 |
| AC-06-1·2·4 | `domains/products/product.schema.test.ts` | 통과 |
| AC-07-2·3·4·5, AC-03-5 | `domains/cart/cart.test.ts` | 통과 |
| AC-08-2·7 | `domains/shipping/shipping.schema.test.ts` | 통과 |
| AC-08-1·6·8, AC-11-10, NFR-07 | `domains/payments/payment.test.ts` | 통과 |
| AC-09-1·7 | `domains/orders/order.test.ts` | 통과 |
| AC-11-5·8, AC-12-1~7, AC-20-6 | `domains/subscriptions/window-copy.test.ts`, `subscription.schema.test.ts` | 통과 |
| AC-14-3, AC-15-1·3, AC-16-5, AC-17-4, AC-18-5, INV-08 | `domains/subscriptions/subscription.schema.test.ts`, `unboxing-code.test.ts` | 통과 |
| AC-19-1·2 | `domains/shipping/shipping-list.test.ts` | 통과 |
| 그 밖(로그인·결제·환불·언박싱 실제 흐름) | — | 미검증: 키 입력·0050 적용 후 QA 수동 시연 |
