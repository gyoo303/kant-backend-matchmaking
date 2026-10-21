# 08. KANT 추적 매트릭스 (PM-KANT)

- 입력: IN-KANT, PM-US, PM-AC, PM-SCR, PM-SCOPE
- 상태: `정의됨`(PM이 직접 충족) / `Architect로 이관`(PM이 기준을 정의했고 구현·증빙은 하위 단계)
- ARCH는 `Architect로 이관` 행의 담당·증빙 열을 갱신한다(PIPELINE §3.2). 갱신: 2026-10-21, 상태 `설계 완료(TKT)` = 설계 증빙 확정, 구현 증빙은 해당 티켓.
- IN-KANT 원본과 PM 스킬 §3 표의 차이: 없음.

## 1. 요구사항 (R)
| KANT | 내용 | 담당 | 연결 US / AC / SCR / NFR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| R1 | 기획·범위 정의, 3페이지 구성 요소 | PM | US-01~03, SCR-01~03 와이어프레임 | PM-DOMAIN §1, PM-SCOPE, PM-SCR §3 | 정의됨 |
| R2 | Next.js(App Router)+TS+Tailwind 생성·로컬 구동 | ARCH → FE | US-21, AC-21-2, REQ-T02 | package.json, 실행 캡처, 초기 커밋 · 설계: `package.json`(Next 16.4.2·TS·Tailwind 4, `src/` 없음) — 02 §2, CONV-01 | 설계 완료(TKT-FE-00) |
| R3 | TS 상품 interface + Mock 6개 이상 | ARCH → DB/FE | PM-DOMAIN §4, NFR-16, REQ-T06, →ARCH A-03 | `types/product.ts`, `data/products.ts` · 설계: `types/product.ts`(04 §1.1), `data/products.ts` 8권 = seed+픽스처(ADR-001, 03 §8) | 설계 완료(TKT-DB-01, TKT-FE-01) |
| R4 | Header·Footer·ProductCard 분리, Props | ARCH → FE | PM-SCR §2, AC-01-1, AC-02-1 | `components/` · 설계: `components/Header·Footer·ProductCard.tsx`, `app/layout.tsx`(05 §1), Props 04 §4.1 | 설계 완료(TKT-FE-01) |
| R5 | 목록 .map() 렌더링 | FE | US-02, AC-02-1, SCR-02 | `app/products/page.tsx` · 설계: `app/products/page.tsx` `getProducts`→`.map()`(04 §4, CONV-09) | 설계 완료(TKT-FE-02) |
| R6 | [id] 동적 라우팅 상세 | FE | US-03, AC-03-1, SCR-03 | `app/products/[id]/page.tsx` · 설계: `app/products/[id]/page.tsx` `await params`(04 §4) | 설계 완료(TKT-FE-03) |
| R7 | `<Link>` 클라이언트 네비게이션 | FE | AC-01-2, AC-02-2, NFR-14 | 화면 전환 동작 · 설계: CONV-04 `<Link>`만, GATE-06 | 설계 완료(TKT-FE-01~03) |
| R8 | Tailwind 그리드/플렉스, 여백, 이미지 비율 | FE | US-04, NFR-02, NFR-03 | 스크린샷, 클래스명 · 설계: CONV-06·08 격자·3:4 `object-cover` | 설계 완료(TKT-FE-01·02) |
| R9 | 없는 ID 방어, .gitignore | FE, QA | AC-03-4, SCR-04, NFR-05, NFR-15 | 예외 분기 코드, 저장소 파일 목록 · 설계: `notFound()`+`not-found.tsx`(04 §4), `.gitignore`(05 §5, GATE-05) | 설계 완료(TKT-FE-03, TKT-FE-00) |
| R10 | README, 시연 발표 | FE(README), 팀(발표) | US-21, AC-21-1, PM-SCR §5 시연 흐름 | README.md, 4일차 시연 · 설계: README 목차(HANDOFF §M5) | 설계 완료(TKT-FE-M5-01) |

