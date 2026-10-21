# ADR-005: 배포·환경·비밀값 관리
- 상태: Accepted (user, 2026-10-21) — 개정 (user, 2026-10-21): 로컬 Supabase 미사용, 원격 프로젝트 1개로 개발·검증·운영
- 관련 계층: [인프라]
- 근거: DRV-C-07, DRV-Q-01, DRV-Q-04, RISK-10, RISK-16, NFR-09·15, KANT-C15·C16

## 맥락
시연은 4일차다. 소셜 로그인 콜백·PG 리다이렉트·웹훅에는 고정된 공개 URL이 필요하고, 서비스 키·PG 시크릿을 둘 곳을 정해야 한다. 팀은 로컬 Supabase(`supabase start`, Docker)를 쓰지 않고 원격 프로젝트에 API·CLI로만 접속하기로 했다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. Supabase 원격 프로젝트 1개(개발·검증·운영 공용) + Vercel 1개(Production). 로컬은 Next 앱(`npm run dev`)만 | 구성 최소, Docker 불필요, 콜백 URL이 처음부터 고정 | 개발·테스트·시연이 같은 DB → 마이그레이션 되돌리기(`db reset`) 불가, 테스트 데이터가 시연 데이터에 섞일 위험(RISK-16) | 낮음 | 빌드 게이트 그대로 | 낮음 |
| B. 로컬 개발(`supabase start`) + 원격 1개 | `db reset`으로 반복 검증, 운영 데이터와 분리 | Docker 필요, 환경 2개의 키·URL 관리 | 낮음 | 없음 | 낮음 |
| C. Supabase 프로젝트 2개(dev/prod) + Vercel preview | 원격만 쓰면서 환경 분리 | OAuth·PG 콜백 URL을 환경마다 등록, 설정 2배 | 중 | 없음 | 중 |

## 계층 관점 설명
- [인프라] 환경변수(이름만 `.env.example`에 기록, 값은 원격 프로젝트 것):
  | 변수 | 공개 | 쓰는 곳 |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | `lib/supabase/client.ts`, `server.ts` |
  | `SUPABASE_SERVICE_ROLE_KEY` | 비밀 | `lib/supabase/admin.ts`만 (`import 'server-only'`) |
  | `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 공개 / 비밀 | 결제창 / `lib/payments/toss.ts`만 |
  | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 비밀 | `lib/auth/naver.ts`만 (ADR-003) |
  | `NEXT_PUBLIC_SITE_URL` | 공개 | 콜백·리다이렉트 URL 생성 |
- 비밀값은 Vercel 환경변수와 로컬 `.env.local`에만 둔다. `.gitignore`의 `.env*`는 유지하고 `!.env.example`을 추가한다.
- [인프라] DB 작업 경로: 저장소의 `supabase/`(마이그레이션·seed·테스트)를 Supabase CLI로 원격에 연결해 쓴다. `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push --linked [--include-seed]` → `npx supabase test db --linked` → `npx supabase gen types typescript --linked`. 원격 적용(`db push`)은 사람이 DB 브리핑을 확인한 뒤 실행한다.
- 원격 DB는 되돌릴 수 없다고 본다: 적용된 마이그레이션은 고치지 않고 새 마이그레이션으로 바꾼다, `db reset --linked` 금지, seed는 여러 번 적용해도 결과가 같게(`on conflict (id) do update`), pgTAP 테스트는 파일 전체를 `begin; … rollback;`으로 감싼다(AR-DB §8, GATE-07).
- Auth 리다이렉트 허용 URL(Supabase 대시보드): `http://localhost:3000/auth/callback`, 운영 도메인 `/auth/callback`. 소셜 제공자 콘솔의 콜백은 `https://<project-ref>.supabase.co/auth/v1/callback` 1개.

## 결정
선택 **A** — 팀이 로컬 Supabase를 쓰지 않기로 했고, 4일 일정과 운영 단순성(DRV-Q-04)에 맞다. 운영 전환 시점에 C로 넓힌다.

## 결과
- 좋아지는 점: Docker·로컬 키 관리 없음, 콜백 URL이 처음부터 고정
- 감수할 점: preview 배포 미사용(PR 검증은 GATE로). 개발·시연 DB 공용(RISK-16) → 되돌리기 없는 변경 규칙을 지킨다
- 후속: TKT-DB-00(원격 연결·`.env.example`), TKT-QA-M5(배포 점검)
