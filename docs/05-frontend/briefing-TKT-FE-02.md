---
stage: FE
tickets: [TKT-FE-02]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [메인·테마 서가] TKT-FE-02 `/`, `/products`
결론: 수용 기준 9개 중 8개 충족, 1개(AC-02-4 빈 테마)는 코드·단위 확인만 · 실제 API(Supabase) 기준

## 사람이 결정할 것
- 없음

## 이해 가이드
- 메인: `app/page.tsx`가 `getNewArrivals()`(API-03, `'use cache'`)를 부른다. 실패하면 `null`로 바꿔 "새로 들어온 책" 영역만 안내한다(AC-01-4). 소개·테마 서가는 데이터를 쓰지 않아 늘 보인다.
- 목록: `app/products/page.tsx` → `<Suspense>` 안의 `ThemeShelf`가 `searchParams.theme` → `parseTheme()`(잘못된 값은 `undefined`) → `getProducts(theme)` → `ProductGrid`가 `.map(p => <ProductCard key={p.id} />)`. 실패·빈 테마·정상 세 갈래는 `ProductList`에서 나눈다.
- 테마 바꾸기는 `<Link href="/products?theme=…">`라 전체 새로고침이 없고, 주소에 남아 뒤로 가기가 된다(AC-02-2).
- 먼저 읽을 파일: `domains/products/theme.ts` — `parseTheme`·테마 소개·상태 문구 / `app/products/page.tsx` — 목록 상태 분기 / `components/ThemeSelector.tsx` — 알약(목록)·서가 칸(메인)

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-01-1 | Header·소개·테마 4칸·새로 들어온 책 ≥1·Footer, Header에 "편지 띄우기" | 충족 | `SCR-01-main-{1280,360}.png`, 새 책 카드 4개(재고 0인 4번 책 제외 확인) |
| AC-01-2 | 테마 칸 "생태" → 새로고침 없이 생태 목록 | 충족 | 서가 칸이 `<Link href="/products?theme=ecology">` (NFR-14) |
| AC-01-4 | 조회 실패 시 소개·테마는 보이고 새 책 영역에 "책을 불러오지 못했어요" | 충족 | env를 비운 서버 `AC-21-4-env-missing-main-*.png` |
| AC-02-1 | 책 6권 이상 전부 카드, 표지·제목·저자·가격·테마 | 충족 | `SCR-02-products-*.png` 카드 8개 |
| AC-02-2 | "식문화" → 식문화만, 주소에 남음, 뒤로 가기 | 충족 | `SCR-02-products-food-*.png` 카드 2개, 알약 current=식문화 |
| AC-02-3 | 재고 0 → "품절" | 충족 | 같은 스크린샷의 "제철 밥상 일기" (표지 55% + 품절 배지) |
| AC-02-4 | 빈 테마 → "이 서가는 아직 비어 있어요" + 다른 테마 링크 | 코드만 | 원격 DB의 4개 테마 모두 책이 있어 화면으로 보지 못했다(공용 DB를 바꾸지 않음). `ProductList`의 `products.length === 0` 분기 |
| AC-02-5 | `?theme=abc` → 오류 없이 전체 | 충족 | 단위 테스트 `AC-02-5: 잘못된 값 abc는…` 외 3개, `SCR-02-products-abc-1280.png` 카드 8개 |
| NFR-02 | 360·768·1280 가로 스크롤 0, 2·3·4열 | 충족 | 세 폭에서 `scrollWidth = 폭`, 격자 열 수 2/3/4 (computed style) |
| UX-4 | 1280 첫 화면에 소개 제목·글·창가 그림, 360 첫 화면에 제목·글 첫 줄 | 충족 | `SCR-01-main-*.png` 위쪽 |
| UX-5·19 | 할인·순위·별점·느낌표·이모지 0 | 충족 | 변경 파일 문구 검색 0건 |
| UX-11 | 기본 버튼 1개 이하 | 충족 | 메인은 [편지 띄우기] 1개, 목록은 0개 |
| UX-14 | 실패 안내 아래 다음 행동 링크 1개 | 충족 | 메인 "테마 서가 둘러보기", 목록 "메인으로 가기" |

