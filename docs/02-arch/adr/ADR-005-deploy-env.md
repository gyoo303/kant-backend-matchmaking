# ADR-005: 배포·환경·비밀값 관리
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [인프라]
- 근거: DRV-C-07, DRV-Q-01, DRV-Q-04, RISK-10, NFR-09·15, KANT-C15·C16

## 맥락
시연은 4일차다. 소셜 로그인 콜백·PG 리다이렉트·웹훅에는 고정된 공개 URL이 필요하고, 서비스 키·PG 시크릿을 둘 곳을 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 로컬 개발(`supabase start`) + Vercel 1개(Production) + Supabase 원격 프로젝트 1개 | 구성 최소, Next 16 기본 지원 | preview가 운영 DB를 씀 → preview 배포는 쓰지 않음 | 낮음 | 빌드 게이트 그대로 | 낮음 |
| B. A + Supabase 프로젝트 2개(dev/prod) + Vercel preview | 환경 분리 | OAuth·PG 콜백 URL을 환경마다 등록, 설정 2배 | 중 | 없음 | 중 |
| C. 로컬에서만 시연(ngrok 등 터널) | 배포 0 | 웹훅·콜백 URL이 매번 바뀜, 시연 장애 위험 | 중 | 없음 | 낮음 |

## 계층 관점 설명
- [인프라] 환경변수(이름만 `.env.example`에 기록):
  | 변수 | 공개 | 쓰는 곳 |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | `lib/supabase/client.ts`, `server.ts` |
  | `SUPABASE_SERVICE_ROLE_KEY` | 비밀 | `lib/supabase/admin.ts`만 (`import 'server-only'`) |
  | `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 공개 / 비밀 | 결제창 / `lib/payments/toss.ts`만 |
  | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 비밀 | `lib/auth/naver.ts`만 (ADR-003) |
  | `NEXT_PUBLIC_SITE_URL` | 공개 | 콜백·리다이렉트 URL 생성 |
- 비밀값은 Vercel 환경변수와 로컬 `.env.local`에만 둔다. `.gitignore`의 `.env*`는 유지하고 `!.env.example`을 추가한다.

## 결정
선택 **A** — 4일 일정과 운영 단순성(DRV-Q-04)에 맞다. 운영 전환 시점에 B로 넓힌다.

## 결과
- 좋아지는 점: 콜백 URL 2개(localhost, 운영 도메인)만 등록
- 감수할 점: preview 배포 미사용(PR 검증은 로컬 GATE로)
- 후속: TKT-DB-00(Supabase 프로젝트·`.env.example`), TKT-QA-M5(배포 점검)
