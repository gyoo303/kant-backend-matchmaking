---
stage: DB
tickets: [TKT-DB-00, TKT-DB-01, TKT-DB-02, TKT-DB-03, TKT-DB-04]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-DB, AR-CONV, AR-GATE, AR-ADR]
next_readers: [BE, QA]
---
# DB 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-DB-00 | `npx supabase db push --linked --dry-run` 정상 종료 | 충족 (2026-10-22, exit 0, "Remote database is up to date.", 적용 대상 마이그레이션 0개) |
| TKT-DB-01 | AC-02-1·3, NFR-16, GATE-07 | 충족 (2026-10-22). 원격 적용 완료(`migration list`: 0001 local=remote), pgTAP 22개 통과, 공개 키 조회 확인(아래 "검증 결과") |
| TKT-DB-02 | GATE-07, AC-08-5·6·8, AC-10-5 | 충족 (2026-10-22). 원격 적용 완료(`migration list`: 0020 local=remote), pgTAP 106개 통과(42·29·35), GATE-01~06 통과 |
| TKT-DB-03 | GATE-07, AC-11-9, AC-16-6, AC-17-5, AC-18-8 | 충족 (2026-10-22). 원격 적용 완료(`migration list`: 0030 local=remote), pgTAP 168개 통과(62·42·29·35), GATE-01~06 통과 |
| TKT-DB-04 | AC-19-1·4, AC-05-4·8 | 충족 (2026-10-22). 원격 적용 완료(`migration list`: 0040 local=remote), pgTAP 78개 통과(36·42), GATE-01~06 통과 |

## 만든 것
### TKT-DB-00
- `supabase/config.toml`: `npx supabase init` 기본값 그대로 (CLI 2.121.0, `project_id = "kant-ubuntu-books-claude1"`, Postgres 17, seed 경로 `./seed.sql`)
- `supabase/.gitignore`: CLI가 만든 파일 그대로 (`.branches`, `.temp`, `.env.keys`, `.env.local`, `.env.*.local`)
- `.env.example`은 TKT-FE-00에서 ADR-005 표대로 만들어졌다. 변수 8개가 표와 같은지 확인만 했다

### TKT-DB-01
- `supabase/migrations/0001_profiles_products.sql`
  - enum 6개 전체(AR-DB §2), `set_updated_at()`
  - `profiles`(ENT-01), `is_keeper()`(security definer, `search_path = ''`), 가입 트리거 `handle_new_user` → `on_auth_user_created`
  - `products`(ENT-02, 길이·가격·재고 check, `products_theme_created_idx`, `updated_at` 트리거)
  - `book-covers` 버킷(공개, jpeg·png·webp, 5MB) + `storage.objects` 정책 3개
- `types/product.ts`: AR-API §1.1 그대로 (아래 "설계와 다르게 한 것")
- `data/products.ts`: 8권, 테마별 2권, 고정 uuid `b0000000-…-00000000000N`, 표지 `picsum.photos/seed/ub-<n>/600/800`, `createdAt` 2일 간격. 4번 책(`제철 밥상 일기`)은 재고 0 — 새로 들어온 책(API-03) 제외·품절 표시 확인용
- `scripts/gen-seed.mjs` → `supabase/seed.sql`(생성 파일, 커밋): `insert … on conflict (id) do update`, 재적용해도 8행
- `lib/supabase/env.ts`·`client.ts`·`server.ts`(`createClient`, `createPublicClient`)·`admin.ts`(`createAdminClient`, `server-only`)
- `lib/data/products.ts`: `toProduct`, API-01~03
- `supabase/tests/rls.test.sql`: pgTAP 22개 (아래 "검증 결과")

### TKT-DB-02
- `supabase/migrations/0020_commerce.sql`
  - `cart_items`(PK member_id+product_id), `shipping_addresses`(회원당 1행), `orders`, `order_items`, `payments`(`round_id` FK 없음, AR-DB §5.1), 부분 unique 2개, `updated_at` 트리거 4개
  - `order_number_seq` + 주문 번호 `UBYYMMDD-NNNN`(Asia/Seoul, AR-DB §5.2)
  - RLS 정책 14개(아래 표), `orders`·`order_items`·`payments`는 테이블 쓰기 권한도 회수
  - RPC 12개 — 주문 분기만, 회차 대상이면 `INVALID_STATE`(0030에서 `create or replace`로 회차 분기 추가)
- `supabase/tests/`(AR-DB §8 결과 표 형식)
  - `rls.test.sql`: 새 형식으로 바꾸고 commerce RLS 20개를 더해 42개
  - `state_machine.test.sql`: 주문 전이(§6.1) 29개
  - `payments.test.sql`: 확정·환불 멱등성 35개

