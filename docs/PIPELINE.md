# 소프트웨어 팩토리 파이프라인 — 산출물 레지스트리

모든 에이전트 산출물의 경로는 **이 문서 한 곳에서만** 정한다. 스킬 문서(`.claude/skills/*/SKILL.md`)와 이 표가 다르면 이 표를 따른다.
경로를 바꿀 때는 이 표를 먼저 고치고, 같은 커밋에서 해당 스킬 문서를 맞춘다.

## 1. 단계

```
[PM] → [ARCH] → [DB] → [BE] → [FE] → [QA] → 사람 확인 → PR merge
                  [UX] (횡단: 컨텍스트 팩 제공 + 검수)
```

| 코드 | 에이전트 (스킬) | 산출 폴더 | UI/UX 문서의 번호 |
|---|---|---|---|
| PM | `pm-agent` | `docs/01-pm/` | ① 메인 오케스트레이터 |
| ARCH | `architect-agent` | `docs/02-arch/` (+ 루트 `AGENTS.md`) | ① 메인 오케스트레이터 |
| DB | `db-agent` | `docs/03-db/` | ② |
| BE | `backend-agent` | `docs/04-backend/` | ③ |
| FE | `frontend-impl` | `docs/05-frontend/` | ④ |
| QA | `qa-agent` | `docs/06-qa/` | ⑤ |
| UX | `ubuntubooks-uiux-domain` | `docs/uiux/` | ⑥ |

## 2. 사용 규칙

1. **작업 시작 전**: `node scripts/check-handoff.mjs <내 코드>`를 실행한다. 이 스크립트는 아래 표에서 `읽는 단계 (필수)`에 내 코드가 있는 행을 찾아 파일이 있는지, 브리핑 머리말이 `blocked`가 아닌지, 승인 대기 결정(`[PENDING]` D-xx, `Proposed` ADR)이 없는지 확인한다. 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 줄을 보고한다. `선택`은 필요할 때 해당 ID 섹션만 읽는다.
2. **작업 후**: `만드는 단계`가 나인 경로에만 쓴다. 표에 없는 경로에 다음 단계가 읽어야 할 문서를 만들지 않는다. 새 문서가 필요하면 이 표에 행을 추가한다.
3. **브리핑**: DB·BE·FE·QA는 단계 폴더에 브리핑을 남긴다(§4 형식). PR 설명에 쓰는 내용도 같은 파일로 저장한다. PR 설명만으로는 다음 에이전트가 읽을 수 없다.
4. **수용기준 번호**: 모든 단계는 PM의 `AC-xx-n`, `NFR-xx`를 그대로 쓴다. 새 번호 체계를 만들지 않는다. UI/UX 명세 항목은 `UX-n`을 쓴다.

## 3. 산출물 표

### 3.1 입력 원본 (사람이 작성, 에이전트는 읽기만)
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| IN-REQ | `docs/00-inputs/ubuntubooks-user-requirements-raw.md` | 사람 | PM | — |
| IN-KANT | `docs/00-inputs/kant-rubric.md` | 사람 | PM | ARCH, QA |
| UX-BASE | `docs/uiux/domain/base/` | 사람 | UX | — |

### 3.2 PM
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| PM-INV | `docs/01-pm/01-requirements-inventory.md` | PM | — | ARCH |
| PM-ASM | `docs/01-pm/02-assumptions-questions.md` | PM | ARCH (`→ARCH` 이관) | — |
| PM-DOMAIN | `docs/01-pm/03-domain.md` | PM | — | ARCH, DB, BE, QA |
| PM-SCOPE | `docs/01-pm/04-scope.md` (상단 Architect 요약 블록) | PM | ARCH | — |
| PM-US | `docs/01-pm/05-user-stories.md` | PM | — | ARCH, BE, FE |
| PM-AC | `docs/01-pm/06-acceptance-criteria.md` | PM | FE, QA | ARCH, DB, BE |
| PM-SCR | `docs/01-pm/07-screens.md` | PM | FE | ARCH, UX |
| PM-KANT | `docs/01-pm/08-kant-traceability.md` | PM (ARCH가 이관 행 갱신) | — | ARCH, QA |
| PM-DEC | `docs/01-pm/decision-log.md` | PM, ARCH(`[자율][ARCH]`) | — | 전체 |

