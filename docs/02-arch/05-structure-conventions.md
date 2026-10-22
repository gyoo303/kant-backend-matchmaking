# 05. 디렉토리 구조 & 코딩 컨벤션 (AR-CONV)

- 입력: ADR-009(구조), ADR-002·005·008, AR-API, 기존 저장소(`git ls-files`)
- 저장소 루트 `AGENTS.md`의 `## 디렉토리 지도`가 이 문서의 요약이다. 구조가 바뀌면 같은 커밋에서 둘 다 고친다.

## 1. 디렉토리 (기존 구조 기준, `src/` 없음)
```
app/                              # 라우트·화면·Server Action(actions.ts)·Route Handler(route.ts). 비즈니스 규칙 금지
  layout.tsx                      # <Header/> {children} <Footer/>  (KANT-R4)
  page.tsx                        # SCR-01
  products/page.tsx               # SCR-02 (KANT 고정)
  products/[id]/page.tsx          # SCR-03 (KANT 고정) + not-found.tsx (SCR-04)
  login/page.tsx, auth/callback/route.ts
  cart/, checkout/(result/), letters/new/
  mypage/(address|orders|window|rounds/[id]|shelf|farewell)/
  admin/(products|orders|desk)/   # admin/layout.tsx에서 requireKeeper()
  api/payments/toss/(success|fail)/route.ts, api/admin/shipping-list/route.ts
components/                       # Header.tsx, Footer.tsx, ProductCard.tsx (KANT 고정) + 화면 공용 컴포넌트
  ui/                             # shadcn 기본 컴포넌트 (기존)
domains/<d>/                      # 순수: 타입·zod 스키마·규칙 함수·문구 상수 (+ *.test.ts)
  products/ cart/ orders/ payments/ subscriptions/ shipping/
types/product.ts                  # KANT 고정 (Product, Theme)
types/database.ts                 # supabase gen types (DB 에이전트만 수정)
data/products.ts                  # KANT Mock 8권 = seed 원천 + 테스트 픽스처 (ADR-001)
lib/supabase/                     # client.ts(브라우저) server.ts(서버) admin.ts(service role, server-only) proxy.ts(updateSession)
lib/data/                         # DB 접근 (Supabase 호출은 여기만), 행→화면 타입 변환. products.ts는 DB, 나머지(RPC 래퍼)는 BE
lib/auth/guards.ts                # getCurrentMember, requireMember, requireKeeper
lib/payments/toss.ts              # 토스 confirm/cancel (server-only)
lib/http/result.ts                # ActionResult, ErrorCode
lib/crypto.ts                     # randomInt 주입원
lib/utils.ts                      # shadcn 관례, shared/utils/cn 재수출 (기존)
shared/utils/                     # formatPrice, cn (기존)
supabase/migrations/, supabase/seed.sql, supabase/config.toml
scripts/gen-seed.mjs              # data/products.ts → supabase/seed.sql
proxy.ts                          # 루트, Next 16 (구 middleware)
```
- 삭제(구조 정리 전용 커밋 TKT-FE-00): `domains/boards|categories|files/`, `shared/mocks/mockData.ts`, `src/`, `public/`의 create-next-app 기본 SVG.
- 하위 스킬 문서의 `lib/domain/`은 이 저장소에서 `domains/`다.

## 2. 의존 방향
```
app ─→ components ─→ domains, types, shared
app ─→ lib/auth, lib/payments, lib/data ─→ lib/supabase
lib/* ─→ domains, types, shared
domains ─→ types, shared (그 외 import 0)
```
- 순환 참조 금지. `components/`는 `lib/data`·`lib/supabase`를 import하지 않는다(데이터는 props로).
- `'use client'` 파일은 `lib/supabase/client.ts` 외의 `lib/*`를 import하지 않는다.