### RPC (TKT-DB-02, 모두 security definer + `search_path = ''`, 오류는 `P0001` + `ErrorCode`)
| 함수 | 실행 권한 | 하는 일 | 오류 | 멱등 |
|---|---|---|---|---|
| `create_order(p_ship jsonb) returns orders` | authenticated | 배송지 검사 → 장바구니(재고>0 줄) → 주문·주문 줄(가격 사본), 합계 서버 계산 | `UNAUTHENTICATED`, `VALIDATION`, `OUT_OF_STOCK`(살 수 있는 줄 없음) | — |
| `create_payment(p_order_id, p_round_id) returns payments` | authenticated | 소유·`pending_payment` 확인 → `ready` 결제, 금액 = 주문 합계, `pg_order_id` 생성 | `NOT_FOUND`, `INVALID_STATE` | — (부를 때마다 새 결제) |
| `confirm_payment(p_pg_order_id, p_payment_key, p_amount) returns jsonb` | **service_role** | 금액 대조 → 재고 차감·장바구니 줄 삭제·기본 배송지 upsert·주문 `paid`·결제 `paid` | `AMOUNT_MISMATCH`, `OUT_OF_STOCK`(전체 롤백), `INVALID_STATE`, `NOT_FOUND` | ✓ `{already: true}` |
| `fail_payment(p_pg_order_id, p_code)` | **service_role** | `ready → failed` | — | ✓ |
| `request_cancel(p_kind, p_id) returns order_status` | authenticated | `paid → cancel_requested`, `cancel_rejected_at = null` | `NOT_FOUND`, `INVALID_STATE` | ✓ |
| `withdraw_cancel(p_kind, p_id) returns order_status` | authenticated | `cancel_requested → paid` | 같음 | ✓ |
| `cancel_pending(p_kind, p_id) returns order_status` | authenticated | `pending_payment → cancelled` (D-037) | 같음 | ✓ |
| `reject_cancel(p_kind, p_id) returns order_status` | authenticated(책방지기) | `cancel_requested → paid` + `cancel_rejected_at` | `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` | ✓ |
| `begin_refund(p_kind, p_id) returns payments` | authenticated(책방지기) | 취소 요청 주문의 결제 `paid → refunding`, 결제 행 반환(`pg_payment_key` 포함) | `FORBIDDEN`, `ALREADY_PROCESSING`, `INVALID_STATE` | ✓ |
| `complete_refund(p_payment_id)` | **service_role** | `refunding → refunded`, 주문 `refunded`, 재고 복구 | `INVALID_STATE`, `NOT_FOUND` | ✓ |
| `fail_refund(p_payment_id)` | **service_role** | `refunding → paid` | — | ✓ |
| `ship_order(p_order_id) returns order_status` | authenticated(책방지기) | `paid → shipped`, `shipped_at` | `FORBIDDEN`, `CANCEL_REQUESTED`, `INVALID_STATE` | ✓ |
- `p_kind`는 `'order'`만 받는다(회차 `'round'`는 0030). `p_ship` 키는 `recipientName`, `phone`, `address`(AR-API `ShippingSnapshot`과 같은 이름).

### TKT-DB-03
- `supabase/migrations/0030_subscription.sql`
  - 테이블 7개: `subscriptions`(활성 1개 부분 unique), `subscription_rounds`(진행 중 1개 부분 unique INV-12, 취소 요청 check INV-20), `reader_letters`, `round_contents`, `unboxing_codes`(활성 코드 unique), `shelf_memos`, `farewell_notes` + `updated_at` 트리거 4개
  - `payments.round_id` FK 추가(AR-DB §5.1), `payments_select_own`을 주문·회차 소유 기준으로 다시 만듦
  - RLS 정책 19개(`payments_select_own` 재작성 포함, 아래 표), RPC만 쓰는 테이블은 쓰기 권한 회수, `reader_letters`는 `body` 컬럼 update만
  - `postcards` 버킷(비공개, jpeg·png·webp, 10MB) + `storage.objects` 정책 4개(책방지기만)
  - 회차 RPC 5개 새로 만듦, 공용 RPC 8개를 `create or replace`로 회차 분기 추가(`fail_payment`·`fail_refund`는 그대로 공용)
- `supabase/tests/subscription.test.sql`: 회차 전이·멱등성·RLS 62개 (결과 표 형식)

### RPC (TKT-DB-03)
| 함수 | 실행 권한 | 하는 일 | 오류 | 멱등 |
|---|---|---|---|---|
| `create_round(p_letter, p_ship) returns subscription_rounds` | authenticated | 편지(10~2000자)·배송지 검사 → 회차 `pending_payment` + `reader_letters` | `VALIDATION`, `ROUND_IN_PROGRESS`(INV-12) | — |
| `open_round(p_round_id)` | authenticated(책방지기) | `arrived → reading`, `opened_at`. 그 밖에는 변화 없음 | `FORBIDDEN` | ✓ |
| `ship_round(p_round_id, p_code, p_teaser) returns char(6)` | authenticated(책방지기) | 책·답장·힌트(1~100자) 확인 → 재고−1 → 코드 insert → 힌트 저장 → `shipped` | `CANCEL_REQUESTED`, `MISSING_SHIPMENT_FIELDS`, `OUT_OF_STOCK`, `CODE_COLLISION`, `INVALID_STATE` | ✓ 이미 shipped면 처음 코드 |
| `unbox_round(p_round_id, p_code) returns boolean` | authenticated | 소유자·`shipped`·코드 일치 → `unboxed`·`used_at`. 그 밖에는 false | — (틀린 코드·남의 회차 모두 false) | ✓ |
| `end_subscription(p_note)` | authenticated | 구독 `ended`, 결제 대기 회차 `cancelled`, 안부(1~1000자)가 있으면 저장 | `INVALID_STATE`(활성 구독 없음), `VALIDATION` | — |
| (TKT-DB-04) `list_shipping_targets() returns table(kind, target_id, order_number, recipient_name, phone, address, books, paid_at)` | authenticated(책방지기) | INV-17 대상: `paid` 주문 + 취소 요청 표시 없는 `arrived`·`reading` 회차, 결제 시점 배송지 사본, `paid_at` 순 | `FORBIDDEN`(AC-19-3) | ✓ (읽기) |
| (TKT-DB-04) `keeper_counts() returns jsonb` | authenticated(책방지기) | `{ arrivedLetters, ordersToShip, cancelRequests }` (SCR-20) | `FORBIDDEN` | ✓ (읽기) |
| (TKT-DB-04) `withdraw_member() returns jsonb` | authenticated | AR-DB §7: 거부 → 결제 대기 건 취소 → 사적인 글·배송지·장바구니 삭제 → 활성 구독 마무리 → 거래 기록 연결 끊기. 반환 `{ postcardPaths: [...] }` | `WITHDRAW_BLOCKED`(AC-05-7·9) | ✓ (다시 불러도 지울 것 없음) |
| 공용 RPC 회차 분기 | (0020과 같음) | `create_payment(null, round)` 금액 30,000 / `confirm_payment` 회차: 활성 구독 연결(없으면 생성)·`arrived`·기본 배송지 upsert / `request·withdraw·reject_cancel('round')` 표시 설정·해제(**반환 null**) / `begin_refund('round')` 취소 요청 표시가 있는 arrived·reading만 / `complete_refund` 회차 `cancelled`·표시 해제 / `cancel_pending('round')` `pending_payment → cancelled` | 0020과 같음 | 0020과 같음 |