### 3.3 ARCH
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| AR-MAP | `AGENTS.md` (저장소 루트, Next.js 자동 블록 아래 섹션) | ARCH | DB, BE, FE, QA | — |
| AR-DRV | `docs/02-arch/01-drivers.md` | ARCH | — | QA |
| AR-SYS | `docs/02-arch/02-system-architecture.md` | ARCH | — | DB, BE |
| AR-DB | `docs/02-arch/03-db-schema.md` | ARCH | DB | BE, QA |
| AR-API | `docs/02-arch/04-interfaces-api.md` | ARCH | BE, FE | QA |
| AR-CONV | `docs/02-arch/05-structure-conventions.md` | ARCH | DB, BE, FE | QA |
| AR-GATE | `docs/02-arch/06-quality-gates.md` | ARCH | DB, BE, FE, QA | — |
| AR-ADR | `docs/02-arch/adr/ADR-xxx-<slug>.md` | ARCH | 티켓에 적힌 ADR만 | — |
| AR-HAND | `docs/02-arch/HANDOFF.md` (TKT-DB/BE/FE/QA) | ARCH | DB, BE, FE, QA | — |

### 3.4 구현·검증 단계 브리핑
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| DB-BRIEF | `docs/03-db/briefing.md` | DB | BE | QA |
| DB-TYPES | `types/database.ts` | DB | BE | FE |
| BE-BRIEF | `docs/04-backend/briefing.md` | BE | FE | QA |
| FE-BRIEF | `docs/05-frontend/briefing-<TKT>.md` | FE | QA | UX (검수 시) |
| QA-BRIEF | `docs/06-qa/briefing-<TKT 또는 브랜치>.md` | QA | — | UX, 사람 |

### 3.5 UX (횡단)
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| UX-KNOW | `docs/uiux/domain/knowledge.md` | UX | — | PM |
| UX-OPENQ | `docs/uiux/domain/open-questions.md` | UX | — | PM |
| UX-PERSONA | `docs/uiux/personas.md` | UX | — | PM, FE, QA |
| UX-DESIGN | `docs/uiux/design-principles.md` | UX | FE | QA |
| UX-DEC | `docs/uiux/decisions.md` | UX | FE | PM, QA |
| UX-CTX-ORCH | `docs/uiux/context/for-orchestrator.md` | UX | PM | ARCH |
| UX-CTX-FE | `docs/uiux/context/for-frontend.md` | UX | FE | — |
| UX-CTX-QA | `docs/uiux/context/for-qa.md` | UX | QA | — |
| UX-REVIEW | `docs/uiux/reviews/YYYY-MM-DD-<대상>.md` | UX | — | 검수 대상 단계 |
| UX-USAB | `docs/uiux/usability/YYYY-MM-DD-round<N>.md` | UX | — | QA, PM |

> UX 산출물은 사람 승인 후에 배포된다(UX 스킬 R3). 아직 없으면 `필수`라도 `BLOCKED`로 멈추지 않고, 브리핑의 "확인하지 못한 것"에 `<ID> 미배포`로 적고 진행한다.

### 3.6 결정 기록 (어디에 무엇을)
| 종류 | 위치 |
|---|---|
| 범위·요구사항 결정 (`D-xx`), Architect 자율 결정 | `docs/01-pm/decision-log.md` |
| 기술·아키텍처 결정 (`ADR-xxx`) | `docs/02-arch/adr/` |
| UX·디자인 결정 | `docs/uiux/decisions.md` |

## 4. 브리핑 공통 머리말

DB·BE·FE·QA 브리핑 파일은 맨 위에 아래 블록을 둔다. 다음 단계는 이 블록만 보고 읽을지 판단한다.

