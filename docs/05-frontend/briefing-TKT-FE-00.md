---
stage: FE
tickets: [TKT-FE-00]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-CONV, AR-GATE, AR-ADR]
next_readers: [QA, UX]
exception: { blocked: [BE-BRIEF], approved_by: user, date: 2026-10-21, read_instead: [] }
---
# [구조 정리] TKT-FE-00
결론: 완료 조건 GATE-01~06 모두 통과 · 기능 변경 없음 (화면·API 변화 0)

## 사람이 결정할 것
- 없음. `components/ui/*` 6개는 npm 패키지 `cn`을, `lib/utils.ts`는 `shared/utils/cn.ts`(clsx + tailwind-merge)를 쓴다. 두 구현을 그대로 유지하기로 사용자가 결정했다(2026-10-21). 사용처가 있어 패키지도 지우지 않았다(HANDOFF "사용처 0이면 제거").

## 절차 예외
- `node scripts/check-handoff.mjs FE` 결과는 `STATUS: BLOCKED_BY_MISSING BE-BRIEF`였다. TKT-FE-00은 HANDOFF에 선행 티켓이 없고 BE 결과를 쓰지 않는 구조 정리라, 사용자(2026-10-21) 승인으로 **이번 한 번만** BE-BRIEF 없이 진행했다. 규칙(`docs/PIPELINE.md`)은 바꾸지 않았다.
- UX 입력(UX-DESIGN·UX-CTX-FE·UX-PLAN-FE)은 화면 변경이 없어 읽지 않았다.

## 이해 가이드
- 데이터 흐름: 해당 없음 (화면·데이터 코드 변경 없음)
- 먼저 볼 파일: `package.json` — 스크립트·의존성 변경 / `.gitignore` — env·supabase 임시 파일 규칙 / `.env.example` — ADR-005 환경변수 목록

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| GATE-01 | `npx tsc --noEmit` 오류 0 | 충족 | exit 0 |
| GATE-02 | `npm run lint`(`eslint .`) 오류 0 | 충족 | exit 0 |
| GATE-03 | `npm test` 실패 0 | 충족 | tests 3 / pass 3 / fail 0 |
| GATE-04 | `npm run build` 종료 코드 0 | 충족 | exit 0 (`/`, `/_not-found`) |
| GATE-05 | `.env` 미추적, `NEXT_PUBLIC_`에 비밀값 없음, `node_modules`·`.next` 미추적 | 충족 | 각 0줄 |
| GATE-06 | 금지 패턴 grep | 충족 | 0줄 |

## 한 일
- 삭제: `src/shared/utils/cn.ts`, `domains/boards|categories|files/`, `shared/mocks/mockData.ts`, `public/file.svg`·`globe.svg`·`window.svg`
- `.gitignore`: `/uploads` 줄 삭제(사용처 0), `!.env.example`, `/supabase/.temp/`, `/supabase/.branches/` 추가
- `.env.example` 새로 작성: ADR-005 표의 변수 8개 + 용도 한 줄, 값 없음
- `package.json`: `lint` → `eslint .`, `test` 글롭 따옴표를 `'…'` → `\"…\"`로 변경
- 패키지: 제거 `react-icons`, `sass`(사용처 0) / 추가 `zod@^4.6.7`, `server-only@^0.0.1`, `@tosspayments/tosspayments-sdk@^2.10.0`
- `lib/utils.ts`: `cn` 재수출 대상을 패키지 `cn` → `@/shared/utils/cn`으로 변경(ADR-009). 이 파일의 import 사용처는 0이다

## 선택과 이유
- `public/next.svg`·`vercel.svg`는 남겼다. 아직 템플릿인 `app/page.tsx`가 쓰고 있어, 지우면 메인 이미지가 깨진다(기능 변경 없음 조건). TKT-FE-02에서 메인을 바꿀 때 함께 지운다.
- `eslint .`가 `docs/`의 `.mjs`까지 검사하지만 오류 0이라 검사 제외 설정은 추가하지 않았다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| `cn` 구현 2개 공존 | 사용자 결정으로 유지 | — |
| npm 11.19가 승인 목록(`allowScripts`)에 없는 `esbuild`·`unrs-resolver` postinstall을 실행하지 않음 | 두 패키지의 Windows용 바이너리(`@esbuild/win32-x64`, `@unrs/resolver-binding-win32-x64-msvc`)가 설치돼 있고 tsx 테스트·eslint 정상 동작 확인 | 바이너리 설치가 실패하는 환경(선택 의존성 생략 설치 등)에서만 `npm install-scripts approve` 검토 |
| 토스 SDK는 M3까지 사용처 0 | 설계(02 §2)대로 미리 추가 | — |

## 검증 결과
- GATE-01~06: 위 표 (모두 통과)
- 스크린샷: 해당 없음 (화면 변경 없음)
- audit(`npm audit --omit=dev`): high 7건, 모두 `shadcn` CLI의 하위 의존성(`fast-glob`→`micromatch`→`braces`, `ts-morph`). 변경 전에도 같은 7건이며 이번에 추가한 패키지에서 생긴 것은 0건

## 명세와 다르게 한 것
- `test` 스크립트 따옴표 수정: 티켓에 없지만, Windows(cmd)에서 작은따옴표가 그대로 넘어가 테스트 0건으로 "통과"하던 문제를 고쳤다(0건은 실패로 본다). 글롭 내용은 그대로다.
- `public/` 기본 SVG 5개 중 3개만 삭제(위 "선택과 이유").
- `.env.example`: HANDOFF는 TKT-FE-00, ADR-005는 TKT-DB-00을 작성 티켓으로 적었다. 이번에 ADR-005 표대로 만들었으니 DB-00은 확인만 하면 된다.
- `docs/02-arch/05-structure-conventions.md`는 `lib/utils.ts`가 `shared/utils/cn`을 재수출한다고 적고 있다. 이번 변경으로 문서와 일치한다.

## 기록 필요
- 없음

## 변경 범위
- 수정: `.gitignore`, `package.json`, `package-lock.json`, `lib/utils.ts` / 추가: `.env.example`, 이 브리핑 / 삭제: 위 목록
- 공통 파일: `components/ui/*`는 건드리지 않음
- 새 의존성: `zod`, `server-only`, `@tosspayments/tosspayments-sdk` (사용자 승인)

## 확인하지 못한 것
- `cn` 패키지(0.5.0)와 `shared/utils/cn.ts`의 클래스 병합 결과가 모든 경우에 같은지
- 비어 있는 로컬 `uploads/` 폴더는 Git 추적 대상이 아니라 그대로 두었다