## 선택과 이유
- 목록은 주소의 테마를 읽는 부분만 `<Suspense>`에 넣었다. Cache Components에서 `searchParams`는 요청 때만 알 수 있어서다(CONV-07). 제목 "테마 서가"는 바로 보인다.
- 테마가 바뀌면 격자에 `key={theme}`를 주어 카드 묶음 전체가 한 번에 300ms 페이드한다(design-system §7, NFR-10). `motion-safe:`라 동작 줄이기면 바로 보인다.
- 테마 한 줄 소개·상태 문구는 `domains/products/theme.ts` 한 곳(CONV-10). 소개 문구는 시안의 `[제안]` 문구 그대로다.
- 창가 그림은 `components/WindowArt.tsx`(상태 5개: hero·arrived·reading·shipped·empty)로 만들었다. M4의 `WindowScene`이 이 그림을 쓰도록 미리 상태를 넣었다.
- 템플릿 잔재 `public/next.svg`·`vercel.svg` 삭제(TKT-FE-00 브리핑에서 이 티켓으로 넘긴 것).

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 메인은 사전 렌더링(revalidate 15분)이라, 빌드 때 DB 조회가 실패하면 실패 안내가 캐시될 수 있다 | `getNewArrivals`는 실패를 캐시하지 않음(던짐) | 배포 환경에 env가 있는지 QA-M5에서 확인 |
| 촛불 흔들림(UX-17)이 아직 없다 | 정지 그림 | 키프레임 토큰이 필요해 TKT-FE-M4-01에서 넣는다 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 (이번에 추가: `domains/products/theme.test.ts` 6개) / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄 / UX-1 일러스트 밖 0건
- 스크린샷: `docs/05-frontend/screenshots/SCR-01-main-{1280,360}.png`, `SCR-02-products-{1280,360}.png`, `SCR-02-products-food-{1280,360}.png`, `SCR-02-products-abc-1280.png` (768px는 열 수·가로 스크롤만 측정)
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- 테마 알약의 선택 표시: 시안·design-system은 `aria-pressed="true"`지만, 알약이 주소를 바꾸는 링크라 `aria-current="true"`를 썼다(`aria-pressed`는 버튼 역할에만 맞다). 모양(`--primary` 바탕)은 같다.
- 명세에 없는 문구: 로딩 중 "책을 꺼내 오는 중이에요.", 목록 실패 시 "메인으로 가기", 메인 실패 시 "테마 서가 둘러보기", 빈 테마 "다른 서가를 둘러보세요."(시안 문구), 전체 소개 "네 개의 서가에 꽂힌 책을 모두 보여드려요."(시안 문구)
- 메인 소개 제목·글, 편지 안내 띠 문구는 시안 `[제안]` 그대로다.

## 기록 필요
- 테마 알약 `aria-current` 선택(위). UX가 결정 기록에 옮길지 판단한다.

## 변경 범위
- 수정: `app/page.tsx` / 추가: `app/products/page.tsx`, `domains/products/theme.ts`·`theme.test.ts`, `components/ThemeSelector.tsx`, `ProductGrid.tsx`, `WindowArt.tsx`, 이 브리핑, 스크린샷 / 삭제: `public/next.svg`, `public/vercel.svg`
- `domains/products/theme.ts`는 HANDOFF가 이 티켓에 준 파일이다
- 새 의존성 없음

## 확인하지 못한 것
- AC-02-4 빈 테마 화면(데이터 없음)
- 뒤로 가기 동작은 브라우저에서 눌러 보지 않았다(주소 기반이라 브라우저 기본 동작)
- NFR-01 Lighthouse LCP·CLS 측정