```yaml
---
stage: BE                 # PM | ARCH | DB | BE | FE | QA | UX
tickets: [TKT-BE-01]
status: done              # done | blocked | partial
inputs_read: [AR-HAND, AR-API, AR-CONV, AR-GATE, DB-BRIEF]
next_readers: [FE, QA]
---
```

## 5. 실행 방법

### 5.1 점검 스크립트 — `scripts/check-handoff.mjs`
이 문서의 표를 그대로 파싱한다. 표에 행을 추가하면 스크립트도 자동으로 따라간다(표 형식 `| ID | \`경로\` | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |`은 유지한다).

```bash
node scripts/check-handoff.mjs BE
```

```bash
node scripts/check-handoff.mjs BE --post --ticket TKT-BE-01
```

| 마지막 줄 | 의미 | 종료 코드 |
|---|---|---|
| `STATUS: READY <STAGE>` | 필수 입력 모두 있음, 시작 가능 | 0 |
| `STATUS: BLOCKED_BY_MISSING <ID…>` | 필수 입력 없음·미작성·`status: blocked` | 1 |
| `STATUS: AWAITING_USER_DECISION <ID…>` | ARCH 전 `[PENDING]` D-xx, 또는 DB·BE·FE·QA 전 `Proposed` ADR | 1 |
| `STATUS: DONE <STAGE>` / `STATUS: INCOMPLETE <STAGE> <ID…>` | (`--post`) 산출물 확인 결과 | 0 / 1 |

- 자리표시자(`<TKT>`, `<slug>`, `xxx`, `YYYY-MM-DD`)가 있는 경로는 "해당 이름의 파일이 하나 이상 있는가"로 본다. `--post --ticket`을 주면 `<TKT>` 자리에 티켓 ID를 넣어 정확히 그 파일을 확인한다.
- UX가 만드는 산출물은 없어도 막지 않고 경고만 한다(§3.5).

### 5.2 단계 실행 — `scripts/run-stage.sh`
입력 점검 → `claude -p`로 해당 스킬 실행 → 산출물 점검을 한 번에 한다. 앞 단계가 실패하면 다음 단계로 가지 않는다.

```bash
scripts/run-stage.sh PM
```

```bash
scripts/run-stage.sh DB TKT-DB-01
```

| 종료 코드 | 의미 | 할 일 |
|---|---|---|
| 0 | 완료 | 브리핑 확인 후 다음 단계 실행 |
| 1 | 입력 부족 또는 승인 대기로 시작하지 않음 | 출력된 ID의 앞 단계 산출물을 채우거나 결정을 승인 |
| 2 | 에이전트가 `STATUS:` 줄을 남기고 멈춤 (결정 카드·ADR 승인 대기 등) | `decision-log.md`의 `[PENDING]`을 `[APPROVED by user, …]`로, ADR을 `Accepted`로 바꾼 뒤 같은 명령 재실행 |
| 3 | 실행은 끝났지만 산출물이 레지스트리와 다름 | 출력된 ID 확인 후 같은 명령 재실행 |

- 실행 로그는 `.pipeline-logs/`에 남는다(Git 제외).
- `CLAUDE_ARGS`로 `claude -p` 옵션을 바꿀 수 있다(기본 `--permission-mode acceptEdits`). 빌드·테스트 명령까지 허용하려면 `--allowedTools`를 추가한다.
- 대화형으로 실행할 때는 Claude Code에서 `/db-agent TKT-DB-01`처럼 스킬을 직접 호출한다. 스킬 맨 위 0단계가 같은 점검을 수행한다.

### 5.3 기본 실행 순서
```
PM (P1~P9, 🔒마다 멈춤·재실행) → ARCH (A0~A8) → [마일스톤마다] DB 티켓들 → BE 티켓들 → FE 티켓들 → QA 티켓
UX: PM 전에 컨텍스트 팩 배포, FE 이후 검수 (순서 밖에서 필요할 때 실행)
```
