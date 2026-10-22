# HANDOFF — Architect → DB / BE / FE / QA (AR-HAND)

- ADR-001~009 모두 Accepted(2026-10-21). 모든 티켓 공통으로 `AGENTS.md`(디렉토리 지도)와 `06-quality-gates.md`를 먼저 읽는다.
- 선후관계: 같은 마일스톤 안에서 DB → BE → FE → QA. "선행" 열은 전체 티켓 ID(`TKT-DB-01`)를 쉼표로 나열하고, 없으면 `—`로 쓴다. `scripts/check-handoff.mjs --ticket`이 이 열을 읽어 선행 티켓의 브리핑을 필수 입력으로 점검한다(PIPELINE §2-1).
- `lib/data` 담당 (사용자 결정 2026-10-22): `lib/data/products.ts`(상품 조회 API-01~03)는 DB, 그 밖의 `lib/data/*`(RPC 래퍼·행→화면 타입 변환)는 BE가 각 티켓 "산출"에 적힌 파일로 만든다. RPC 시그니처·오류 규칙·호출 클라이언트는 `docs/03-db/briefing.md`를 따른다.
- 티켓 1개 = 1~2시간. "하지 말 것"의 공통: 스키마·API 이름 임의 변경(필요하면 Architect에 질문), 범위 밖 기능 추가.

## M1 쇼핑 기반 (1일차) — KANT 증빙 순서 R2 → R3 → R4 → R5·R6·R7 → R8 → R9
| TKT | 내용 | 담당 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|
| TKT-FE-00 | 구조 정리 커밋: 템플릿 잔재 삭제, `lint`→`eslint .`, `.gitignore`·`.env.example`, 중복 패키지 제거(`react-icons`, 사용처 0이면 `sass`·`cn`), `zod`·`server-only`·`@tosspayments/tosspayments-sdk` 추가 | FE | 05 §1·§5, 02 §2, ADR-009 | 정리 커밋 1개(기능 변경 없음) | GATE-01~06 | — |
| TKT-DB-00 | `supabase init`(`config.toml`), 원격 프로젝트 연결(사람이 `supabase login`·`link`), 카카오·네이버·토스 키 발급 신청(1일차). 로컬 Supabase 미사용(ADR-005) | DB | ADR-003·004·005 | `supabase/config.toml`, `docs/03-db/briefing.md` §환경 | `npx supabase db push --linked --dry-run` 정상 종료 | TKT-FE-00 |
| TKT-DB-01 | enum·`profiles`·`products`·`is_keeper`·가입 트리거, `book-covers` 버킷, `lib/supabase/*`, `lib/data/products.ts`(API-01~03, `toProduct`), `data/products.ts` 8권 + `scripts/gen-seed.mjs` + `seed.sql`, `types/database.ts` | DB | 03 §2·3·4·6·8·9, 04 §1.1·API-01~03, ADR-001 | `supabase/migrations/0001_profiles_products.sql`, 위 파일들 | AC-02-1·3, NFR-16, GATE-07 | TKT-DB-00 |
| TKT-FE-01 | `types/product.ts`, `app/layout.tsx`(Header·Footer), `components/Header·Footer·ProductCard.tsx`, env 누락 안내(AC-21-4) | FE | 04 §1.1·4.1, 05 CONV-03·04·06, PM-SCR §2, UX-PLAN-FE | 위 파일, `docs/05-frontend/briefing-TKT-FE-01.md` | AC-01-3, AC-04-2, KANT-R3·R4·C7·C8 | TKT-DB-01 |
| TKT-FE-02 | `/` 메인, `/products` 목록(테마 주소 반영·`.map()`·빈 상태), `domains/products/theme.ts`(`parseTheme`)+테스트 | FE | 04 §4, 05 CONV-07·08·09, SCR-01·02 | `app/page.tsx`, `app/products/page.tsx` | AC-01-1·2·4, AC-02-1~5, KANT-R5·C9·C11 | TKT-FE-01 |
| TKT-FE-03 | `/products/[id]` 상세(노트 최상단), `not-found.tsx` | FE | 04 §4, SCR-03·04 | `app/products/[id]/page.tsx`, `not-found.tsx` | AC-03-1·2·4·5, KANT-R6·R9·C12·C14 | TKT-FE-02 |
| TKT-QA-01 | M1 검증: KANT R2~R9, NFR-01~05·14~16, 360/768/1280 스크린샷 | QA | 06, PM-AC M1, PM-KANT, `docs/uiux/review/QA/README.md`(UX-CTX-QA), FE 브리핑 | `docs/06-qa/briefing-TKT-QA-01.md` | GATE-01~06, AC M1 표 | TKT-FE-03 |