### RLS 정책 (TKT-DB-01 범위)
| 테이블 | 누가 | 무엇을 | 조건 |
|---|---|---|---|
| `profiles` | 회원 | select | 자기 행(`id = auth.uid()`) |
| `profiles` | 책방지기 | select | 전체(`is_keeper()`) |
| `profiles` | 회원 | update | 자기 행, `nickname` 컬럼만(테이블 update 회수 + 컬럼 grant) |
| `profiles` | 비로그인 | — | 없음 |
| `products` | 모두(anon·회원) | select | 전체 |
| `products` | 책방지기 | insert·update | `is_keeper()` / delete 정책 없음(D-023) |
| `storage.objects` (`book-covers`) | 모두 | select | `bucket_id = 'book-covers'` |
| `storage.objects` (`book-covers`) | 책방지기 | insert·update | `bucket_id = 'book-covers' and is_keeper()` |

### RLS 정책 (TKT-DB-02 범위)
| 테이블 | 누가 | 무엇을 | 조건 |
|---|---|---|---|
| `cart_items` | 회원 | select·insert·update·delete | `member_id = auth.uid()` / 책방지기 정책 없음 |
| `shipping_addresses` | 회원 | select·insert·update | own (delete는 탈퇴 RPC, TKT-DB-04) |
| `shipping_addresses` | 책방지기 | select | `is_keeper()` |
| `orders` | 회원 | select | own |
| `orders` | 책방지기 | select | `is_keeper() and member_id is not null` |
| `order_items` | 회원 / 책방지기 | select | 주문 소유 기준 / 책방지기는 `member_id`가 있는 주문 |
| `payments` | 회원 | select | 주문 소유 기준 (`payments_select_own`, 0030에서 회차 기준을 더해 다시 만든다) |
| `payments` | 책방지기 | select | `is_keeper()` |
| `orders`·`order_items`·`payments` | anon·authenticated | insert·update·delete | 테이블 권한 회수 — RPC만 쓴다 |

### RLS 정책 (TKT-DB-03 범위)
| 테이블 | 누가 | 무엇을 | 조건 |
|---|---|---|---|
| `subscriptions`·`subscription_rounds` | 회원 / 책방지기 | select | own / 전체. 쓰기는 RPC만(권한 회수) |
| `reader_letters` | 회원 | select / update(`body`만) | own / own + 회차 `pending_payment` |
| `reader_letters` | 책방지기 | select | 회차 `status <> 'pending_payment'` (INV-18) |
| `round_contents` | 회원 | select | own 회차 + `unboxed` (NFR-08) |
| `round_contents` | 책방지기 | select / insert·update | 전체 / 회차 `arrived`·`reading`일 때만. delete 권한 회수 |
| `unboxing_codes` | 책방지기 | select | 전체 (회원 정책 없음, 쓰기는 RPC) |
| `shelf_memos` | 회원 | select·delete / insert·update | own / own + own 회차 `unboxed`. 책방지기 정책 없음(INV-19) |
| `farewell_notes` | 회원 / 책방지기 | select | own / 전체. 쓰기는 `end_subscription` |
| `payments` | 회원 | select | 주문 **또는 회차** 소유 기준 (`payments_select_own` 재작성) |
| (TKT-DB-04) `shipping_list_downloads` | 책방지기 | insert·select | `is_keeper()`, insert는 `keeper_id = auth.uid()`. update·delete 권한 회수, 회원·비로그인 정책 없음 |
| `storage.objects` (`postcards`) | 책방지기 | select·insert·update·delete | `bucket_id = 'postcards' and is_keeper()`. 회원 정책 없음 → 서명 URL(admin)로만 열람 |

