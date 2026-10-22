---
stage: DB
tickets: [TKT-DB-00, TKT-DB-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-DB, AR-CONV, AR-GATE, AR-ADR]
next_readers: [BE, QA]
---
# DB 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-DB-00 | `npx supabase db push --linked --dry-run` 정상 종료 | 충족 (2026-10-22, exit 0, "Remote database is up to date.", 적용 대상 마이그레이션 0개) |
| TKT-DB-01 | AC-02-1·3, NFR-16, GATE-07 | 충족 (2026-10-22). 원격 적용 완료(`migration list`: 0001 local=remote), pgTAP 22개 통과, 공개 키 조회 확인(아래 "검증 결과") |

## 만든 것
### TKT-DB-00
- `supabase/config.toml`: `npx supabase init` 기본값 그대로 (CLI 2.121.0, `project_id = "kant-ubuntu-books-claude1"`, Postgres 17, seed 경로 `./seed.sql`)
- `supabase/.gitignore`: CLI가 만든 파일 그대로 (`.branches`, `.temp`, `.env.keys`, `.env.local`, `.env.*.local`)
- `.env.example`은 TKT-FE-00에서 ADR-005 표대로 만들어졌다. 변수 8개가 표와 같은지 확인만 했다

### TKT-DB-01
- `supabase/migrations/0001_profiles_products.sql`
  - enum 6개 전체(AR-DB §2), `set_updated_at()`
  - `profiles`(ENT-01), `is_keeper()`(security definer, `search_path = ''`), 가입 트리거 `handle_new_user` → `on_auth_user_created`
  - `products`(ENT-02, 길이·가격·재고 check, `products_theme_created_idx`, `updated_at` 트리거)
  - `book-covers` 버킷(공개, jpeg·png·webp, 5MB) + `storage.objects` 정책 3개
- `types/product.ts`: AR-API §1.1 그대로 (아래 "설계와 다르게 한 것")
- `data/products.ts`: 8권, 테마별 2권, 고정 uuid `b0000000-…-00000000000N`, 표지 `picsum.photos/seed/ub-<n>/600/800`, `createdAt` 2일 간격. 4번 책(`제철 밥상 일기`)은 재고 0 — 새로 들어온 책(API-03) 제외·품절 표시 확인용
- `scripts/gen-seed.mjs` → `supabase/seed.sql`(생성 파일, 커밋): `insert … on conflict (id) do update`, 재적용해도 8행
- `lib/supabase/env.ts`·`client.ts`·`server.ts`(`createClient`, `createPublicClient`)·`admin.ts`(`createAdminClient`, `server-only`)
- `lib/data/products.ts`: `toProduct`, API-01~03
- `supabase/tests/rls.test.sql`: pgTAP 22개 (아래 "검증 결과")

### RLS 정책 (TKT-DB-01 범위)
| 테이블 | 누가 | 무엇을 | 조건 |
|---|---|---|---|
| `profiles` | 회원 | select | 자기 행(`id = auth.uid()`) |
| `profiles` | 책방지기 | select | 전체(`is_keeper()`) |
| `profiles` | 회원 | update | 자기 행, `nickname` 컬럼만(테이블 update 회수 + 컬럼 grant) |
| `profiles` | 비로그인 | — | 없음 |
| `products` | 모두(anon·회원) | select | 전체 |
| `products` | 책방지기 | insert·update | `is_keeper()` / delete 정책 없음(D-023) |
| `storage.objects` (`book-covers`) | 모두 | select | `bucket_id = 'book-covers'` |
| `storage.objects` (`book-covers`) | 책방지기 | insert·update | `bucket_id = 'book-covers' and is_keeper()` |

### lib/data 함수
| 함수 | API | 반환 | 비고 |
|---|---|---|---|
| `toProduct(row)` | — | `Product` | snake → camel 변환 한 곳 |
| `getProducts(theme?)` | API-01 | `Product[]` 최신순 | `'use cache'` + `cacheTag('products')`, 실패 시 throw |
| `getProduct(id)` | API-02 | `Product \| null` | uuid 형식 아니면 조회 없이 null |
| `getNewArrivals()` | API-03 | `Product[]` 재고>0 최신 4권 | D-035 |
- 트랜잭션 함수(RPC): 없음 (TKT-DB-02부터)

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

### 마이그레이션 적용 절차 (TKT-DB-01부터 티켓마다 같다. 사람이 실행)
1. 적용될 내용 확인:
```bash
npx supabase db push --linked --dry-run --include-seed
```
2. 원격 적용:
```bash
npx supabase db push --linked --include-seed
```
3. 이후 DB 에이전트가 실행: `npx supabase gen types typescript --linked --schema public > types/database.ts` → `npx tsc --noEmit` → `npm run build`
4. pgTAP (Docker 필요, 로컬 DB는 띄우지 않음). 이 PC에는 Docker가 없어 SQL 편집기에 `supabase/tests/*.test.sql`을 붙여 실행한다. 결과가 `1..N` 한 줄만 나오면 전부 통과, 실패가 있으면 `# Looks like you failed …` 줄이 함께 나온다:
```bash
npx supabase test db --linked
```

## 레이어 계층 확인 포인트
- 상품 조회는 `lib/data/products.ts`의 `getProducts`·`getProduct`·`getNewArrivals`만 쓴다. 세 함수는 `'use cache'`라 **cookies·세션을 읽는 코드와 섞지 않는다**.
- 책을 저장(API-04)한 뒤에는 `updateTag('products')`로 세 함수의 캐시를 비운다(CONV-07). 쓰기는 `createClient()`(쿠키 세션)로 해야 RLS가 책방지기를 확인한다.
- `createPublicClient()`는 anon 권한이다. 공개 데이터(`products`) 외에는 쓰지 않는다.
- `createAdminClient()`는 RLS를 건너뛴다. 설계가 정한 곳(엽서 서명 URL, 탈퇴, 결제 확정 RPC)에서만 쓴다.
- env가 없으면 세 클라이언트 모두 `CONFIG_MISSING: …` 메시지로 throw한다. 화면 안내(AC-21-4)는 TKT-FE-01에서 이 메시지로 판별한다.

