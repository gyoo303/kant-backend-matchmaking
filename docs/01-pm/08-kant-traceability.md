# 08. KANT 추적 매트릭스 (PM-KANT)

- 입력: IN-KANT, PM-US, PM-AC, PM-SCR. ARCH가 `Architect로 이관` 행을 갱신한다.
- 상태: `정의됨` = PM 산출물로 충족 / `Architect로 이관` = PM은 기준(AC·NFR)만 정의, 증빙은 하위 단계

## 1. 요구사항 (R)

| KANT | 내용 | 담당 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| R1 | 기획·범위 정의, 3페이지 구성 | PM | US-01~03, SCR-01~03 | PM-DOMAIN §1, PM-SCOPE, PM-SCR §3 | 정의됨 |
| R2 | Next.js(App Router)+TS+Tailwind 생성·구동 | ARCH → FE | US-20, AC-20-1, NFR-04 | package.json, 실행 캡처, 초기 커밋 | Architect로 이관 (스택 확정·프로젝트 생성) |
| R3 | 상품 interface + Mock 6개+ | PM(속성) → ARCH → DB/FE | PM-DOMAIN §4, NFR-14 | types/product.ts, data/products.ts | Architect로 이관 (→A-03 Mock 역할) |
| R4 | Header/Footer/ProductCard 분리, Props | PM(요소) → ARCH → FE | PM-SCR §2 | components/ | Architect로 이관 (컴포넌트 구조) |
| R5 | 목록 .map() 렌더링 | FE | US-02, AC-02-1, SCR-02 | app/products/page.tsx | Architect로 이관 (구현) |
| R6 | [id] 동적 라우팅 상세 | FE | US-03, AC-03-1, SCR-03 | app/products/[id]/page.tsx | Architect로 이관 (구현) |
| R7 | `<Link>` 클라이언트 이동 | FE | AC-01-2, AC-02-4, SCR-02·03 | 화면 전환 동작 | Architect로 이관 (구현) |
| R8 | Tailwind 그리드/플렉스·여백·이미지 비율 | FE | US-04, NFR-02, NFR-03 | 스크린샷, 클래스명 | Architect로 이관 (구현) |
| R9 | 없는 ID 방어, .gitignore | FE, ARCH | AC-03-3, NFR-05, NFR-13 | 예외 분기 코드, 저장소 목록 | Architect로 이관 (구현·저장소 설정) |
| R10 | README·시연 | PM(흐름 초안) → FE/QA | US-20, AC-20-2, PM-SCR §5 | README.md, 시연 | Architect로 이관 (README는 M5) |

## 2. 역할별 체크리스트 (C)

| KANT | 내용 | 담당 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| C1 | 콘셉트·대상 정의 | PM | PM-DOMAIN §1·§2 | PM-DOMAIN | 정의됨 |
| C2 | 3페이지 필수 시각 요소 | PM | SCR-01~03 필수 시각 요소 목록 | PM-SCR §3 | 정의됨 |
| C3 | 범위 통제 | PM | PM-SCOPE §2·§3, D-001, D-016 | PM-SCOPE, PM-DEC | 정의됨 |
| C4 | Next.js·TS·Tailwind 옵션 | ARCH | NFR-04 | package.json, 설정 파일 | Architect로 이관 |
| C5 | 상품 필수 속성 interface | PM(속성) → ARCH | PM-DOMAIN §4 | types/product.ts | Architect로 이관 (타입 정의) |
| C6 | Mock 6개+ 유효 이미지 | ARCH → DB/FE | NFR-14 | data/products.ts | Architect로 이관 (→A-03) |
| C7 | Header·Footer 분리 | FE | PM-SCR §2 | components/Header, Footer | Architect로 이관 |
| C8 | ProductCard Props | FE | PM-SCR §2, AC-02-1 | components/ProductCard | Architect로 이관 |
| C9 | Flex/Grid 균일 간격 | FE | NFR-03 | 클래스명, 스크린샷 | Architect로 이관 |
| C10 | object-cover 이미지 비율 | FE | NFR-02, AC-04-2 | 클래스명, 스크린샷 | Architect로 이관 |
| C11 | products/page.tsx .map() | FE | AC-02-1 | app/products/page.tsx | Architect로 이관 |
| C12 | [id] params | FE | AC-03-1, AC-03-3 | app/products/[id]/page.tsx | Architect로 이관 |
| C13 | `<Link>` 사용 | FE | AC-01-2, AC-02-4 | 코드 | Architect로 이관 |
| C14 | 잘못된 ID 안내 | FE | AC-03-3, NFR-05 | 예외 화면 | Architect로 이관 |
| C15 | `npm run build` 성공 | QA | NFR-04 | 빌드 로그 | Architect로 이관 (품질 게이트) |
| C16 | .gitignore | ARCH | NFR-13 | .gitignore | Architect로 이관 |
| C17 | README 구성 | FE/QA | AC-20-2 | README.md | Architect로 이관 (M5) |
| C18 | 시연·발표 흐름 | PM(초안) → QA | PM-SCR §5, US-20 | 시연 | Architect로 이관 (리허설은 M5) |

빈 행: 0 (R 10개, C 18개 모두 매핑)