### lib/data 함수
| 함수 | API | 반환 | 비고 |
|---|---|---|---|
| `toProduct(row)` | — | `Product` | snake → camel 변환 한 곳 |
| `getProducts(theme?)` | API-01 | `Product[]` 최신순 | `'use cache'` + `cacheTag('products')`, 실패 시 throw |
| `getProduct(id)` | API-02 | `Product \| null` | uuid 형식 아니면 조회 없이 null |
| `getNewArrivals()` | API-03 | `Product[]` 재고>0 최신 4권 | D-035 |
- 트랜잭션 함수(RPC): TKT-DB-02의 RPC 12개(위 표). `lib/data` 래퍼는 아래 "질문" 참고

## 환경

### 1. 구성 (ADR-005 개정, 2026-10-21)
- Supabase **원격 프로젝트 1개**를 개발·검증·시연에 함께 쓴다. 로컬 Supabase(`supabase start`, Docker)는 쓰지 않는다.
- 저장소의 `supabase/`(마이그레이션·seed·테스트)를 CLI로 원격에 연결해 적용한다. 원격 적용은 사람이 한다.
- 되돌리기 없는 변경 규칙: 적용된 마이그레이션은 고치지 않는다, `db reset` 금지, seed는 다시 적용해도 결과가 같게, pgTAP 테스트는 `begin … rollback` (AR-DB §8, RISK-16).

### 2. 환경변수 (`.env.local`, 커밋 금지)
| 변수 | 공개 | 값을 가져오는 곳 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | 대시보드 Project Settings → API의 Project URL (`https://<ref>.supabase.co`) | `lib/supabase/client.ts`, `server.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | 대시보드 API Keys의 Publishable key | 위와 같음 |
| `SUPABASE_SERVICE_ROLE_KEY` | **비밀** | 대시보드 API Keys의 Secret(service_role) key | `lib/supabase/admin.ts`만 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 공개 / **비밀** | 토스페이먼츠 개발자센터 테스트 키 | 결제창 / `lib/payments/toss.ts`만 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | **비밀** | 네이버 개발자센터 앱 | `lib/auth/naver.ts`만 (ADR-003 B로 전환 시) |
| `NEXT_PUBLIC_SITE_URL` | 공개 | 로컬 `http://localhost:3000`, 배포 시 운영 도메인 | 콜백·리다이렉트 URL |

```bash
cp .env.example .env.local
```

### 3. 원격 프로젝트 연결 (사람이 실행)
1. supabase.com에서 프로젝트를 만든다(리전 Seoul 권장). DB 비밀번호를 따로 보관한다.
2. CLI 로그인 (브라우저 인증):
```bash
npx supabase login
```
3. 저장소를 원격 프로젝트에 연결 (DB 비밀번호 입력). 연결 정보는 `supabase/.temp/`에 저장되고 Git에서 제외된다:
```bash
npx supabase link --project-ref <프로젝트-ref>
```
4. 완료 조건 확인. 마이그레이션이 아직 없으므로 "적용할 것 없음"으로 끝나면 정상이다:
```bash
npx supabase db push --linked --dry-run
```

### 4. Supabase 대시보드 설정 (사람이 실행)
- Authentication → URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`, 배포 후 운영 도메인의 `/auth/callback`
- 소셜 제공자 콘솔에 등록할 콜백: `https://<project-ref>.supabase.co/auth/v1/callback` (1개)

### 5. 외부 키 발급 신청 (1일차, 사용은 BE 단계)
| 제공자 | 할 일 | 쓰는 티켓 |
|---|---|---|
| 카카오 디벨로퍼스 | 앱 생성, REST API 키·Client Secret 발급, 카카오 로그인 켜기, "이메일 없이 허용" 켜기, Redirect URI에 §4 콜백 등록. 대시보드 Authentication → Providers → Kakao에 키 입력 | TKT-BE-M2-01 |
| 네이버 개발자센터 | 앱 생성("개발 중" 상태), Client ID·Secret 발급, 시연 계정을 테스트 ID로 등록, Callback URL 등록 | TKT-BE-M2-02 (`custom:naver` 스파이크) |
| 토스페이먼츠 | 가입, 개발자센터에서 테스트 클라이언트 키·시크릿 키 확인 → `.env.local` | TKT-BE-M3-02 |

### 6. 하지 말 것
- `npx supabase config push`: 이 명령은 `config.toml`의 auth 설정(기본값 `site_url = "http://127.0.0.1:3000"` 등)으로 원격 대시보드 설정을 덮어쓴다. 원격 auth 설정은 대시보드에서만 바꾼다.
- `npx supabase start`, `npx supabase db reset` (ADR-005).

## 인프라 계층 확인 포인트
- 연결 후 `supabase/.temp/project-ref`가 생기는지, `git status`에 `supabase/.temp/`가 나오지 않는지 확인한다.
- `config.toml`의 로컬 전용 섹션(`[api]`, `[studio]`, `[local_smtp]` 등)은 원격 전용 구성에서는 쓰이지 않는다. 원격 작업에 쓰는 값은 `[db] major_version = 17`, `[db.seed] sql_paths = ["./seed.sql"]`이다.

### 마이그레이션 적용 절차 (TKT-DB-01부터 티켓마다 같다. 사람이 실행)
1. 적용될 내용 확인:
```bash
npx supabase db push --linked --dry-run --include-seed
```
2. 원격 적용:
```bash
npx supabase db push --linked --include-seed
```
3. 이후 DB 에이전트가 실행: `npx supabase gen types typescript --linked --schema public > types/database.ts` → `npx tsc --noEmit` → `npm run build`
4. pgTAP (Docker 필요, 로컬 DB는 띄우지 않음). 이 PC에는 Docker가 없어 SQL 편집기에 `supabase/tests/*.test.sql`을 파일마다 붙여 실행한다. TKT-DB-02부터는 결과 표 형식(AR-DB §8)이라 모든 `ok`/`not ok` 줄이 이름과 함께 보인다. 판정: `not ok` 0줄, 마지막 줄 `1..N`:
```bash
npx supabase test db --linked
```