## M2 회원·관리자 (2일차 오전)
| TKT | 내용 | 담당 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|
| TKT-BE-M2-01 | `proxy.ts`·`lib/supabase/proxy.ts`, `/auth/callback`, `lib/auth/guards.ts`, `lib/http/result.ts`, 카카오 로그인 | BE | 04 §2·API-24~26·SEQ-01, ADR-003 | 위 파일, `docs/04-backend/briefing.md` | AC-05-2·5·6 | TKT-DB-01 |
| TKT-BE-M2-02 | 네이버 `custom:naver` 스파이크(반나절). 실패 시 ADR-003 B로 `app/auth/naver/*/route.ts` + `lib/auth/naver.ts` | BE | ADR-003 | 결과를 브리핑에 기록 | AC-05-1·2(네이버) | TKT-BE-M2-01 |
| TKT-FE-M2-01 | `/login`, `/mypage` 골격(메뉴), `/admin` 레이아웃·홈(SCR-20 숫자는 M4 후 연결) | FE | SCR-05·06·20, 04 API-25·26 | 화면 + 브리핑 | AC-05-1·3, AC-06-5 | TKT-BE-M2-01 |
| TKT-BE-M2-03 | `saveProduct`(API-04, 표지 업로드 `book-covers`, `updateTag('products')`), `domains/products/product.schema.ts` | BE | 04 API-04, ADR-008 | actions + 스키마 + 테스트, `lib/data/product-admin.ts`(책 저장·표지 업로드) | AC-06-1·2·4 | TKT-BE-M2-01 |
| TKT-FE-M2-02 | `/admin/products`(목록·새 책·편집, 삭제 버튼 없음) | FE | SCR-08 | 화면 | AC-06-1~5 | TKT-BE-M2-03 |
| TKT-QA-M2 | 로그인 2종·권한 차단 | QA | 06, PM-AC M2 | `docs/06-qa/briefing-TKT-QA-M2.md` | NFR-06 | TKT-FE-M2-02 |

## M3 구매 (2일차 오후)
| TKT | 내용 | 담당 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|
| TKT-DB-02 | `cart_items`·`shipping_addresses`·`orders`·`order_items`·`payments` + RPC(`create_order`, `create_payment`, `confirm_payment`, `fail_payment`, 취소·환불·`ship_order`, `cancel_pending`) 주문 분기만, `order_number_seq` + pgTAP | DB | 03 §3·4·5(§5.1·5.2)·8·9, 04 §6.1·6.3 | `0020_commerce.sql`, `supabase/tests/*` | GATE-07, AC-08-5·6·8, AC-10-5 | TKT-DB-01 |
| TKT-BE-M3-01 | 장바구니·배송지 액션(API-05·06), `domains/cart`(수량 보정)+테스트 | BE | 04 API-05·06 | actions, `lib/data/cart.ts`(장바구니·기본 배송지) | AC-07-1~5, AC-08-2·3 | TKT-DB-02 |
| TKT-BE-M3-02 | `lib/payments/toss.ts`(confirm·cancel·멱등키), API-07·08·09·10 | BE | ADR-004, 04 SEQ-02·03 | route·actions, `lib/data/orders.ts`(`create_order`), `lib/data/payments.ts`(`create_payment`·`confirm_payment`·`fail_payment`) | AC-08-1·4~8, NFR-07·19 | TKT-BE-M3-01 |
| TKT-BE-M3-03 | 취소 요청·철회·거절·환불·발송(API-11~13), 주문 조회 | BE | 04 SEQ-08, §6.1 | actions, `lib/data/orders.ts`(취소·철회·거절·결제 대기 취소·발송·주문 조회), `lib/data/payments.ts`(`begin_refund`·`complete_refund`·`fail_refund`) | AC-09-*, AC-10-* | TKT-BE-M3-02 |
| TKT-FE-M3-01 | `/cart`, `/checkout`, `/checkout/result`, `/mypage/address` | FE | SCR-07·09~11 | 화면 | AC-07-*, AC-08-* | TKT-BE-M3-02 |
| TKT-FE-M3-02 | `/mypage/orders`, `/admin/orders` | FE | SCR-12·13 | 화면 | AC-09-*, AC-10-* | TKT-BE-M3-03 |
| TKT-DB-05 | 결제 대기 주문 회원당 1건(D-044, INV-21): 기존 대기 주문 정리 → `orders_one_pending_per_member` → `create_order` 재사용·대체(시그니처 그대로). 같은 내용 두 번 호출하는 기존 pgTAP 조정 + 새 테스트 | DB | 03 §3·3.1·5.3·9, 04 §6.1 SEQ-02, PM-AC AC-08-9·10 | `0060_create_order_reuse_pending.sql`, `supabase/tests/*`, `docs/03-db/briefing.md` | GATE-07, AC-08-9·10 | TKT-DB-04 |
| TKT-BE-M3-04 | 영향 확인: `createOrder`·`startOrderPayment`·결제 경로가 재사용·대체된 주문에서도 맞게 도는지(코드 변경 없음이 기대값) | BE | AR-DB §5.3, 04 SEQ-02·03 | `docs/04-backend/briefing.md` | GATE-01~06 | TKT-DB-05 |
| TKT-FE-M3-03 | 영향 확인: 주문서·결과·주문 현황이 재사용·대체 규칙과 맞는지(코드 변경 없음이 기대값) | FE | PM-AC AC-08-9·10, AR-DB §5.3 | `docs/05-frontend/briefing-TKT-FE-M3-03.md` | GATE-01~06 | TKT-BE-M3-04 |
| TKT-QA-M3 | 테스트 결제 → 접수 → 발송, 중복·금액 변조·환불 실패, 결제 대기 주문 재사용·대체 | QA | 06 §2 순위 3, PM-AC M3 | `briefing-TKT-QA-M3.md` | NFR-07·09·19, AC-08-9·10 | TKT-FE-M3-02, TKT-FE-M3-03 |

