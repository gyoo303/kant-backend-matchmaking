# 06. 품질 게이트 & 테스트 전략 (AR-GATE)

- 입력: AR-DRV(RISK), AR-CONV §4, PM-AC(AC·NFR)
- 모든 구현 티켓은 PR 전에 해당 GATE를 통과하고, 브리핑에 명령과 결과(통과/실패 줄)를 적는다.

## 1. GATE
| GATE | 내용 | 명령 (저장소 루트) | 통과 기준 | 적용 |
|---|---|---|---|---|
| GATE-01 | 타입 검사 | `npx tsc --noEmit` | 오류 0 | 전 티켓 |
| GATE-02 | 린트 | `npm run lint` (스크립트를 `eslint .`로 교체 — Next 16은 `next lint` 없음, TKT-FE-00) | 오류 0 | 전 티켓 |
| GATE-03 | 단위 테스트 | `npm test` (`node --test`, `{app,domains,shared}/**/*.test.ts`) | 실패 0 | 전 티켓 |
| GATE-04 | 빌드 | `npm run build` (prebuild가 GATE-03 포함) | 종료 코드 0 (KANT-C15) | 전 티켓 |
| GATE-05 | 비밀값·`.gitignore` | `git ls-files \| grep -E '(^\|/)\.env' \| grep -v '\.env\.example$'` 출력 0줄, `grep -rnE 'NEXT_PUBLIC_[A-Z_]*(SECRET\|SERVICE_ROLE)' --include=*.ts* app components lib domains` 0줄, `node_modules`·`.next` 미추적 | 모두 0 | 전 티켓 |
| GATE-06 | 금지 패턴 | `grep -rnE '\bany\b\|as unknown as\|@ts-ignore\|@ts-expect-error\|catch *\([^)]*\) *\{ *\}' --include=*.ts* app components lib domains` 0줄 / `grep -rnE 'new Date\(\|Date\.now\|Math\.random\|crypto\|fetch\(\|supabase' domains --include=*.ts` 중 `*.test.ts` 제외 0줄 / `'use client'` 파일에 `server-only` 모듈 import 0 | 0줄 | 전 티켓 |
| GATE-07 | RLS·RPC (원격, ADR-005) | 사람이 `npx supabase db push --linked --include-seed`로 적용한 뒤 `npx supabase test db --linked` (pgTAP, `supabase/tests/*.test.sql`, 파일마다 `begin … rollback`, 결과 표 형식 AR-DB §8) | 모든 테이블 RLS 활성(AR-DB §4 점검 쿼리 0행), 정책 표 역할별 테스트 통과(출력에 `not ok` 0줄, 마지막 줄 `1..N`) | DB 티켓, 스키마 변경 티켓 |

- GATE-07의 테스트 실행기(pg_prove)는 Supabase CLI가 Docker 컨테이너로 띄운다(로컬 DB는 띄우지 않음). Docker를 쓸 수 없으면 Supabase SQL 편집기에서 각 테스트 파일을 실행하고 `ok`/`not ok` 결과를 브리핑에 붙인다. 편집기는 마지막 결과만 보여 주므로 테스트 파일은 AR-DB §8의 결과 표 형식(임시 테이블 `tap`에 모아 마지막에 출력)으로 쓴다. `npx supabase db reset`은 원격 데이터를 지우므로 쓰지 않는다.
- `\bany\b`는 주석·문자열의 영어 단어도 잡는다. 오탐이면 브리핑에 줄 번호와 이유를 적는다(코드에서 우회 금지).

## 2. 테스트 전략 (우선순위 순)
| 순위 | 대상 | 도구·위치 | 대표 케이스 |
|---|---|---|---|
| 1 | 도메인 규칙(INV) | `domains/**/*.test.ts` | 장바구니 수량 보정(AC-07-4), 테마 파싱(AC-02-5), 코드 생성 6자리·주입 난수(INV-08), 입력 한도(D-025), CSV BOM·CRLF(AC-19-1), 창가 문구 매핑(D-043) |
| 2 | 상태 전이 | `supabase/tests/state_machine.test.sql` | AR-API §6 표의 허용 전이 1개씩 + 표에 없는 전이 거부 |
| 3 | 멱등성·결제 | `supabase/tests/payments.test.sql`, `domains/payments/*.test.ts` | `confirm_payment` 2회(AC-08-6), 금액 불일치(AC-08-8, AC-11-10), `begin_refund` 2회(AC-10-5), `ship_round` 2회 코드 1개(AC-15-4), 재고 0 발송(AC-15-5) |
| 4 | 권한·개인정보(REJ) | `supabase/tests/rls.test.sql` | 회원 B가 A의 편지·메모·안부·주문 조회 0행(AC-09-4, 11-9, 17-5, 18-8), 언박싱 전 `round_contents` 0행(NFR-08), 비관리자 `products` insert 거부(AC-06-5) |
| 5 | 화면 | QA 수동·시연 흐름(PM-SCR §5) + `docs/uiux/review/QA/scenarios.md` | NFR-02·10·11·14 |

- 테스트에 목(mock)이 3개 이상 필요하면 설계 결함으로 보고 Architect에 질문한다(I/O 격리 위반 신호).
- `data/products.ts`는 순위 1 테스트의 픽스처로 쓴다(ADR-001).

## 3. AC ↔ 테스트 ID 규칙
- 테스트 이름은 PM의 ID로 시작한다: `test('AC-08-6: 같은 결제 확정 2회 → 재고 1회 감소', …)`, pgTAP은 `-- AC-08-6` 주석 + `ok(…, 'AC-08-6 …')`.
- NFR은 `NFR-xx:` 접두. 새 번호 체계를 만들지 않는다(PIPELINE §2-4).
- QA 브리핑은 AC별 `통과/실패/수동 확인/미검증` 표를 쓴다.

## 4. 실패 처리
- 실패 시 오류 요약(첫 오류 메시지 + 파일:줄)만 남기고 수정을 반복한다.
- 같은 GATE를 3회 연속 실패하면 설계 문제로 보고 `docs/02-arch` 해당 ID와 함께 Architect에 질문한다.

## 5. 자가 점검
- D3: 새 테스트 도구 0(기존 `node --test`, 설치된 Supabase CLI의 pgTAP). D4: RLS·멱등성을 자동 게이트로. D5: 명령을 그대로 복사해 실행 가능.
