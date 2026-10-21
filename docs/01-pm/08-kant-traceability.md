# 08. KANT 추적 매트릭스 (PM-KANT)

- 입력: IN-KANT, PM-US, PM-AC, PM-SCR, PM-SCOPE
- 상태: `정의됨`(PM이 직접 충족) / `Architect로 이관`(PM이 기준을 정의했고 구현·증빙은 하위 단계)
- ARCH는 `Architect로 이관` 행의 담당·증빙 열을 갱신한다(PIPELINE §3.2).
- IN-KANT 원본과 PM 스킬 §3 표의 차이: 없음.

## 1. 요구사항 (R)
| KANT | 내용 | 담당 | 연결 US / AC / SCR / NFR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| R1 | 기획·범위 정의, 3페이지 구성 요소 | PM | US-01~03, SCR-01~03 와이어프레임 | PM-DOMAIN §1, PM-SCOPE, PM-SCR §3 | 정의됨 |
| R2 | Next.js(App Router)+TS+Tailwind 생성·로컬 구동 | ARCH → FE | US-21, AC-21-2, REQ-T02 | package.json, 실행 캡처, 초기 커밋 | Architect로 이관 |
| R3 | TS 상품 interface + Mock 6개 이상 | ARCH → DB/FE | PM-DOMAIN §4, NFR-16, REQ-T06, →ARCH A-03 | `types/product.ts`, `data/products.ts` | Architect로 이관 |
| R4 | Header·Footer·ProductCard 분리, Props | ARCH → FE | PM-SCR §2, AC-01-1, AC-02-1 | `components/` | Architect로 이관 |
| R5 | 목록 .map() 렌더링 | FE | US-02, AC-02-1, SCR-02 | `app/products/page.tsx` | Architect로 이관 |
| R6 | [id] 동적 라우팅 상세 | FE | US-03, AC-03-1, SCR-03 | `app/products/[id]/page.tsx` | Architect로 이관 |
| R7 | `<Link>` 클라이언트 네비게이션 | FE | AC-01-2, AC-02-2, NFR-14 | 화면 전환 동작 | Architect로 이관 |
| R8 | Tailwind 그리드/플렉스, 여백, 이미지 비율 | FE | US-04, NFR-02, NFR-03 | 스크린샷, 클래스명 | Architect로 이관 |
| R9 | 없는 ID 방어, .gitignore | FE, QA | AC-03-4, SCR-04, NFR-05, NFR-15 | 예외 분기 코드, 저장소 파일 목록 | Architect로 이관 |
| R10 | README, 시연 발표 | FE(README), 팀(발표) | US-21, AC-21-1, PM-SCR §5 시연 흐름 | README.md, 4일차 시연 | Architect로 이관 |

## 2. 역할별 체크리스트 (C)
| KANT | 내용 | 담당 | 연결 | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|
| C1 | 콘셉트·대상 정의 | PM | PM-DOMAIN §1·§2 | PM-DOMAIN | 정의됨 |
| C2 | 3페이지 필수 시각 요소 사전 정리 | PM | SCR-01~03 "필수 시각 요소" | PM-SCR §3 | 정의됨 |
| C3 | 범위 통제(일정 차질 없음) | PM | PM-SCOPE §3·§4, D-001, D-016 | PM-SCOPE | 정의됨 |
| C4 | Next.js·TS·Tailwind 옵션 | ARCH | REQ-T02 | package.json, tsconfig, Tailwind 설정 | Architect로 이관 |
| C5 | 상품 필수 속성 interface | ARCH → DB | PM-DOMAIN §4 (ID·이름·가격·이미지 URL·설명 + 도메인 속성), INV-01 | `types/product.ts` | Architect로 이관 |
| C6 | Mock 6개+ 유효 이미지 | DB/FE | NFR-16, →ARCH A-03 | `data/products.ts` | Architect로 이관 |
| C7 | Header·Footer 분리 | FE | PM-SCR §2 | `components/` | Architect로 이관 |
| C8 | ProductCard Props | FE | PM-SCR §2, AC-02-1 | `components/` | Architect로 이관 |
| C9 | Flex·Grid 균일 간격 | FE | NFR-02 | 스크린샷 | Architect로 이관 |
| C10 | object-cover 이미지 비율 | FE | NFR-03, AC-04-2 | 스크린샷, 클래스명 | Architect로 이관 |
| C11 | products/page.tsx .map() | FE | AC-02-1 | `app/products/page.tsx` | Architect로 이관 |
| C12 | [id] params | FE | AC-03-1 | `app/products/[id]/page.tsx` | Architect로 이관 |
| C13 | `<Link>` 사용 | FE | NFR-14 | 코드 | Architect로 이관 |
| C14 | 잘못된 ID 안내 문구 | FE | AC-03-4, NFR-05, SCR-04 | 화면, 코드 | Architect로 이관 |
| C15 | `npm run build` 성공 | 전 단계, QA 확인 | NFR-04, AC-21-3 | 빌드 로그 | Architect로 이관 |
| C16 | .gitignore | ARCH, QA 확인 | NFR-15 | 저장소 파일 목록 | Architect로 이관 |
| C17 | README(소개·컴포넌트 트리·실행 명령·캡처) | FE | AC-21-1 | README.md | Architect로 이관 |
| C18 | 시연·발표 흐름 | PM(초안) → 팀 | PM-SCR §5 | 시연 | Architect로 이관 |

## 3. 이관 이유
- R2~R10, C4~C18은 코드·저장소·실행 결과로만 증빙된다. PM은 기준(AC·NFR·SCR)을 정의했고, 경로·구현 방식은 Architect가 기존 저장소 구조(REQ-T05)와 맞춰 정한다(→ARCH A-03, A-09).
- C18은 PM이 시연 흐름 초안을 냈고, 최종 발표는 M5에서 팀이 리허설한다.

빈 행: 0 (R 10행 + C 18행 = 28행 모두 담당·연결·증빙·상태 있음).
