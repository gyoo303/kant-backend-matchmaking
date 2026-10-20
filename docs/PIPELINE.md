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

1. **작업 시작 전**: 아래 표에서 `읽는 단계`에 내 코드가 있는 행을 모두 찾는다. `필수`인 파일이 없으면 작업을 시작하지 않고 `STATUS: BLOCKED_BY_MISSING <ID 목록>`으로 보고한다. `선택`은 필요할 때 해당 ID 섹션만 읽는다.
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
| FE-BRIEF | `docs/05-frontend/briefing-<TKT>.md` | FE | QA, UX | — |
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