## M4 편지 구독 (3일차) — 편지 → 서재 → 발송·언박싱 → 메모·해지
| TKT | 내용 | 담당 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|
| TKT-DB-03 | 구독·회차·편지류·코드·메모·안부 테이블, 회차 RPC, `payments.round_id` FK·공용 RPC 회차 분기(`create or replace`), `postcards` 버킷 + pgTAP(RLS·전이) | DB | 03 §3~6(§5.1)·8·9, 04 §6.2 | `0030_subscription.sql`(`postcards` 버킷 포함) | GATE-07, AC-11-9, AC-16-6, AC-17-5, AC-18-8 | TKT-DB-02 |
| TKT-BE-M4-01 | `postLetter`(API-15), 회차 결제 연결(SEQ-04), `getWindow`(API-16), `domains/subscriptions/window-copy.ts` | BE | 04 SEQ-04, §4.2 | actions·data, `lib/data/rounds.ts`(`create_round`, `getWindow` API-16) | AC-11-1~10, AC-12-* | TKT-DB-03 |
| TKT-FE-M4-01 | `/letters/new`(봉투·우체통 전환, 동작 줄이기), `/mypage/window`(WindowScene·BlindBook) | FE | SCR-14·15, UX-PLAN-FE, CONV-11 | 화면 | AC-11-*, AC-12-*, NFR-10·11 | TKT-BE-M4-01 |
| TKT-BE-M4-02 | 서재: `openRound`·`saveRoundContents`(엽서 업로드)·`shipRound`(코드, `lib/crypto.ts`, `domains/subscriptions/unboxing-code.ts`+테스트) | BE | 04 SEQ-05·06 | actions, `lib/data/rounds.ts`(`open_round`·`round_contents` 저장·`ship_round`) | AC-13-*, AC-14-*, AC-15-* | TKT-DB-03 |
| TKT-FE-M4-02 | `/admin/desk` 한 열 화면(작별 안부 목록 포함) | FE | SCR-19, NFR-13 | 화면 | AC-13-1, AC-18-4 | TKT-BE-M4-02 |
| TKT-BE-M4-03 | `unbox`(API-20, 서명 URL), 메모(API-21), 구독 마무리(API-22), 회차 취소(API-11~13 round), 탈퇴(API-23) | BE | 04 SEQ-07·08·09·10 | actions, `lib/data/rounds.ts`(`unbox_round`·서가 메모·`end_subscription`·회차 취소), `lib/data/members.ts`(`withdraw_member`) | AC-16-*, AC-17-*, AC-18-*, AC-20-*, AC-05-4·7~9 | TKT-DB-03 |
| TKT-DB-04 | `shipping_list_downloads`, `list_shipping_targets`, `keeper_counts`, `withdraw_member` | DB | 03 §5·7·8·9, ADR-007 | `0040_admin_ops.sql` | AC-19-1·4, AC-05-4·8 | TKT-DB-03 |
| TKT-BE-M4-04 | 주소록 Route Handler(API-14), `domains/shipping/shipping-list.ts`(CSV)+테스트 | BE | ADR-007, 04 SEQ-11 | route, `lib/data/admin.ts`(`list_shipping_targets`·`keeper_counts`·다운로드 기록) | AC-19-* | TKT-DB-04 |
| TKT-FE-M4-03 | `/mypage/rounds/[id]`, `/mypage/shelf`, `/mypage/farewell`, SCR-13 주소록 버튼·안내 문구, SCR-20 숫자 | FE | SCR-16~18·13·20 | 화면 | AC-16-*, AC-17-*, AC-18-*, AC-19-2 | TKT-BE-M4-03, TKT-BE-M4-04 |
| TKT-BE-M4-05 | 서재 작업 목록에 받는 사람 이름(`getDeskRounds` → `DeskRound[]`, select에 `ship_recipient_name`), 언박싱 책에 테마(`UNBOXED_COLUMNS`의 `products(...)`에 `theme`, `UnboxedRound.product` 타입). DB·RLS 변경 없음 | BE | 04 §1.2(`DeskRound`, `UnboxedRound`) | `lib/data/rounds.ts`, `domains/subscriptions/types/round.types.ts`, `docs/04-backend/briefing.md` | GATE-01~06 | TKT-BE-M4-03 |
| TKT-FE-M4-04 | 서재 작업 목록 "<이름> 님의 편지"(SCR-19 시안), 언박싱·나의 서가 표지에 `theme` 전달(UX-D-10 대체 표지) | FE | 04 §1.2, UX-PLAN-FE screens §SCR-16·17·19 | `app/admin/desk/page.tsx`, `components/UnboxedView.tsx`, `app/mypage/shelf/page.tsx`, `docs/05-frontend/briefing-TKT-FE-M4-04.md` | GATE-01~06, AC-04-2 | TKT-BE-M4-05 |
| TKT-QA-M4 | 시연 흐름 7~10, 블라인드 응답 검사, 회원 간 열람 | QA | 06 §2 순위 2~4, PM-AC M4, `docs/uiux/review/QA/scenarios.md` | `briefing-TKT-QA-M4.md` | NFR-08·09·17·18 | TKT-FE-M4-03 |

