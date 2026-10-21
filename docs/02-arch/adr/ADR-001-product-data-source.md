# ADR-001: 상품 데이터 원천과 KANT Mock(`data/products.ts`)의 관계
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [레이어] [모듈 협력 구조]
- 근거: DRV-C-01, DRV-C-03, KANT-R3·C6·R10, NFR-16, AC-21-2·21-4, →ARCH A-03

## 맥락
상품 원천은 Supabase(DRV-C-01)지만 KANT는 `data/products.ts`에 6개 이상의 Mock을 요구한다. 쓰이지 않는 증빙 파일은 죽은 코드라, 이 파일의 실제 역할을 정해야 DB·FE 티켓이 확정된다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. seed 원천만 | 데이터 경로 1개. 가장 단순 | Supabase 없이 README만으로는 화면이 안 뜸(AC-21-4는 안내 문구로만 충족) | 낮음 | R3·C6 충족, R10은 Supabase 설정 필요 | 낮음 |
| B. seed 원천 + 환경변수 없을 때 읽기 전용 폴백 | 클론 직후 M1 3페이지가 바로 뜸 | 조회 함수에 분기 1개, 두 경로 결과가 달라질 위험 | 중: 폴백 분기 테스트 필요 | R10 가장 유리 | 중 |
| C. seed 원천 + 테스트 픽스처 | 단위 테스트가 실제 데이터 모양을 씀 | 테스트 외에는 A와 같음 | 낮음 | A와 같음 | 낮음 |

## 계층 관점 설명
- [레이어] A·C는 `app → lib/data → Supabase` 한 경로. B는 `lib/data/products.ts` 안에서만 `env 없음 → data/products.ts` 분기를 두고, 화면은 분기를 모른다.
- [모듈 협력 구조] seed(`supabase/seed.sql`)는 `scripts/gen-seed.mjs`가 `data/products.ts`에서 만든다. 상품 원본은 한 파일에서만 고친다(이중 관리 금지).

## 결정
선택 **C** — 데이터 경로를 1개로 유지하면서 `data/products.ts`가 seed와 테스트 두 곳에서 실제로 쓰인다. 환경변수 누락은 AC-21-4 안내 화면으로 처리한다.

## 결과
- 좋아지는 점: 런타임 분기 0, 폴백 데이터와 DB 불일치 위험 0
- 감수할 점: 평가자가 로컬 실행하려면 Supabase(로컬 `supabase start` 또는 원격) 설정 필요 → README에 명령 명시
- 후속: TKT-DB-01(seed 생성), TKT-FE-01(env 누락 안내)
