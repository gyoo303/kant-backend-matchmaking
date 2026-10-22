---
stage: FE
tickets: [TKT-FE-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, DB-BRIEF, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE]
next_readers: [QA, UX]
---
# [공통 틀] TKT-FE-01 Header·Footer·ProductCard·레이아웃
결론: 완료 조건 4개(AC-01-3, AC-04-2, KANT-R3·R4·C7·C8) 모두 충족 + AC-21-4 충족 · 실제 API(Supabase) 기준

## 사람이 결정할 것
- 없음

## 이해 가이드
- 데이터 흐름: `app/layout.tsx`가 `<Header>`·`<Footer>`로 모든 화면을 감싼다. Header 오른쪽 메뉴만 세션(쿠키)을 읽으므로 layout 안의 `SessionAccountNav`가 `<Suspense>` 안에서 `getCurrentMember()`·`getCartCount()`를 불러 `AccountNav`에 props로 넘긴다. 이 조회가 실패하면 서버 로그(`[Header]`)만 남기고 비회원 메뉴로 보인다.
- 환경 변수 누락(AC-21-4): layout이 `NEXT_PUBLIC_SUPABASE_URL`·`…_PUBLISHABLE_KEY`를 직접 확인해 `ConfigNotice`(맨 위 `role="alert"`)를 띄우고 세션 조회를 건너뛴다. 책 조회 실패는 각 화면이 영역 안에서 안내한다(TKT-FE-02·03).
- 먼저 읽을 파일: `app/layout.tsx` — 공통 틀·세션·env 안내 / `components/Header.tsx` — 메뉴 구성(비회원·회원·책방지기) / `components/BookCover.tsx` — 표지 3:4 + 깨지면 대체 표지

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| KANT-R3·C5 | `types/product.ts` 고정 타입 | 충족 | DB 단계에서 AR-API §1.1 그대로 만든 파일을 확인, 변경 없음 |
| KANT-R4·C7 | `app/layout.tsx`에 Header·Footer | 충족 | 모든 스크린샷 상·하단 |
| KANT-C8 | `ProductCard({ product, href? })` | 충족 | `components/ProductCard.tsx`, href 기본값 `/products/${id}` |
| AC-01-3 | Footer에 책방 이름, 사업자 정보·환불·개인정보 영역 없음 | 충족 | `screenshots/SCR-01-main-1280.png` 하단 |
| AC-04-2 | 깨진 표지 → 같은 비율 대체 표지 | 충족 | 이미지 요청을 막고 찍은 `AC-04-2-fallback-products-{1280,360}.png`, `AC-04-2-fallback-product-*.png` (대체 표지 8/8, 비율 1.333) |
| AC-21-4 | env 누락 시 멈추지 않고 필요한 값 안내 | 충족 | env를 비운 dev 서버로 찍은 `AC-21-4-env-missing-{main,products}-*.png` |
| UX-2 | 360px Header 2줄, 햄버거 없음, 가로 스크롤 0 | 충족 | `SCR-01-main-360.png`, 1280·768·360 모두 `scrollWidth = 폭` |
| UX-3 | 현재 메뉴 `aria-current="page"` + `--secondary` 바탕 | 충족 | `/products`에서 "테마 서가" current 확인(DOM), `SCR-02-products-1280.png` |
| UX-16 | 3px 포커스 링 | 부분 | `:focus-visible` 3px outline 기본 스타일 추가. shadcn `Button`은 자체 `ring-3 ring-ring/50`을 쓴다. 키보드 순회 스크린샷은 찍지 못함 |

