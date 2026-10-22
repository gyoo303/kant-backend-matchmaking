---
stage: FE
tickets: [TKT-FE-03]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [상품 상세] TKT-FE-03 `/products/[id]`, `not-found.tsx`
결론: 수용 기준 4개(AC-03-1·2·4·5) 모두 충족 + KANT-R6·R9·C12·C14 · 실제 API(Supabase) 기준

## 사람이 결정할 것
- 없음

## 이해 가이드
- `app/products/[id]/page.tsx` → `<Suspense>` 안 `ProductDetail`이 `await params` → `getProduct(id)`(API-02, uuid가 아니면 DB 조회 없이 null) → null이면 `notFound()` → 같은 폴더 `not-found.tsx`.
- [장바구니 담기]는 `components/AddToCartButton.tsx`(client). 담기 액션 `addToCart`(API-05, BE 구현)는 page가 props로 넘긴다. 비회원이면 액션 안의 `requireMember`가 `/login?next=/products/<id>`로 보낸다.
- 먼저 읽을 파일: `app/products/[id]/page.tsx` — 화면 순서 / `components/KeeperNote.tsx` — 노트 글꼴·크기 / `components/AddToCartButton.tsx` — 담기 상태

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-03-1 | 그 ID의 책 정보, 노트가 다른 본문보다 위 | 충족 | `SCR-03-product-*.png`, 노트 top < h1 top (세 폭) |
| AC-03-2 | 출판사 소개 없으면 영역 없음 | 충족 | 2번 책(`publisherDescription: null`) `<details>` 0개, `SCR-03-product-nopublisher-*.png` |
| AC-03-4 | 없는 ID → 멈추지 않고 "상품을 찾을 수 없습니다" + 목록 링크 | 충족 | `/products/abc`·없는 uuid 둘 다, `SCR-04-not-found-*.png`, `SCR-04-not-found-uuid-*.png` (NFR-05) |
| AC-03-5 | 재고 0 → [장바구니 담기] 비활성 + "품절" | 충족 | 4번 책 `SCR-03-product-soldout-*.png`, button `disabled` |
| UX-6 | 노트 heading 글꼴, 360 20px·768+ 24px, 다른 본문보다 큼 | 충족 | computed: Gowun Batang 20px(360)/24px(768·1280), 설명 16px |
| UX-7 | 360px 표지 폭 ≤200px | 충족 | 200px (768+ 280px), 비율 1.333 |
| UX-8 | 긴 글 max-w-xl, 줄 간격 ≥1.8 | 충족 | 노트 max-width 576px, line-height 2.0 |
| UX-11 | 기본 버튼 1개 | 충족 | [장바구니 담기]만 |
| AC-03-3 | 비회원 [장바구니 담기] → 로그인 → 같은 상세 | 부분 | headless 클릭 결과 `/login?next=%2Fproducts%2F<id>`로 이동 확인. `/login` 화면이 없어(TKT-FE-M2-01) 404 |

## 선택과 이유
- 담기 버튼은 이 티켓 범위가 아니지만(AC-07-1은 TKT-FE-M3-01), BE의 `addToCart`가 이미 있어 실제 액션에 연결했다. 성공 시 "장바구니에 담았어요"(AC-07-1), 재고보다 많이 담으면 액션이 준 "남은 책은 N권이에요"(AC-07-4)를 `role="status"`로, 실패는 `role="alert"`로 버튼 아래에 보인다. 담는 중에는 버튼을 막아 중복 요청을 보내지 않는다.
- `AddToCartButton`은 액션을 props로 받는다. `components`가 `app`을 import하면 의존 방향(app → components)이 뒤집히기 때문이다. `'use client'` 파일이 `lib/*`를 import하지 않도록 결과 타입은 파일 안에 필요한 모양만 적었다(AR-CONV §2).
- 상세 `<title>`은 컴포넌트 안 `<title>`(React 19 메타데이터 호이스팅)로 넣었다. `generateMetadata`는 같은 조회를 한 번 더 부르게 된다.
- "테마 서가로 돌아가기"는 그 책의 테마 목록(`/products?theme=…`)으로 간다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| `notFound()`가 `<Suspense>` 안에서 불려 HTTP 상태가 200일 수 있다 | 화면 문구·링크는 정상 | 검색 노출이 필요하면 `generateStaticParams` 검토 |
| 담기 후 Header 개수 갱신은 회원 로그인이 있어야 확인된다 | 액션이 `refresh()` 호출 | TKT-FE-M3-01·QA-M3에서 확인 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄 / UX-1 일러스트 밖 0건
- 스크린샷: `docs/05-frontend/screenshots/SCR-03-product{,-nopublisher,-soldout}-{1280,360}.png`, `SCR-04-not-found{,-uuid}-{1280,360}.png`
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- 명세에 없는 문구: 로딩 "책을 꺼내 오는 중이에요.", 담는 중 버튼 "담는 중이에요", not-found 안내 "주소를 다시 확인하시거나 테마 서가에서 찾아보세요."(시안 문구)
- 품절 표시: 버튼 글자는 "장바구니 담기" 그대로 두고 비활성, 가격 옆에 "품절" 배지를 더했다(시안에 품절 상세가 없음).

## 기록 필요
- 없음

## 변경 범위
- 추가: `app/products/[id]/page.tsx`, `app/products/[id]/not-found.tsx`, `components/KeeperNote.tsx`, `components/AddToCartButton.tsx`, 이 브리핑, 스크린샷
- 다른 담당 영역 파일 수정 없음(`app/cart/actions.ts`는 import만)
- 새 의존성 없음

## 확인하지 못한 것
- 회원으로 담기 성공·재고 초과 안내·Header 개수 변화(AC-07-1·4) — 로그인 화면 이후
- `/login` 이후 같은 상세로 돌아오는 나머지 절반(AC-03-3)
- 출판사 소개 `<details>` 펼침을 키보드로 눌러 보기