## 3. 코딩 컨벤션
| ID | 규칙 |
|---|---|
| CONV-01 | 파일: 컴포넌트 `PascalCase.tsx`, 그 밖 `kebab-case.ts`, 타입 파일 `<n>.types.ts`, 스키마 `<d>.schema.ts`, 테스트 `<n>.test.ts`(같은 폴더) |
| CONV-02 | 이름: 컴포넌트·타입 PascalCase, 함수·변수 camelCase, DB snake_case(복수형 테이블), enum 값 snake_case 문자열 |
| CONV-03 | Server Component가 기본. `'use client'`는 상호작용 말단(테마 선택, 수량 조절, 편지지, 결제창 호출, 코드 입력, 애니메이션)에만 |
| CONV-04 | 내부 이동은 `next/link`의 `<Link>`만(KANT-C13, NFR-14). `<a href="/…">`·`window.location` 금지. 결제창·OAuth 외부 이동만 예외 |
| CONV-05 | 데이터 쓰기는 Server Action/Route Handler → `lib/data`만. 브라우저에서 Supabase 쓰기 0(로그인 호출 제외) |
| CONV-06 | 표지: `next/image` + 부모 `relative aspect-[3/4] overflow-hidden` + `fill className="object-cover"`, `onError` 시 `/covers/fallback.svg`(KANT-C10, AC-04-2) |
| CONV-07 | Cache Components: `cookies()`·세션을 읽는 컴포넌트는 `<Suspense>` 안. 공개 상품 조회는 `'use cache'` + `cacheTag('products')`, 책 저장 후 `updateTag('products')` |
| CONV-08 | 목록 격자: `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6`(NFR-02), 카드 높이 균일(`flex flex-col h-full`) |
| CONV-09 | `.map()` 렌더링 `key`는 도메인 id(`product.id`, `round.id`). 배열 인덱스 금지 |
| CONV-10 | 화면 문구는 PM-AC/PM-DOMAIN 문장 그대로, 상태 문구는 `domains/*/…-copy.ts` 상수 1곳 |
| CONV-11 | 애니메이션은 `motion-safe:`/`prefers-reduced-motion` 분기 필수(NFR-10, AC-11-7) |
| CONV-12 | SQL 함수: `security definer` + `set search_path = ''` + 첫 줄 `auth.uid()`/`is_keeper()` 검사, 테이블은 스키마 접두(`public.`) |
| CONV-13 | 디자인 토큰·화면 시안은 UX-DESIGN·UX-PLAN-FE를 따른다(색·폰트는 설계 범위 밖) |
| CONV-14 | 같은 일을 하는 패키지는 하나: 아이콘 `lucide-react`, 클래스 병합 `shared/utils/cn`, 검증 `zod` |
| CONV-15 | 커밋: 기능 변경과 구조 정리(이동·삭제·이름 변경)를 섞지 않는다. 메시지 `<type>(<scope>): 한국어 요약 (TKT-…)` |

## 4. 금지 패턴 (GATE-06에서 grep)
1. `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error` 등 타입 우회
2. 빈 `catch {}`, 에러를 삼키고 성공 반환
3. 사용자 확인 없는 패키지 추가·코어(next/react/supabase) 버전 변경
4. `SUPABASE_SERVICE_ROLE_KEY`·`TOSS_SECRET_KEY`·`NAVER_CLIENT_SECRET`을 `NEXT_PUBLIC_`나 `'use client'` 파일에서 사용. 비밀키 모듈은 첫 줄 `import 'server-only'`
5. 클라이언트가 보낸 금액·결제 결과를 서버 검증 없이 신뢰
6. 주석 처리된 옛 코드, 쓰지 않는 파일
7. 기능 변경과 구조 리팩토링을 한 커밋에
8. `domains/**`에서 `new Date()`, `Date.now()`, `Math.random()`, `crypto`, `fetch(`, `supabase`
9. 테이블을 RLS 없이 만들기, `service_role`로 회원 데이터를 읽어 회원에게 응답(엽서 서명 URL 발급 제외)

## 5. 환경·저장소 파일
- `.gitignore`: 기존 목록 유지 + `!.env.example` 추가, `/supabase/.temp/`, `/supabase/.branches/` 추가(KANT-C16). `/uploads`는 사용처가 없으면 TKT-FE-00에서 줄 삭제.
- `.env.example`: ADR-005 표의 변수 이름 + 한 줄 용도. 값 없음.
- `next.config.ts`: 기존 설정 유지 + `images.remotePatterns`(AR-DB §6).