## 레이어 계층 확인 포인트
- 상품 조회는 `lib/data/products.ts`의 `getProducts`·`getProduct`·`getNewArrivals`만 쓴다. 세 함수는 `'use cache'`라 **cookies·세션을 읽는 코드와 섞지 않는다**.
- 책을 저장(API-04)한 뒤에는 `updateTag('products')`로 세 함수의 캐시를 비운다(CONV-07). 쓰기는 `createClient()`(쿠키 세션)로 해야 RLS가 책방지기를 확인한다.
- `createPublicClient()`는 anon 권한이다. 공개 데이터(`products`) 외에는 쓰지 않는다.
- `createAdminClient()`는 RLS를 건너뛴다. 설계가 정한 곳(엽서 서명 URL, 탈퇴, 결제 확정 RPC)에서만 쓴다.
- env가 없으면 세 클라이언트 모두 `CONFIG_MISSING: …` 메시지로 throw한다. 화면 안내(AC-21-4)는 TKT-FE-01에서 이 메시지로 판별한다.
- (TKT-DB-02) 주문·결제 RPC의 호출 클라이언트:
  - 회원·책방지기 RPC(`create_order`, `create_payment`, `request_cancel`, `withdraw_cancel`, `cancel_pending`, `reject_cancel`, `begin_refund`, `ship_order`)는 `createClient()`(쿠키 세션)로 부른다. `auth.uid()`·`is_keeper()`로 권한을 본다.
  - 서버 전용 RPC(`confirm_payment`, `fail_payment`, `complete_refund`, `fail_refund`)는 `createAdminClient()`로만 부를 수 있다(실행 권한이 `service_role`뿐).
- RPC 오류는 `error.code === 'P0001'`이고 `error.message`가 `ErrorCode` 문자열(`OUT_OF_STOCK` 등)이다. 그 밖의 코드(예: `23505` unique 위반, `42501` 권한)는 `UNKNOWN`으로 본다.
- `confirm_payment`가 `AMOUNT_MISMATCH`·`OUT_OF_STOCK`으로 실패하면 DB는 전부 롤백된다. 이어서 SEQ-03 6단계(PG 보상 취소 → `fail_payment`)를 서버가 한다.
- `begin_refund`가 돌려주는 결제 행의 `pg_payment_key`로 `toss.cancel`을 부르고, 결과에 따라 `complete_refund` / `fail_refund`를 부른다.
- `create_payment`는 부를 때마다 새 `ready` 결제를 만든다([다시 결제하기], API-08). 남은 이전 `ready` 결제는 확정되지 않는다(부분 unique는 정산된 결제만 막는다).
- (TKT-DB-03) 회차 RPC 호출:
  - 회원 화면의 회차 정보는 `subscription_rounds`(+`teaser`는 `shipped`·`unboxed`일 때만 화면에 표시)에서, 책·답장·엽서 경로는 `round_contents`에서 읽는다. `round_contents`는 언박싱 전에는 RLS가 0행을 돌려주므로 회원 응답에 섞일 수 없다(NFR-08). 언박싱 전에 `createAdminClient()`로 `round_contents`를 읽어 회원에게 주면 안 된다(금지 패턴 9).
  - 엽서: `createClient()`로 `round_contents.postcard_path`를 읽은 뒤(언박싱 후에만 행이 온다) `createAdminClient().storage.from('postcards').createSignedUrl(path, 600)`.
  - 서재 작업(API-18)은 `round_contents`에 책방지기 세션으로 insert/update한다(회차 `arrived`·`reading`일 때만 RLS 통과). 엽서 업로드는 `postcards` 버킷 `rounds/{round_id}/postcard.{ext}`.
  - `ship_round`가 `CODE_COLLISION`이면 새 코드로 다시 부른다(SEQ-06, 최대 3회). `CODE_COLLISION`은 AR-API §2의 `ErrorCode` 목록에 없으므로 BE가 재시도용으로만 쓰고 화면에는 내보내지 않는다.
  - `request_cancel`·`withdraw_cancel`·`reject_cancel`은 회차일 때 `null`을 돌려준다. 화면은 회차를 다시 읽어 `cancel_requested_at`·`cancel_rejected_at`으로 표시를 정한다.
  - 회차 결제의 `confirm_payment` 반환은 `{ already, kind: 'round', roundId }`다.
- (TKT-DB-04) 운영·탈퇴:
  - 주소록(API-14): `createClient()`(책방지기 세션)로 `list_shipping_targets()` → 0행이면 `?empty=1`(AC-19-2) → CSV 생성(`domains/shipping`) → `shipping_list_downloads`에 `{ keeper_id: 내 id, row_count }` insert → 응답. 회차의 `order_number`는 `null`이고 `books`는 매칭 전이면 `null`이다.
  - 관리자 홈(SCR-20): `keeper_counts()`의 `arrivedLetters`·`ordersToShip`·`cancelRequests`.
  - 탈퇴(API-23): `createClient()`로 `withdraw_member()` → 반환 `postcardPaths`를 `createAdminClient().storage.from('postcards').remove(paths)` → `createAdminClient().auth.admin.deleteUser(uid)`(`profiles` cascade) → 로그아웃. RPC가 성공한 뒤 Storage·계정 삭제가 실패하면 다시 불러도 된다(두 번째 `withdraw_member()`는 지울 것이 없어 빈 목록을 돌려준다).

