# 01. 아키텍처 드라이버 (AR-DRV)

- 입력: PM-SCOPE(Architect 요약 블록), PM-ASM §4(→ARCH A-01~A-11), PM-DOMAIN §5~§7, PM-AC §2(NFR), PM-DEC(D-001~043), UX-CTX-ORCH v0.2
- 이후 모든 ADR의 "근거" 칸은 이 문서의 ID를 쓴다.

## 0. 입력 검증 (A0) — 통과
| 항목 | 결과 |
|---|---|
| 미해결 Q | 0 (Q-001~008 답변) |
| D-xx 승인 | D-001~004 `[APPROVED]`, `[PENDING]` 0 |
| Must US → AC | 21/21, REJ → AC 58/58 |
| INV·상태 흐름 | INV-01~20, Order §5.1 · Subscription §5.2 · Round §5.3 · 진행 중 회차 §5.4 정의됨 |
| KANT 매트릭스 빈 행 | 0 / 28 |
| `check-handoff ARCH` | `STATUS: READY ARCH` |

### →ARCH 질문 배정
| ID | 질문 | 답하는 곳 |
|---|---|---|
| A-01 | PG·테스트 모드·확정 1회 보장 | ADR-004, SEQ-03, 03-db-schema `payments` |
| A-02 | 네이버 로그인 | ADR-003 |
| A-03 | `data/products.ts` 역할 | ADR-001 |
| A-04 | 등불 반영 방식 | ADR-006 |
| A-05 | 6자리 코드 생성 | 04-interfaces-api SEQ-06, 03-db-schema `unboxing_codes` |
| A-06 | 주소록 파일 형식 | ADR-007 |
| A-07 | 관리자 권한 | ADR-003, 03-db-schema RLS |
| A-08 | 답장·엽서 비공개 저장 | 03-db-schema Storage |
| A-09 | 저장소 구조와 KANT 경로 정합 | 05-structure-conventions §1 |
| A-10 | 소셜 로그인 외부 심사 | ADR-003 결과 |
| A-11 | 주소록 다운로드 기록·안내 | ADR-007 |

### 기존 저장소 구조 (`git ls-files`, 기준선)
| 폴더 | 현재 내용 | 역할 판정 |
|---|---|---|
| `app/` | `layout.tsx`, `page.tsx`, `globals.css` (create-next-app 기본) | 라우트·화면 |
| `components/ui/` | shadcn(base-nova) 기본 컴포넌트 6개 | UI 기본 컴포넌트 |
| `domains/<d>/types/<n>.types.ts` | boards·categories·files 타입 (이전 템플릿, 이 서비스와 무관) | 도메인 타입 패턴 |
| `shared/utils/`, `shared/mocks/` | `formatPrice`(+테스트), `cn`, 이전 템플릿 목 데이터 | 공용 유틸 |
| `src/shared/utils/cn.ts` | `shared/utils/cn.ts`와 중복 | `src/` 금지(§0.3) → 정리 대상 |
| `lib/utils.ts` | `cn` 재수출 | shadcn 관례 |
| `scripts/` | 파이프라인 점검 스크립트 | 도구 |
| 설정 | Next 16.4.2, React 19.3, TS strict, Tailwind 4, `cacheComponents: true`, 테스트 `node --test` + `tsx`, `prebuild`에서 테스트 실행, `@supabase/ssr`·`supabase` CLI 설치됨 | |

