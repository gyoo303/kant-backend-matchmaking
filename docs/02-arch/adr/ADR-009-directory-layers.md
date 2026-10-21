# ADR-009: 디렉토리·계층 구성 (기존 저장소 구조와 KANT 경로 정합)
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [레이어]
- 근거: DRV-C-02·03·08, →ARCH A-09, REQ-T05, `package.json` test 스크립트(`{app,domains,shared}/**/*.test.ts`), 하위 스킬(db/backend-agent)의 `lib/data`·`lib/supabase`·`lib/payments` 경로

## 맥락
저장소에는 `domains/<d>/types/*.types.ts`, `shared/utils/`, `components/ui/`, `lib/utils.ts` 패턴이 있고, 이전 템플릿 잔재(`domains/boards|categories|files`, `shared/mocks/mockData.ts`)와 금지된 `src/shared/utils/cn.ts`가 섞여 있다. 순수 규칙·I/O 어댑터를 어디에 둘지 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 순수 규칙·타입·스키마 = `domains/<d>/`, I/O 어댑터 = `lib/{supabase,data,payments,auth,http}/`, 공용 유틸 = `shared/utils/` | 기존 패턴 2개(`domains/`, `lib/`)를 그대로 이음. 기존 test 글롭이 `domains/` 테스트를 바로 잡음 | `lib/domain` 대신 `domains/` → 하위 스킬 기본 예시와 이름이 다름(AGENTS.md로 안내) | 낮음 | 없음 | 중 |
| B. 스킬 예시대로 `lib/domain/` + `lib/data/`… , `domains/`는 타입만 | 스킬 예시와 일치 | 도메인 코드가 두 폴더로 갈림, test 글롭에 `lib` 추가 필요 | 중: 탐색 범위 증가 | 없음 | 중 |

## 계층 관점 설명
```
app/ (라우트·Server Action·Route Handler)  ─→ components/ ─→ domains/<d>/ (순수)
   └─→ lib/auth, lib/payments ─→ lib/data ─→ lib/supabase      shared/utils (어디서나)
```
- `domains/`는 `types/`·`shared/utils` 외에는 import하지 않는다. `lib/data`만 Supabase 클라이언트를 쓴다.
- 정리: `domains/boards|categories|files`, `shared/mocks/mockData.ts`, `src/` 삭제(구조 정리 전용 커밋, CONV-15). `lib/utils.ts`는 shadcn 관례로 유지하되 `shared/utils/cn.ts`를 재수출.

## 결정
선택 **A** — 기존 저장소 구조를 기준으로 하고, 계층은 `app → domains / lib` 2단으로 유지한다.

## 결과
- 좋아지는 점: 새 최상위 폴더 0(`supabase/`는 Supabase CLI 고정 경로), 테스트 설정 변경 0
- 감수할 점: AGENTS.md에 "`lib/domain` 대신 `domains/`" 한 줄 명시
- 후속: TKT-FE-00(정리 커밋), AGENTS.md 디렉토리 지도