## 2. 역할별 체크리스트 (C)
| KANT | 내용 | 담당 | 연결 | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| C1 | 콘셉트·대상 정의 | PM | PM-DOMAIN §1·§2 | PM-DOMAIN | 정의됨 |
| C2 | 3페이지 필수 시각 요소 사전 정리 | PM | SCR-01~03 "필수 시각 요소" | PM-SCR §3 | 정의됨 |
| C3 | 범위 통제(일정 차질 없음) | PM | PM-SCOPE §3·§4, D-001, D-016 | PM-SCOPE | 정의됨 |
| C4 | Next.js·TS·Tailwind 옵션 | ARCH | REQ-T02 | package.json, tsconfig, Tailwind 설정 · 설계: 02 §2 스택표, `tsconfig`(strict, `@/*`) | 설계 완료(TKT-FE-00) |
| C5 | 상품 필수 속성 interface | ARCH → DB | PM-DOMAIN §4 (ID·이름·가격·이미지 URL·설명 + 도메인 속성), INV-01 | `types/product.ts` · 설계: `Product` 필수 5속성 + 도메인 속성(04 §1.1), `products` DDL(03 §3) | 설계 완료(TKT-FE-01, TKT-DB-01) |
| C6 | Mock 6개+ 유효 이미지 | DB/FE | NFR-16, →ARCH A-03 | `data/products.ts` · 설계: `data/products.ts` 8권, picsum 이미지(03 §8, NFR-16) | 설계 완료(TKT-DB-01) |
| C7 | Header·Footer 분리 | FE | PM-SCR §2 | `components/` · 설계: `app/layout.tsx`에 Header·Footer(05 §1) | 설계 완료(TKT-FE-01) |
| C8 | ProductCard Props | FE | PM-SCR §2, AC-02-1 | `components/` · 설계: `ProductCardProps`(04 §4.1) | 설계 완료(TKT-FE-01) |
| C9 | Flex·Grid 균일 간격 | FE | NFR-02 | 스크린샷 · 설계: CONV-08 | 설계 완료(TKT-FE-02) |
| C10 | object-cover 이미지 비율 | FE | NFR-03, AC-04-2 | 스크린샷, 클래스명 · 설계: CONV-06 | 설계 완료(TKT-FE-01) |
| C11 | products/page.tsx .map() | FE | AC-02-1 | `app/products/page.tsx` · 설계: 04 §4 `/products` | 설계 완료(TKT-FE-02) |
| C12 | [id] params | FE | AC-03-1 | `app/products/[id]/page.tsx` · 설계: 04 §4 `/products/[id]` | 설계 완료(TKT-FE-03) |
| C13 | `<Link>` 사용 | FE | NFR-14 | 코드 · 설계: CONV-04, GATE-06 | 설계 완료(TKT-FE-01~03) |
| C14 | 잘못된 ID 안내 문구 | FE | AC-03-4, NFR-05, SCR-04 | 화면, 코드 · 설계: `not-found.tsx` 문구(04 §4) | 설계 완료(TKT-FE-03) |
| C15 | `npm run build` 성공 | 전 단계, QA 확인 | NFR-04, AC-21-3 | 빌드 로그 · 설계: GATE-04(06 §1) | 설계 완료(전 티켓, TKT-QA-M5) |
| C16 | .gitignore | ARCH, QA 확인 | NFR-15 | 저장소 파일 목록 · 설계: 05 §5, GATE-05 | 설계 완료(TKT-FE-00, TKT-QA-01) |
| C17 | README(소개·컴포넌트 트리·실행 명령·캡처) | FE | AC-21-1 | README.md · 설계: README 목차(HANDOFF §M5) | 설계 완료(TKT-FE-M5-01) |
| C18 | 시연·발표 흐름 | PM(초안) → 팀 | PM-SCR §5 | 시연 · 설계: PM-SCR §5 흐름 그대로, 리허설 | 설계 완료(TKT-QA-M5) |

## 3. 이관 이유
- R2~R10, C4~C18은 코드·저장소·실행 결과로만 증빙된다. PM은 기준(AC·NFR·SCR)을 정의했고, 경로·구현 방식은 Architect가 기존 저장소 구조(REQ-T05)와 맞춰 정한다(→ARCH A-03, A-09).
- C18은 PM이 시연 흐름 초안을 냈고, 최종 발표는 M5에서 팀이 리허설한다.

빈 행: 0 (R 10행 + C 18행 = 28행 모두 담당·연결·증빙·상태 있음).