## 설계와 다르게 한 것 / 질문
- (TKT-DB-01, 사용자 승인 2026-10-22) `types/product.ts`를 DB-01에서 만들었다. AGENTS.md 담당은 FE지만 FE-01이 DB-01 다음이라 `toProduct`·`data/products.ts`가 컴파일되지 않는다. 내용은 AR-API §1.1 그대로이고, FE-01은 확인만 하면 된다.
- (TKT-DB-01, 사용자 승인) `lib/supabase/server.ts`에 `createPublicClient()`를 추가했다. Next 16의 `'use cache'` 안에서는 `cookies()`를 쓸 수 없어(next/dist/docs `use-cache.md`) CONV-07을 지키려면 세션 없는 클라이언트가 필요하다.
- (TKT-DB-01, 사용자 승인) `book-covers` 버킷을 `0005_storage.sql`이 아니라 `0001`에 넣었다. AR-DB §9 표와 HANDOFF TKT-DB-03 산출을 같이 고쳤다(`postcards`는 `0003`).
- `lib/supabase/env.ts`를 추가했다(설계 파일 목록에 없음). 세 클라이언트가 같은 env 확인을 쓰게 하려는 작은 파일이다.
- `lib/supabase/server.ts`의 `setAll`에 비어 있는 `catch`가 있다(GATE-06 금지 패턴 2). Supabase SSR 가이드가 정한 형태로, Server Component에서 쿠키 쓰기가 실패하는 것은 정상이고 세션 갱신은 `proxy.ts`가 맡는다. 주석으로 이유를 남겼다. GATE-06 grep(한 줄 `catch () {}`)에는 걸리지 않는다.
- 가입 트리거의 닉네임은 `raw_user_meta_data`의 `name` → `full_name` → `nickname` → `user_name` 순으로 찾는다(D-A06 "제공자 이름"). 카카오·`custom:naver`가 실제로 어느 키를 채우는지는 TKT-BE-M2-01·02에서 확인이 필요하다.
- `lib/data/products.ts`의 조회 실패는 `ErrorCode`로 바꾸지 않고 throw한다. `lib/http/result.ts`(ErrorCode)는 TKT-BE-M2-01에서 생기고, API-01의 화면 처리(AC-01-4)는 페이지의 오류 처리로 한다.
- `next.config.ts`의 `images.remotePatterns`(AR-DB §6)는 표지를 화면에 그리는 TKT-FE-01에서 넣는다고 보고 이번에 넣지 않았다.
- `config.toml`은 기본값에서 바꾸지 않았다. 설계(AR-DB, ADR-005)에 값이 정해져 있지 않고, 원격 전용이라 `config push`를 하지 않으면 원격에 영향이 없다.
- 원격 Postgres는 17.11(`supabase/.temp/postgres-version`)로 `config.toml`의 `major_version = 17`과 같다.
- 네이버 키(`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`)는 아직 발급 전이다. TKT-BE-M2-02 전에 필요하다.

## 검증 결과
### TKT-DB-01 (2026-10-22, 원격 적용 후)
- 원격 적용: 사람이 `npx supabase db push --linked --include-seed` 실행. `migration list` 0001 local=remote, 다시 dry-run하면 "Remote database is up to date."
- `types/database.ts`: `gen types --linked --schema public`으로 생성(258줄, `products`·`profiles`·`is_keeper`·enum 6개)
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-02 `npm run lint`: 통과
- GATE-03 `npm test`: tests 3 / pass 3 / fail 0 (DB-01에는 단위 테스트 대상 없음)
- GATE-04 `npm run build`: 통과
- GATE-05: `NEXT_PUBLIC_`에 비밀값 0줄, `.env` 추적 0줄
- GATE-06 금지 패턴 grep: 0줄 (위 `catch` 설명 참고)
- GATE-07 pgTAP `supabase/tests/rls.test.sql`: **22개 통과** (사람이 SQL 편집기로 실행, 결과 `1..22`, 실패 줄 없음). 항목: RLS 전체 활성 1, 가입 트리거 3, 비로그인 3, 회원 7, 책방지기 5, book-covers 3
- 공개 키(anon)로 원격 직접 조회 (API-01~03과 같은 쿼리):
  - AC-02-1: 전체 8권, 테마별 2·2·2·2 / `nature` 필터 2권
  - AC-03-1·4: 1번 책 조회됨 / 없는 id는 `null`
  - D-035: 새로 들어온 책 4권, 재고 0 책 미포함
  - RLS: anon `profiles` 0행, anon `products` insert 거부(42501)
- NFR-16: 표지 8개 주소 모두 HTTP 200
- `node --import tsx scripts/gen-seed.mjs`: `supabase/seed.sql: products 8행`

### TKT-DB-00
- GATE-01 `npx tsc --noEmit`: 통과
- GATE-05: `.env` 추적 0줄, `NEXT_PUBLIC_`에 비밀값 0줄, `supabase/.temp/` 미추적
- GATE-07: 해당 없음 (테이블 없음)
- 원격 연결: 사람이 `login`·`link` 완료. `npx supabase db push --linked --dry-run` exit 0, 적용 대상 0개
- `.env.local`: Git 제외 확인. Supabase 변수 3개와 `NEXT_PUBLIC_SITE_URL` 입력됨(값은 확인하지 않음, 형식만 확인)
