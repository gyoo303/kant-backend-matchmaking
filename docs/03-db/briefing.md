---
stage: DB
tickets: [TKT-DB-00]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-DB, AR-CONV, AR-GATE, AR-ADR]
next_readers: [BE, QA]
---
# DB 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-DB-00 | `npx supabase db push --linked --dry-run` 정상 종료 | 충족 (2026-10-22, exit 0, "Remote database is up to date.", 적용 대상 마이그레이션 0개) |

## 만든 것
- `supabase/config.toml`: `npx supabase init` 기본값 그대로 (CLI 2.121.0, `project_id = "kant-ubuntu-books-claude1"`, Postgres 17, seed 경로 `./seed.sql`)
- `supabase/.gitignore`: CLI가 만든 파일 그대로 (`.branches`, `.temp`, `.env.keys`, `.env.local`, `.env.*.local`)
- 마이그레이션·RLS·`lib/data` 함수: 없음 (TKT-DB-01부터)
- `.env.example`은 TKT-FE-00에서 ADR-005 표대로 만들어졌다. 변수 8개가 표와 같은지 확인만 했다

## 환경

### 1. 구성 (ADR-005 개정, 2026-10-21)
- Supabase **원격 프로젝트 1개**를 개발·검증·시연에 함께 쓴다. 로컬 Supabase(`supabase start`, Docker)는 쓰지 않는다.
- 저장소의 `supabase/`(마이그레이션·seed·테스트)를 CLI로 원격에 연결해 적용한다. 원격 적용은 사람이 한다.
- 되돌리기 없는 변경 규칙: 적용된 마이그레이션은 고치지 않는다, `db reset` 금지, seed는 다시 적용해도 결과가 같게, pgTAP 테스트는 `begin … rollback` (AR-DB §8, RISK-16).

### 2. 환경변수 (`.env.local`, 커밋 금지)
| 변수 | 공개 | 값을 가져오는 곳 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | 대시보드 Project Settings → API의 Project URL (`https://<ref>.supabase.co`) | `lib/supabase/client.ts`, `server.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | 대시보드 API Keys의 Publishable key | 위와 같음 |
| `SUPABASE_SERVICE_ROLE_KEY` | **비밀** | 대시보드 API Keys의 Secret(service_role) key | `lib/supabase/admin.ts`만 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 공개 / **비밀** | 토스페이먼츠 개발자센터 테스트 키 | 결제창 / `lib/payments/toss.ts`만 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | **비밀** | 네이버 개발자센터 앱 | `lib/auth/naver.ts`만 (ADR-003 B로 전환 시) |
| `NEXT_PUBLIC_SITE_URL` | 공개 | 로컬 `http://localhost:3000`, 배포 시 운영 도메인 | 콜백·리다이렉트 URL |

```bash
cp .env.example .env.local
```

### 3. 원격 프로젝트 연결 (사람이 실행)
1. supabase.com에서 프로젝트를 만든다(리전 Seoul 권장). DB 비밀번호를 따로 보관한다.
2. CLI 로그인 (브라우저 인증):
```bash
npx supabase login
```
3. 저장소를 원격 프로젝트에 연결 (DB 비밀번호 입력). 연결 정보는 `supabase/.temp/`에 저장되고 Git에서 제외된다:
```bash
npx supabase link --project-ref <프로젝트-ref>
```
4. 완료 조건 확인. 마이그레이션이 아직 없으므로 "적용할 것 없음"으로 끝나면 정상이다:
```bash
npx supabase db push --linked --dry-run
```

### 4. Supabase 대시보드 설정 (사람이 실행)
- Authentication → URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`, 배포 후 운영 도메인의 `/auth/callback`
- 소셜 제공자 콘솔에 등록할 콜백: `https://<project-ref>.supabase.co/auth/v1/callback` (1개)

### 5. 외부 키 발급 신청 (1일차, 사용은 BE 단계)
| 제공자 | 할 일 | 쓰는 티켓 |
|---|---|---|
| 카카오 디벨로퍼스 | 앱 생성, REST API 키·Client Secret 발급, 카카오 로그인 켜기, "이메일 없이 허용" 켜기, Redirect URI에 §4 콜백 등록. 대시보드 Authentication → Providers → Kakao에 키 입력 | TKT-BE-M2-01 |
| 네이버 개발자센터 | 앱 생성("개발 중" 상태), Client ID·Secret 발급, 시연 계정을 테스트 ID로 등록, Callback URL 등록 | TKT-BE-M2-02 (`custom:naver` 스파이크) |
| 토스페이먼츠 | 가입, 개발자센터에서 테스트 클라이언트 키·시크릿 키 확인 → `.env.local` | TKT-BE-M3-02 |

### 6. 하지 말 것
- `npx supabase config push`: 이 명령은 `config.toml`의 auth 설정(기본값 `site_url = "http://127.0.0.1:3000"` 등)으로 원격 대시보드 설정을 덮어쓴다. 원격 auth 설정은 대시보드에서만 바꾼다.
- `npx supabase start`, `npx supabase db reset` (ADR-005).

## 인프라 계층 확인 포인트
- 연결 후 `supabase/.temp/project-ref`가 생기는지, `git status`에 `supabase/.temp/`가 나오지 않는지 확인한다.
- `config.toml`의 로컬 전용 섹션(`[api]`, `[studio]`, `[local_smtp]` 등)은 원격 전용 구성에서는 쓰이지 않는다. 원격 작업에 쓰는 값은 `[db] major_version = 17`, `[db.seed] sql_paths = ["./seed.sql"]`이다.

## 레이어 계층 확인 포인트
- 없음 (`lib/data`는 TKT-DB-01부터)

## 설계와 다르게 한 것 / 질문
- `config.toml`은 기본값에서 바꾸지 않았다. 설계(AR-DB, ADR-005)에 값이 정해져 있지 않고, 원격 전용이라 `config push`를 하지 않으면 원격에 영향이 없다.
- 원격 Postgres는 17.11(`supabase/.temp/postgres-version`)로 `config.toml`의 `major_version = 17`과 같다.
- 네이버 키(`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`)는 아직 발급 전이다. TKT-BE-M2-02 전에 필요하다.

## 검증 결과
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-05: `.env` 추적 0줄, `NEXT_PUBLIC_`에 비밀값 0줄, `supabase/.temp/` 미추적
- GATE-07: 해당 없음 (테이블 없음)
- 원격 연결: 사람이 `login`·`link` 완료. `npx supabase db push --linked --dry-run` exit 0, 적용 대상 0개
- `.env.local`: Git 제외 확인. Supabase 변수 3개와 `NEXT_PUBLIC_SITE_URL` 입력됨(값은 확인하지 않음, 형식만 확인)