## 선택과 이유
- Header를 서버 컴포넌트로 두고 세션 부분만 `account` 슬롯으로 받는다: `components/`가 `lib/data`를 import하지 않게(AR-CONV §2) 하면서, 세션을 읽는 부분만 `<Suspense>`에 넣기 위해서다(CONV-07).
- 세션 로딩 중에는 [장바구니]만 보이고 [로그인]/[마이페이지] 자리는 비워 둔다. 회원에게 [로그인]이 잠깐 보였다 바뀌는 것을 막기 위해서다.
- 메뉴 현재 표시(`usePathname`)는 `components/NavLinks.tsx`(client)에만 둔다. Cache Components에서 동적 주소(`/products/[id]`)는 `usePathname`이 사전 렌더링 중에 멈추므로 같은 모양의 `StaticNavLinks`를 fallback으로 둔다(`node_modules/next/dist/docs/.../use-pathname.md` "Cache Components").
- 테마 배지·품절 배지는 `components/BookBadges.tsx`로 모았다. 목록 카드와 상세(TKT-FE-03)가 같이 쓴다.
- 글꼴 `preload: false`: Gowun 글꼴은 한글 unicode-range 조각이 많아 preload를 켜면 모든 화면에서 woff2 47개를 미리 받는다. 끄면 화면에 나온 글자의 조각만 받는다(NFR-01). 대신 첫 렌더에서 글꼴이 늦게 바뀔 수 있다(`display: swap`).
- `next.config.ts`에 `images.remotePatterns`(AR-DB §6) 추가: `*.supabase.co/storage/v1/object/public/book-covers/**`, `picsum.photos`. DB 브리핑이 이 티켓으로 넘긴 항목이다.
- 본문 줄바꿈: `body`에 `break-keep wrap-break-word`. 한글이 단어 중간에서 끊기지 않고, 긴 영문·주소는 넘치지 않게 한다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 회원·책방지기 Header(마이페이지·개수·[서재])를 실제 로그인으로 보지 못함 | 메뉴 구성은 `accountMenu()` 한 곳에서 정함 | `/login`(TKT-FE-M2-01) 이후 QA·UX가 확인 |
| 관리자 화면에도 회원 Header가 붙음 | — | TKT-FE-M2-01에서 `/admin` 레이아웃을 만들 때 정한다(관리자 바와 겹치는지) |
| 세션 조회 실패 시 회원도 비회원 메뉴로 보임 | 서버 로그 `[Header]` | 실패가 잦으면 안내 문구 검토 |

## 검증 결과
- GATE-01 `npx tsc --noEmit`: 오류 0 / GATE-02 `npm run lint`: 오류 0 / GATE-03 `npm test`: tests 76, pass 76, fail 0 / GATE-04 `npm run build`: 종료 0
- GATE-05: `.env` 추적 0줄, `NEXT_PUBLIC_…SECRET|SERVICE_ROLE` 0줄 / GATE-06: 금지 패턴 0줄, `'use client'` 파일의 `@/lib` import 0줄
- UX-1(토큰 밖 색·임의값·인라인 style): 일러스트 파일(`FallbackCover.tsx`, `WindowArt.tsx`) 밖 0건
- 스크린샷: `docs/05-frontend/screenshots/` (위 표). 프로덕션 빌드(`next start`)를 headless Chrome으로 찍었다
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- 대체 표지: CONV-06은 `onError` 시 `/covers/fallback.svg` 한 장이지만, 승인된 디자인 결정 UX-D-10(테마 바탕·무늬·제목, "공통 대체 이미지" 금지)을 따라 `components/FallbackCover.tsx`로 그렸다. `public/covers/fallback.svg`는 만들지 않았다.
- 명세에 없는 문구: `ConfigNotice`("사이트 설정 값이 비어 있어 책 정보를 불러올 수 없어요." + 필요한 변수 이름). AC-21-4가 "필요한 값 안내"만 정했다.
- 디자인 토큰 반영은 사용자 승인(2026-10-22)으로 이 티켓 앞의 별도 커밋 `a2c6782`(globals.css·layout 글꼴)로 했다(UX-PLAN-FE README §4-1).

## 기록 필요
- 글꼴 preload를 끈 판단(위 "선택과 이유"). 디자인 결정은 아니지만 글꼴 로딩 방식이 바뀌므로 UX가 알아야 한다.

## 변경 범위
- 수정: `app/layout.tsx`, `next.config.ts`(공통 설정 — 표지 주소 허용만 추가)
- 추가: `components/Header.tsx`, `NavLinks.tsx`, `Footer.tsx`, `ProductCard.tsx`, `BookCover.tsx`, `FallbackCover.tsx`, `BookBadges.tsx`, `ConfigNotice.tsx`, 이 브리핑, 스크린샷(AC-04-2·AC-21-4)
- `types/product.ts`: 확인만, 변경 없음 / `components/ui/*`: 변경 없음
- 새 의존성 없음

## 확인하지 못한 것
- 회원·책방지기 상태의 Header (로그인 화면 없음)
- 키보드 Tab 순회 스크린샷(UX-16), 스크린 리더
- 실제 기기(iOS Safari·삼성 인터넷, NFR-12)