## 설계와 다르게 한 것 / 질문
- (TKT-DB-01, 사용자 승인 2026-10-22) `types/product.ts`를 DB-01에서 만들었다. AGENTS.md 담당은 FE지만 FE-01이 DB-01 다음이라 `toProduct`·`data/products.ts`가 컴파일되지 않는다. 내용은 AR-API §1.1 그대로이고, FE-01은 확인만 하면 된다.
- (TKT-DB-01, 사용자 승인) `lib/supabase/server.ts`에 `createPublicClient()`를 추가했다. Next 16의 `'use cache'` 안에서는 `cookies()`를 쓸 수 없어(next/dist/docs `use-cache.md`) CONV-07을 지키려면 세션 없는 클라이언트가 필요하다.
- (TKT-DB-01, 사용자 승인) `book-covers` 버킷을 `0005_storage.sql`이 아니라 `0001`에 넣었다. AR-DB §9 표와 HANDOFF TKT-DB-03 산출을 같이 고쳤다(`postcards`는 `0003`).
- `lib/supabase/env.ts`를 추가했다(설계 파일 목록에 없음). 세 클라이언트가 같은 env 확인을 쓰게 하려는 작은 파일이다.
- `lib/supabase/server.ts`의 `setAll`에 비어 있는 `catch`가 있다(GATE-06 금지 패턴 2). Supabase SSR 가이드가 정한 형태로, Server Component에서 쿠키 쓰기가 실패하는 것은 정상이고 세션 갱신은 `proxy.ts`가 맡는다. 주석으로 이유를 남겼다. GATE-06 grep(한 줄 `catch () {}`)에는 걸리지 않는다.
- 가입 트리거의 닉네임은 `raw_user_meta_data`의 `name` → `full_name` → `nickname` → `user_name` 순으로 찾는다(D-A06 "제공자 이름"). 카카오·`custom:naver`가 실제로 어느 키를 채우는지는 TKT-BE-M2-01·02에서 확인이 필요하다.
- `lib/data/products.ts`의 조회 실패는 `ErrorCode`로 바꾸지 않고 throw한다. `lib/http/result.ts`(ErrorCode)는 TKT-BE-M2-01에서 생기고, API-01의 화면 처리(AC-01-4)는 페이지의 오류 처리로 한다.
- `next.config.ts`의 `images.remotePatterns`(AR-DB §6)는 표지를 화면에 그리는 TKT-FE-01에서 넣는다고 보고 이번에 넣지 않았다.
- `config.toml`은 기본값에서 바꾸지 않았다. 설계(AR-DB, ADR-005)에 값이 정해져 있지 않고, 원격 전용이라 `config push`를 하지 않으면 원격에 영향이 없다.
- 원격 Postgres는 17.11(`supabase/.temp/postgres-version`)로 `config.toml`의 `major_version = 17`과 같다.
- 네이버 키(`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`)는 아직 발급 전이다. TKT-BE-M2-02 전에 필요하다.
- (TKT-DB-02 정정) 위 DB-01 항목의 `postcards`는 `0003`이 아니라 `0030_subscription.sql`에 들어간다(AR-DB §9 번호 간격, 2026-10-22).
- (TKT-DB-02) 설계에 세부가 없어 정한 것:
  - `p_kind`는 `text`(`'order'`·`'round'`), `p_ship` jsonb 키는 `recipientName`·`phone`·`address`(AR-API `ShippingSnapshot`과 같은 이름).
  - 상태 전이 RPC의 반환은 `order_status`(API-11·13 "새 상태"). 이미 목표 상태면 오류 없이 그 상태를 돌려준다(멱등 ✓).
  - `create_order`는 배송지를 `shipping_addresses`와 같은 규칙(이름 1~50자, 연락처 `^[0-9-]{9,13}$`, 주소 1~200자)으로 검사한다. 결제 승인 뒤 기본 배송지 upsert가 제약 위반으로 실패하는 것을 막기 위해서다.
  - 살 수 있는 줄(재고>0)이 하나도 없으면 `OUT_OF_STOCK`(빈 장바구니 포함).
  - 서버 전용 RPC는 첫 줄에서 `auth.role() = 'service_role'`을 확인하고, 실행 권한도 `service_role`에만 준다.
  - `begin_refund`는 주문이 `cancel_requested`일 때만 시작한다(AR-API §6.1의 `refunded`는 `cancel_requested`에서만 온다).
  - `cancel_pending`은 주문만 `cancelled`로 바꾸고, 남은 `ready` 결제는 그대로 둔다. 늦게 온 승인은 `confirm_payment`가 `INVALID_STATE`로 막고 서버가 보상 취소한다.
