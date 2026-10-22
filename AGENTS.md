<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 에이전트 파이프라인 규칙 (모든 작업에 적용)

이 저장소는 `PM → ARCH → DB → BE → FE → QA` (+ 횡단 UX) 에이전트 파이프라인으로 작업한다. 스킬을 쓰지 않는 작업에도 적용된다.

1. 문서 경로의 기준은 `docs/PIPELINE.md`(산출물 레지스트리) 하나다. 스킬 문서와 다르면 레지스트리를 따른다.
2. 파이프라인 단계 작업(기획·설계·DB·백엔드·프론트·QA·UX)은 해당 스킬(`pm-agent`, `architect-agent`, `db-agent`, `backend-agent`, `frontend-impl`, `qa-agent`, `ubuntubooks-uiux-domain`)을 로드해서 한다.
3. 작업 전 `node scripts/check-handoff.mjs <STAGE>`를 실행한다(DB·BE·FE·QA는 `--ticket <TKT>`를 붙여 HANDOFF 선행 티켓의 브리핑까지 확인). 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 STATUS 줄을 보고한 뒤 멈춘다. 사용자가 예외를 승인하면 `docs/PIPELINE.md` §2-5대로 기록한다.
4. 산출물은 레지스트리에서 `만드는 단계`가 내 단계인 경로에만 쓰고, 끝나면 `node scripts/check-handoff.mjs <STAGE> --post --ticket <TKT>`로 확인한다.
5. 순차 실행은 `scripts/run-stage.sh <STAGE> [TKT]`로 한다 (`docs/PIPELINE.md` §5).

## 디렉토리 지도

파일 전체를 탐색하기 전에 이 지도부터 본다. 상세 규칙은 `docs/02-arch/05-structure-conventions.md`.

| 경로 | 책임 |
|---|---|
| `app/` | 라우트·화면, `actions.ts`(Server Action), `route.ts`(Route Handler). 비즈니스 규칙 금지 |
| `components/` | `Header`·`Footer`·`ProductCard`(KANT 고정) + 화면 공용 컴포넌트, `ui/`는 shadcn 기본 |
| `domains/<d>/` | 순수 타입·zod 스키마·규칙·문구 상수 + `*.test.ts` (스킬의 `lib/domain`에 해당) |
| `types/` | `product.ts`(KANT), `database.ts`(supabase gen types) |
| `data/products.ts` | KANT Mock = seed 원천 + 테스트 픽스처 |
| `lib/supabase/` · `lib/data/` | Supabase 클라이언트 · DB 접근(여기서만 Supabase 호출). `lib/data/products.ts`(상품 조회)는 DB, 그 밖의 `lib/data/*`(장바구니·주문·결제·회차·운영·탈퇴, RPC 래퍼)는 BE |
| `lib/auth/` · `lib/payments/` · `lib/http/` · `lib/crypto.ts` | 가드 · 토스 연동 · 에러 모델 · 난수 |
| `shared/utils/` | 공용 유틸(`formatPrice`, `cn`) |
| `supabase/` | 마이그레이션·seed·설정 |
| `proxy.ts` | 세션 갱신(Next 16의 middleware) |

| 단계 | 쓰는 곳 | 읽는 설계 문서 |
|---|---|---|
| DB | `supabase/`, `lib/supabase/`, `lib/data/products.ts`, `types/database.ts`, `data/products.ts`, `scripts/gen-seed.mjs` | `03-db-schema.md`, `HANDOFF.md` |
| BE | `app/**/actions.ts`, `app/**/route.ts`, `lib/data/*`(`products.ts` 제외), `lib/auth`, `lib/payments`, `lib/http`, `lib/crypto.ts`, `domains/` | `04-interfaces-api.md` §2·3·5·6, `docs/03-db/briefing.md`(RPC 표·호출 규칙) |
| FE | `app/**/page.tsx·layout.tsx·not-found.tsx`, `components/`, `types/product.ts`, `README.md` | `04-interfaces-api.md` §1·4, `05-structure-conventions.md` |
| QA | `**/*.test.ts`, `docs/06-qa/` | `06-quality-gates.md`, PM-AC |

설계 문서: `docs/02-arch/` (ADR은 `adr/`). 티켓: `docs/02-arch/HANDOFF.md`.