## M5 마감 (4일차 오전)
| TKT | 내용 | 담당 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|
| TKT-FE-M5-01 | README (아래 목차) + 화면 캡처 | FE | AC-21-1·2, ADR-003·005 | `README.md` | KANT-R10·C17 | TKT-QA-M4 |
| TKT-QA-M5 | 깨끗한 클론 실행, Vercel 배포 점검, 시연 리허설 | QA | 06, PM-SCR §5 | `briefing-TKT-QA-M5.md` | NFR-04·15, AC-21-* | TKT-FE-M5-01 |

### README 목차 (확정)
1. 소개(Use Case 한 문장, 4개 테마·편지 구독) 2. 컴포넌트 텍스트 트리(`app/layout.tsx` → Header·Footer, 목록 → ProductCard) 3. 로컬 실행(`npm install`, `cp .env.example .env.local`에 원격 Supabase URL·키 입력, `npm run dev`) 4. 환경변수·Supabase 설정(원격 프로젝트 연결 `npx supabase login`·`npx supabase link --project-ref <ref>`·`npx supabase db push --linked --include-seed`, Auth 리다이렉트 URL, 카카오 "이메일 없이 허용", `custom:naver`, 책방지기 권한 부여 SQL 1줄) 5. 결제 테스트 방법(토스 테스트 키·테스트 카드) 6. 운영 절차(5년 경과 거래 기록 삭제 SQL) 7. 결과 캡처

## 티켓 수
| M | DB | BE | FE | QA | 계 |
|---|---|---|---|---|---|
| M1 | 2 | 0 | 4 | 1 | 7 |
| M2 | 0 | 3 | 2 | 1 | 6 |
| M3 | 2 | 4 | 3 | 1 | 10 |
| M4 | 2 | 5 | 4 | 1 | 12 |
| M5 | 0 | 0 | 1 | 1 | 2 |
| 계 | 6 | 12 | 14 | 5 | 37 |

## 남은 리스크
RISK-16 개발·시연 DB 공용(ADR-005 개정: 되돌리기 없는 변경 규칙, seed 재적용 가능, 테스트 rollback), RISK-03 보상 취소 실패(로그+문의 안내), RISK-11 네이버 매핑 미확인(스파이크로 확인), RISK-12 네이버 운영 검수·카카오 비즈 앱(이번 범위 밖), RISK-14 5년 경과 기록 수동 삭제, RISK-15 M4 일정. Footer 법정 고지 미기재(D-021)는 실결제 전환 전 필요.