- **질문 (TKT-DB-02)**: AR-API §2는 "RPC 오류를 `lib/data`가 `ErrorCode`로 바꾼다"고 하지만, 주문·결제용 `lib/data` 함수(`lib/data/orders.ts` 등)는 어느 티켓의 산출에도 없다. DB-02는 HANDOFF 산출(`0020_commerce.sql`, 테스트)만 만들었다. BE-M3 티켓에서 BE가 만들지, DB 티켓을 추가할지 정해 주세요. 정하기 전까지 BE는 위 "레이어 계층 확인 포인트"의 오류 규칙으로 RPC를 직접 부를 수 있다.
  - **답 (사용자 결정 2026-10-22)**: 주문·결제(그리고 회차·운영) RPC를 감싸는 `lib/data` 함수는 **백엔드 에이전트가 만든다**. DB가 만든 `lib/data`는 `lib/data/products.ts`(API-01~03)뿐이다. BE는 RPC 호출 클라이언트와 `P0001` → `ErrorCode` 변환 규칙을 위 "레이어 계층 확인 포인트"대로 쓴다. `AGENTS.md` 디렉토리 지도는 `lib/data/`를 DB 담당으로 적고 있으니, BE가 쓰기 전에 지도를 맞춰야 한다(ARCH 산출물).
- 상품 가격이 0원인 책만 담아 주문하면 `payments.amount > 0` 제약 때문에 `create_payment`가 `UNKNOWN`(23514)으로 실패한다. 설계 그대로 두었고, 0원 책은 시연 데이터에 없다.
- (TKT-DB-03, 사용자 승인 2026-10-22) `ship_round`에 `p_teaser`를 추가했다. 힌트는 API-19 입력이고 발송 시 필수인데, 회차 행은 RPC로만 쓸 수 있어 저장할 길이 없었다. AR-DB §5 표와 AR-API SEQ-06을 같이 고쳤다.
- (TKT-DB-03, 사용자 승인) 회차 분기의 `request_cancel`·`withdraw_cancel`·`reject_cancel`은 `null`을 돌려준다(시그니처 유지). AR-DB §5.1에 적었다.
- (TKT-DB-03) 설계에 세부가 없어 정한 것:
  - `create_round`는 편지(10~2000자)와 배송지를 함수에서 먼저 검사해 `VALIDATION`으로 돌려준다(제약 위반 23514 대신).
  - `unbox_round`는 이미 `unboxed`인 자기 회차에 맞는 코드를 다시 넣으면 `true`(멱등). 다른 경우는 설계대로 모두 `false`.
  - `reject_cancel('round')`은 이미 거절된(표시 없음 + 거절 시각 있음) 회차면 `null`, 표시가 없는데 거절 기록도 없으면 `INVALID_STATE`.
  - `complete_refund`의 회차 분기는 `cancelled`로 바꾸면서 `cancel_requested_at`을 지운다. 표 §3의 `check (cancel_requested_at is null or status in ('arrived','reading'))` 때문이다. 회차는 발송 전이라 재고를 되돌릴 것이 없다.
  - `end_subscription`은 결제 대기 회차를 회원 기준으로 모두 `cancelled`로 바꾼다(결제 대기 회차는 아직 구독에 연결되지 않았다).
  - (TKT-DB-04) `list_shipping_targets`의 반환 열은 SEQ-11 CSV 열(구분·번호·받는 사람·연락처·주소·책)에 맞춰 `kind`·`target_id`·`order_number`·`recipient_name`·`phone`·`address`·`books`·`paid_at`으로 정했다(AR-DB §5는 `table(...)`로만 적혀 있음). 탈퇴로 연결이 끊긴 거래 기록(`member_id is null`)은 대상에서 뺀다(PM-DOMAIN §7 "주소록 대상 아님").
  - (TKT-DB-04) `keeper_counts`의 키는 `arrivedLetters`(회차 `arrived`), `ordersToShip`(주문 `paid`), `cancelRequests`(주문 `cancel_requested` + 회차 취소 요청 표시)로 정했다(SCR-20 문구 기준).
  - (TKT-DB-04) `withdraw_member`는 활성 구독을 `ended`로 마무리한 뒤 연결을 끊는다. AR-DB §7에는 없지만, 회원 없는 `active` 구독이 남지 않게 했다.
  - `shelf_memos` update 정책: `using`은 own만, `with check`에 own 회차 `unboxed`를 둔다. delete는 own만(설계 "own + unboxed"와 같은 결과: 메모는 unboxed 회차에만 생긴다).

## 검증 결과
### TKT-DB-04 (2026-10-22, 원격 적용 후)
- 원격 적용: 사람이 `npx supabase db push --linked` 실행. `migration list` 0001·0020·0030·0040 local=remote, 다시 dry-run하면 "Remote database is up to date."
- `types/database.ts`: `gen types --linked --schema public`으로 다시 생성(952줄, `shipping_list_downloads`·RPC 3개 포함)
- GATE-01 `npx tsc --noEmit`: 통과 / GATE-02 `npm run lint`: 통과 / GATE-03 `npm test`: 3 pass, 0 fail / GATE-04 `npm run build`: 통과
- GATE-05 `.env` 추적 0줄 / GATE-06 금지 패턴 0줄
- GATE-07 pgTAP: **78개 통과** (사람이 SQL 편집기로 실행, `not ok` 0줄, 마지막 줄 `1..36`·`1..42`). 파일과 검사 수:
  - `admin_ops.test.sql` 36개 (새 파일): 주소록 대상 INV-17(AC-19-1·3·4), 할 일 수(SCR-20), 다운로드 기록(ADR-007), 탈퇴 거부(AC-05-7·9)·처리(AC-05-4·8), 거래 기록 보관
  - `rls.test.sql` 42개
  - 할 일 수는 원격 DB가 시연 데이터와 공용(RISK-16)이라 같은 조건의 직접 집계와 비교한다