## 1. 제약 (DRV-C)
| ID | 제약 | 출처 |
|---|---|---|
| DRV-C-01 | DB·인증·파일은 Supabase(Postgres·Auth·Storage). 상품 포함 운영 데이터 원천은 Supabase | 팀 결정, REQ-T01 |
| DRV-C-02 | Next.js 16 App Router + TypeScript(strict) + Tailwind 4. `src/` 미사용 | KANT-R2, C4 |
| DRV-C-03 | KANT 고정 경로 10개(`types/product.ts`, `data/products.ts`, `components/Header·Footer·ProductCard.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `package.json`, `.gitignore`, `README.md`) | KANT-R3~R10 |
| DRV-C-04 | 로그인은 카카오·네이버 2개뿐, 아이디·비밀번호 없음 | INV-03 |
| DRV-C-05 | 결제는 단건 1종(주문·회차 공용), 테스트 모드, 관리자 [환불]이 PG 환불까지 | D-002 |
| DRV-C-06 | 회차 = 편지 = 결제 = 책 = 발송 = 코드, 정액 30,000원, 진행 중 회차 1개 | D-003, INV-12 |
| DRV-C-07 | 일정: M1(1일) → M2·M3(2일) → M4(3일) → M5(4일 오전), 4일차 시연 | D-001 |
| DRV-C-08 | 기존 저장소 구조 기준. 새 폴더·계층은 ADR 확인 | REQ-T05 |
| DRV-C-09 | Next 16 `cacheComponents: true`: 세션(`cookies()`) 읽는 컴포넌트는 `<Suspense>` 안, 미들웨어는 `proxy.ts` | `node_modules/next/dist/docs` (proxy, authentication-with-cache-components) |
| DRV-C-10 | 운영자는 책방지기 1명, 컴퓨터가 서툼 | REQ-050, D-018 |

## 2. 품질 속성 우선순위 (DRV-Q)
| 순위 | ID | 속성 | NFR | 우선순위 근거 |
|---|---|---|---|---|
| 1 | DRV-Q-01 | 보안·개인정보 (권한, 편지류 열람, 비밀키) | NFR-06, 08, 09 | 사적인 손편지·주소가 핵심 데이터. 한 번 새면 되돌릴 수 없음 |
| 2 | DRV-Q-02 | 결제·상태 정확성 (중복 확정 0, 금액 검증, 재고 음수 0, 단방향 전이) | NFR-07, 19, INV-04~06, 09 | 돈과 재고가 걸린 오류는 시연에서도 치명적 |
| 3 | DRV-Q-03 | KANT 증빙·빌드 안정성 | NFR-04, 05, 14~16 | 평가 기준. M1에서 먼저 확보(D-016) |
| 4 | DRV-Q-04 | 운영 단순성 (적은 구성 요소, 한 열 관리자 화면) | NFR-13 | 4일 일정 + 책방지기 1명. 구성 요소가 늘면 일정·장애 지점이 함께 는다 |
| 5 | DRV-Q-05 | 사용성·접근성·반응형 | NFR-02, 03, 10~12 | 감성 경험이 서비스 차별점. 단, 위 4개를 해치지 않는 선에서 |
| 6 | DRV-Q-06 | 성능 | NFR-01, 17 | 트래픽 작음. LCP 기준만 지키면 됨 |
| 7 | DRV-Q-07 | 확장성 | — | 동네서점 1곳. 미래 대비 추상화는 하지 않음(D3) |

## 3. 핵심 리스크 (RISK)
| ID | 리스크 | 가능성 | 영향 | 설계 대응 위치 |
|---|---|---|---|---|
| RISK-01 | 결제 확정 신호 중복(리다이렉트 + 웹훅 + 새로고침)으로 재고·상태 2회 변경 | 높음 | 높음 | ADR-004, `payments.pg_payment_key unique`, RPC `confirm_payment` 상태 조건부 갱신 (SEQ-03) |
| RISK-02 | 금액 위변조(클라이언트가 보낸 금액·결과를 신뢰) | 중 | 높음 | 서버 계산 금액으로 `payments.amount` 선저장 → PG 승인 응답과 대조 (D-031, SEQ-03) |
| RISK-03 | PG 승인 성공 후 DB 확정 실패(재고 부족 포함) → 돈만 빠짐 | 중 | 높음 | 승인 → RPC 실패 시 즉시 PG 취소 보상 (SEQ-03 실패 분기, AC-08-5) |
| RISK-04 | 환불 PG 성공·DB 실패 또는 2회 클릭 | 중 | 중 | `refund_requested` 잠금 + PG 멱등키 + RPC (SEQ-08) |
| RISK-05 | 회차 상태 불일치(구독 해지·취소 요청·발송 경합) | 중 | 중 | 상태 전이를 RPC 한 곳에서 조건부 `update … where status = …` (04 §상태 머신) |
| RISK-06 | 6자리 코드 추측·타 계정 코드 사용 | 중 | 중 | `crypto.randomInt` 생성, 코드 테이블은 책방지기만 열람(RLS), `unbox_round`에서 회차 소유자 검사(INV-08). 횟수 제한 없음은 Q-007 위험 수용 |
| RISK-07 | 관리자 권한 우회, 회원 간 데이터 열람(RLS 누락) | 중 | 높음 | 모든 테이블 RLS, `is_keeper()` 단일 함수, GATE-07 |
| RISK-08 | 언박싱 전 책 정보가 응답에 섞임(블라인드 깨짐) | 중 | 중 | 회원용 조회는 언박싱 여부로 컬럼을 고르는 뷰/RPC만 사용 (NFR-08, 03 §RLS) |
| RISK-09 | 주소록(개인정보 묶음) 다운로드 유출 | 낮음 | 높음 | 관리자 전용 Route Handler, 다운로드 기록 테이블, 화면 취급 안내 (ADR-007) |
| RISK-10 | 비밀키(`SUPABASE_SERVICE_ROLE_KEY`, PG 시크릿) 클라이언트 노출 | 중 | 높음 | `server-only` 모듈에서만 import, `NEXT_PUBLIC_` 금지, GATE-05·06 |
| RISK-11 | 네이버 로그인이 Supabase 기본 제공자가 아님 → M2 지연 | 높음 | 중 | ADR-003 |
| RISK-12 | 카카오 이메일 동의항목·네이버 검수 등 외부 심사 | 중 | 중 | 이메일 없이 로그인 가능한 구성(ADR-003), 시연은 개발 상태 + 테스트 계정 |
| RISK-13 | Cache Components 규칙 위반(세션 읽기 Suspense 밖) → 빌드 실패 | 높음 | 중 | CONV-07, GATE-04 |
| RISK-14 | 탈퇴 시 거래 기록과 사적인 글의 처리 누락 | 낮음 | 중 | RPC `withdraw_member` 한 곳 + FK `on delete` 정책 (03 §탈퇴) |
| RISK-15 | M4가 하루를 넘김 | 중 | 중 | HANDOFF에서 M4 티켓을 편지 → 서재 → 발송·언박싱 → 메모·해지 순으로 배치 |
| RISK-16 | 로컬 Supabase 없이 원격 1개를 개발·시연 공용으로 씀 → 잘못된 마이그레이션·테스트 데이터가 시연 DB에 남음 | 중 | 중 | ADR-005 개정: 적용 마이그레이션 수정 금지(새 파일로), `db reset` 금지, seed `on conflict do update`, pgTAP `begin … rollback`, `db push --dry-run` 후 사람이 적용 (AR-DB §8, GATE-07) |

## 4. 자가 점검 (A0·A1)
- D1: A0 검증과 A1 드라이버만 다룸. 결정은 ADR로 미룸.
- D2: 우선순위마다 근거 한 줄.
- D3: 확장성을 최하위로 두어 추상화 도입 기준을 낮춤.
- D4: 스킬 §A1 최소 리스크 6종 + Next 16·소셜 심사 리스크 포함.
- D5: 모든 행에 ID, 대응 위치를 문서·ID로 지정.