### TKT-DB-03 (2026-10-22, 원격 적용 후)
- 원격 적용: 사람이 `npx supabase db push --linked` 실행. `migration list` 0001·0020·0030 local=remote, 다시 dry-run하면 "Remote database is up to date."
- `types/database.ts`: `gen types --linked --schema public`으로 다시 생성(908줄, 새 테이블 7개·회차 RPC 5개 포함)
- GATE-01 `npx tsc --noEmit`: 통과 / GATE-02 `npm run lint`: 통과 / GATE-03 `npm test`: 3 pass, 0 fail / GATE-04 `npm run build`: 통과
- GATE-05 `.env` 추적 0줄 / GATE-06 금지 패턴 0줄
- GATE-07 pgTAP: **168개 통과** (사람이 SQL 편집기로 파일마다 실행, `not ok` 0줄, 마지막 줄 `1..62`·`1..42`·`1..29`·`1..35`). 0030이 공용 RPC를 교체한 뒤에도 주문 분기 회귀 없음. 파일과 검사 수:
  - `subscription.test.sql` 62개 (새 파일): 회차 전이 §6.2, 멱등성(AC-08-6, AC-15-4, AC-20-4), RLS(AC-11-9, AC-16-4·6, AC-17-5, AC-18-8, INV-18·19), postcards 버킷
  - `rls.test.sql` 42개, `state_machine.test.sql` 29개, `payments.test.sql` 35개: 주문 분기가 그대로인지(회귀) 확인. `rls.test.sql`의 GATE-07 검사가 새 테이블 7개의 RLS 활성도 확인한다

### TKT-DB-02 (2026-10-22, 원격 적용 후)
- 원격 적용: 사람이 `npx supabase db push --linked` 실행. `migration list` 0001·0020 local=remote, 다시 dry-run하면 "Remote database is up to date."
- `types/database.ts`: `gen types --linked --schema public`으로 다시 생성(577줄, 새 테이블 5개·RPC 12개 포함)
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-02 `npm run lint`: 통과
- GATE-03 `npm test`: tests 3 / pass 3 / fail 0
- GATE-04 `npm run build`: 통과
- GATE-05: `.env` 추적 0줄 / GATE-06 금지 패턴 grep: 0줄
- GATE-07 pgTAP: **106개 통과** (사람이 SQL 편집기로 파일마다 실행, `not ok` 0줄, 마지막 줄 `1..42`·`1..29`·`1..35`). 파일과 검사 수:
  - `rls.test.sql` 42개: RLS 전체 활성, 가입 트리거, 비로그인 6, 회원 A 15(직접 쓰기 거부 포함), 회원 B 5(AC-09-4), 책방지기 9, book-covers 3
  - `state_machine.test.sql` 29개: AR-API §6.1 전이 + 거부(INV-04, AC-09-3·5·6, AC-10-1·4, D-037), 주문 번호 형식
  - `payments.test.sql` 35개: AC-08-5·6·8, AC-10-2·3·5, 서버 전용 RPC 권한, 결제 금액·`pg_order_id`

### TKT-DB-01 (2026-10-22, 원격 적용 후)
- 원격 적용: 사람이 `npx supabase db push --linked --include-seed` 실행. `migration list` 0001 local=remote, 다시 dry-run하면 "Remote database is up to date."
- `types/database.ts`: `gen types --linked --schema public`으로 생성(258줄, `products`·`profiles`·`is_keeper`·enum 6개)
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-02 `npm run lint`: 통과
- GATE-03 `npm test`: tests 3 / pass 3 / fail 0 (DB-01에는 단위 테스트 대상 없음)
- GATE-04 `npm run build`: 통과
- GATE-05: `NEXT_PUBLIC_`에 비밀값 0줄, `.env` 추적 0줄
- GATE-06 금지 패턴 grep: 0줄 (위 `catch` 설명 참고)
- GATE-07 pgTAP `supabase/tests/rls.test.sql`: **22개 통과** (사람이 SQL 편집기로 실행, 결과 `1..22`, 실패 줄 없음). 항목: RLS 전체 활성 1, 가입 트리거 3, 비로그인 3, 회원 7, 책방지기 5, book-covers 3
- 공개 키(anon)로 원격 직접 조회 (API-01~03과 같은 쿼리):
  - AC-02-1: 전체 8권, 테마별 2·2·2·2 / `nature` 필터 2권
  - AC-03-1·4: 1번 책 조회됨 / 없는 id는 `null`
  - D-035: 새로 들어온 책 4권, 재고 0 책 미포함
  - RLS: anon `profiles` 0행, anon `products` insert 거부(42501)
- NFR-16: 표지 8개 주소 모두 HTTP 200
- `node --import tsx scripts/gen-seed.mjs`: `supabase/seed.sql: products 8행`

### TKT-DB-00
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-05: `.env` 추적 0줄, `NEXT_PUBLIC_`에 비밀값 0줄, `supabase/.temp/` 미추적
- GATE-07: 해당 없음 (테이블 없음)
- 원격 연결: 사람이 `login`·`link` 완료. `npx supabase db push --linked --dry-run` exit 0, 적용 대상 0개
- `.env.local`: Git 제외 확인. Supabase 변수 3개와 `NEXT_PUBLIC_SITE_URL` 입력됨(값은 확인하지 않음, 형식만 확인)
