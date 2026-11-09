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

1. **작업 시작 전**: `node scripts/check-handoff.mjs <내 코드>`를 실행한다. DB·BE·FE·QA는 `--ticket <TKT>`를 붙인다. 이 스크립트는 아래 표에서 `읽는 단계 (필수)`에 내 코드가 있는 행을 찾아 파일이 있는지, 브리핑 머리말이 `blocked`가 아닌지, 승인 대기 결정(`[PENDING]` D-xx, `Proposed` ADR)이 없는지 확인한다. 또 HANDOFF에서 그 티켓의 "선행" 티켓을 찾아 선행 티켓 단계의 브리핑(§3.4의 `선행` 행)을 필수로 확인한다. 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 줄을 보고한다. `선택`은 필요할 때 해당 ID 섹션만 읽는다.
2. **작업 후**: `만드는 단계`가 나인 경로에만 쓴다. 표에 없는 경로에 다음 단계가 읽어야 할 문서를 만들지 않는다. 새 문서가 필요하면 이 표에 행을 추가한다.
3. **브리핑**: DB·BE·FE·QA는 단계 폴더에 브리핑을 남긴다(§4 형식). PR 설명에 쓰는 내용도 같은 파일로 저장한다. PR 설명만으로는 다음 에이전트가 읽을 수 없다.
   - 파일이 하나인 단계(DB-BRIEF, BE-BRIEF)는 티켓마다 **같은 파일에 누적 갱신**한다. 이전 티켓의 내용을 지우지 않고 이번 티켓 내용을 덧붙이며, 머리말 `tickets`에서 기존 티켓을 지우지 않고 이번 티켓을 추가한다. `--ticket` 점검은 이 목록으로 선행 티켓 완료를 확인한다(§5.1).
   - 티켓마다 파일을 만드는 단계(FE-BRIEF, QA-BRIEF)는 `<TKT>` 자리에 티켓 ID를 넣은 새 파일을 만든다.
4. **수용기준 번호**: 모든 단계는 PM의 `AC-xx-n`, `NFR-xx`를 그대로 쓴다. 새 번호 체계를 만들지 않는다. UI/UX 명세 항목은 `UX-n`을 쓴다.
5. **예외 진행**: 점검이 `READY`가 아닌데 사용자가 진행을 승인하면, 막힌 입력이 이 티켓에 정말 필요한지와 대신 읽은 문서를 확인한 뒤 진행한다. 브리핑 머리말에 `exception`(§4)을, 본문에 "절차 예외" 칸(승인자·날짜·막힌 ID·이유)을 남긴다. 승인은 채팅이 아니라 이 기록으로 다음 단계에 전달된다.
6. **문서 우선순위**: 문서끼리 충돌하면 프로파일(`IN-PROFILE`)의 `고정` 제약 → PM 산출물 → ARCH 산출물 → 스킬 문서 순서로 따른다. 프로파일과 다른 문서가 어긋나면 에이전트가 임의로 고르지 않고 질문하며, 사람이 프로파일을 고친다. 어느 문서에도 정의되지 않은 것은 사용자 확인을 받은 뒤 진행한다. 스킬 문서의 예시·기본값은 프로젝트 사실이 아니다.
7. **사용자 확인 요청 형식**: 모든 단계에서 사용자에게 결정·확인을 요청할 때(결정 카드, ADR, 질문, 접수 확인, 미정 사항 확인) 이 형식을 쓴다.
   - 선택지마다 아래 네 가지를 **쉬운 말로** 2~4줄 쓴다.
     - 무엇이 달라지나: 이 선택지를 고르면 사용자·시스템에서 실제로 바뀌는 것
     - 좋은 점
     - 감수할 점
     - 나중에 바꾸기: 쉬움 / 보통 / 어려움 + 한 줄 이유
   - 쉬운 말 규칙: 내부 ID(`REQ-`, `TR-`, `ADR-` 등)와 내부 용어(AI 부채, 계층 관점 등)는 쓰지 않거나 괄호 안에 풀어 쓴다. 기술 용어는 처음 나올 때 한 줄로 설명하고, 가능하면 예를 든다.
   - 맨 끝에 추천과 이유를 한두 줄로 쓴다. 추천이 없으면 없다고 쓴다.
   - 선택지가 없는 확인(예: 판정표 확인)은 "확인하면 무엇이 정해지는지, 다르게 판단하면 무엇이 바뀌는지"를 쉬운 말로 요약한다.
   - **대화형**: 이 설명을 먼저 본문 텍스트로 출력한 뒤, 선택지 질문 도구가 있으면 도구로 묻는다. 도구의 선택지 설명 칸에는 한 줄 요약만 넣는다(칸이 좁아 장단점이 잘린다).
   - **헤드리스**: 같은 설명을 결정이 기록되는 파일(결정 카드·ADR·질문 섹션·브리핑)의 `쉬운 설명` 부분에 쓴다. 사람은 그 파일을 읽고 결정한다.

8. **산출물 갱신 등급**: 앞 태스크(또는 승인된) 산출물을 뒤 태스크가 고칠 때는 아래 등급을 따른다.
   - ① **채움·참조 갱신**(뒤 태스크에서 생긴 ID를 채우기, 이름으로 적어 둔 참조를 번호로 바꾸기 등, 내용 변화 없음): 바로 고치고 커밋 메시지에 적는다.
   - ② **세부 수정**(결정 내용은 그대로 두고 경로·항목·표현을 고침, 예: 승인된 ADR의 파일 경로, 승인된 트리에 폴더 추가): 고친 문서 끝 `## 개정` 줄에 날짜·내용·이유를 남기고, 다음 🔒 게이트나 최종 브리핑에서 사용자에게 알린다.
   - ③ **결정 변경**(선택한 옵션·규칙·범위가 바뀜): 다시 사용자 확인을 받는다. ADR은 새 ADR을 쓰고 이전 것은 `Superseded by ADR-xxx`로 둔다. 결정 카드는 `decision-log.md`에 번복 한 줄을 남긴다.
   - 다른 단계의 산출물은 이 등급과 상관없이 고치지 않는다(만드는 단계만 고친다).

## 3. 산출물 표

### 3.1 입력 원본 (사람이 작성, 에이전트는 읽기만)
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| IN-PROFILE | `docs/00-inputs/project-profile.md` (프로젝트 프로파일: 입력 문서 목록·제약 대장·일정·평가 기준, 형식은 `.claude/skills/pm-agent/references/project-profile-template.md`) | 사람 | PM, ARCH | — |
| SK-PACK | `.claude/skills/pm-agent/references/packs/<name>.md` (특성별 팩, 카탈로그의 "팩" 칸이 가리키는 파일만 읽는다) | 사람 | — | PM, ARCH |
| SK-TRAIT | `.claude/skills/pm-agent/references/trait-catalog.md` (프로젝트 특성 카탈로그, 스킬 부속 문서) | 사람 | PM, ARCH | — |
| UX-BASE | `docs/uiux/domain/base/` | 사람 | UX | — |
| UX-TPL | `docs/uiux/domain/templates/` (UX-BASE 작성 가이드, 예시 문장은 근거로 쓰지 않음) | 사람 | — | — |

> 요구사항 원문·외부 평가 기준·참고 자료 같은 그 밖의 입력 문서는 이 표가 아니라 프로파일 §2 입력 문서 표에 ID·경로·역할로 등록한다(`docs/00-inputs/` 아래에 둔다). 점검 스크립트는 프로파일이 있는지만 확인하고, 목록의 파일이 있는지는 PM 0단계가 확인한다. 목록에 없는 파일은 에이전트가 근거로 쓰지 않는다.

### 3.2 PM
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| PM-INTAKE | `docs/01-pm/00-intake.md` (프로젝트 분류, 특성 TR 판정표) | PM | — | ARCH |
| PM-INV | `docs/01-pm/01-requirements-inventory.md` | PM | — | ARCH, UX |
| PM-ASM | `docs/01-pm/02-assumptions-questions.md` | PM | ARCH (`→ARCH` 이관) | — |
| PM-DOMAIN | `docs/01-pm/03-domain.md` | PM | — | ARCH, DB, BE, QA, UX |
| PM-SCOPE | `docs/01-pm/04-scope.md` (상단 Architect 요약 블록) | PM | ARCH | — |
| PM-US | `docs/01-pm/05-user-stories.md` | PM | — | ARCH, BE, FE, UX |
| PM-AC | `docs/01-pm/06-acceptance-criteria.md` | PM | FE, QA | ARCH, DB, BE, UX |
| PM-SCR | `docs/01-pm/07-screens.md` | PM | FE | ARCH, UX |
| PM-TRACE | `docs/01-pm/08-traceability.md` | PM (ARCH가 이관 행 갱신) | — | ARCH, QA |
| PM-DEC | `docs/01-pm/decision-log.md` | PM, ARCH(`[자율][ARCH]`) | — | 전체 |

### 3.3 ARCH
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| AR-MAP | `AGENTS.md` (저장소 루트, `## 디렉토리 지도` 섹션) | ARCH | DB, BE, FE, QA | — |
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
| DB-BRIEF | `docs/03-db/briefing.md` | DB | 선행 | QA |
| BE-BRIEF | `docs/04-backend/briefing.md` | BE | 선행 | QA |
| FE-BRIEF | `docs/05-frontend/briefing-<TKT>.md` | FE | 선행 | UX (검수 시) |
| QA-BRIEF | `docs/06-qa/briefing-<TKT 또는 브랜치>.md` | QA | 선행 | UX, 사람 |

> `선행` = 점검하는 티켓의 HANDOFF "선행" 열에 이 단계 티켓이 있을 때만 필수다. 예: TKT-FE-01(선행 TKT-DB-01)은 DB-BRIEF, TKT-FE-M2-01(선행 TKT-BE-M2-01)은 BE-BRIEF가 필수다. 브리핑 하나를 여러 티켓이 함께 쓰는 단계(DB·BE)는 머리말 `tickets`에 선행 티켓이 있어야 통과한다.

### 3.5 UX (횡단)
| ID | 경로 | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |
|---|---|---|---|---|
| UX-KNOW | `docs/uiux/domain/knowledge.md` | UX | — | PM |
| UX-OPENQ | `docs/uiux/domain/open-questions.md` | UX | — | PM |
| UX-PERSONA | `docs/uiux/review/QA/scenarios.md` (§1 페르소나 P1~P3) | UX | — | PM, FE, QA |
| UX-DESIGN | `docs/uiux/review/frontend/design-system.md` | UX | FE | QA |
| UX-DEC | `docs/uiux/decisions.md` | UX | FE | PM, QA |
| UX-CTX-ORCH | `docs/uiux/context/for-orchestrator.md` | UX | — | ARCH |
| UX-CTX-FE | `docs/uiux/review/frontend/README.md` (§2 페르소나 요약, §3 `UX-n` 정의) | UX | FE | — |
| UX-CTX-QA | `docs/uiux/review/QA/README.md` (§2·§3 사용성 검증 범위, `UX-n` 확인 방법) | UX | QA | — |
| UX-REVIEW | `docs/uiux/review/` (검수 대상 단계별 하위 폴더 `PM/`, `ARCH/`, `FE/`, `QA/`에 `YYYY-MM-DD-<대상>.md`) | UX | — | 검수 대상 단계 |
| UX-USAB | `docs/uiux/usability/YYYY-MM-DD-round<N>.md` | UX | — | QA, PM |
| UX-PLAN-FE | `docs/uiux/review/frontend/README.md` (같은 폴더의 `design-system.md`, `screens.md`, 화면별 시안 `mockups/*.png`를 함께 읽는다) | UX | FE | QA |
| UX-PLAN-QA | `docs/uiux/review/QA/README.md` (같은 폴더의 `scenarios.md`를 함께 읽는다) | UX | QA | — |

> UX 단계를 쓸지는 프로젝트마다 정한다(프로파일 제약 대장). 쓰지 않는 프로젝트에서도 아래 UX 행은 남겨 둔다.
> UX 산출물은 사람 승인 후에 배포된다(UX 스킬 R3). 아직 없으면 `필수`라도 `BLOCKED`로 멈추지 않고, 브리핑의 "확인하지 못한 것"에 `<ID> 미배포`로 적고 진행한다.
> 승인 전 초안은 같은 폴더에 `<파일명>.draft.md`로 둔다. 다른 단계는 `.draft.md`를 읽지 않는다(UX 스킬 §7).
> UX-PLAN-FE·UX-PLAN-QA는 FE·QA가 계획을 세울 때 읽는 참고자료 묶음이다. `review/` 아래에 있지만 검수 기록(UX-REVIEW)이 아니다. `review/QA/`의 `YYYY-MM-DD-<대상>.md`는 QA 산출물 검수 기록, `README.md`·`scenarios.md`는 UX-PLAN-QA다.
> UX-CTX-FE·UX-DESIGN은 UX-PLAN-FE 묶음 안에, UX-CTX-QA·UX-PERSONA는 UX-PLAN-QA 묶음 안에 들어 있다. 별도 파일(`personas.md`, `design-principles.md`, `context/for-frontend.md`, `context/for-qa.md`)은 만들지 않는다. 같은 내용을 두 곳에 두지 않기 위해서다.

### 3.6 결정 기록 (어디에 무엇을)
| 종류 | 위치 |
|---|---|
| 범위·요구사항 결정 (`D-xx`), Architect 자율 결정 (자율 결정은 선택지·권장 이유·trade-off 포함, `pm-agent` §4.3) | `docs/01-pm/decision-log.md` |
| 기술·아키텍처 결정 (`ADR-xxx`) | `docs/02-arch/adr/` |
| 구현·검증 단계의 자율 결정 (DB·BE·FE·QA, 같은 형식) | 각 단계 브리핑의 "구현 중 자율 결정"·"QA 자율 결정" 섹션 |
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
# 예외로 진행했을 때만 (§2-5). 없으면 줄을 쓰지 않는다
exception: { blocked: [BE-BRIEF], approved_by: user, date: 2026-10-21, read_instead: [DB-BRIEF] }
---
```
- `exception`: 점검이 막혔는데 사용자 승인으로 진행한 경우의 기록. `blocked`는 막힌 ID, `read_instead`는 대신 읽은 입력(없으면 `[]`).

## 5. 실행 방법

### 5.1 점검 스크립트 — `scripts/check-handoff.mjs`
이 문서의 표를 그대로 파싱한다. 표에 행을 추가하면 스크립트도 자동으로 따라간다(표 형식 `| ID | \`경로\` | 만드는 단계 | 읽는 단계 (필수) | 읽는 단계 (선택) |`은 유지한다).

```bash
node scripts/check-handoff.mjs BE --ticket TKT-BE-M2-01
```

```bash
node scripts/check-handoff.mjs BE --post --ticket TKT-BE-M2-01
```

- DB·BE·FE·QA의 실행 전 점검은 `--ticket`이 없으면 `STATUS: BLOCKED_BY_MISSING TICKET`으로 멈춘다. PM·ARCH·UX는 `--ticket` 없이 실행한다.
- 선행 티켓은 `docs/02-arch/HANDOFF.md` 표의 마지막 열("선행")에서 읽는다. 이 열은 전체 티켓 ID(`TKT-DB-01`)를 쉼표로 나열하고, 없으면 `—`로 쓴다. HANDOFF 표의 열 순서를 바꾸면 스크립트(`readPredecessors`)도 같이 고친다.

| 마지막 줄 | 의미 | 종료 코드 |
|---|---|---|
| `STATUS: READY <STAGE>` | 필수 입력 모두 있음, 시작 가능 | 0 |
| `STATUS: BLOCKED_BY_MISSING <ID…>` | 필수 입력 없음·미작성·`status: blocked` | 1 |
| `STATUS: AWAITING_USER_DECISION <ID…>` | ARCH 전 `[PENDING]` D-xx, 또는 DB·BE·FE·QA 전 `Proposed` ADR | 1 |
| `STATUS: DONE <STAGE>` / `STATUS: INCOMPLETE <STAGE> <ID…>` | (`--post`) 산출물 확인 결과 | 0 / 1 |

- 자리표시자(`<TKT>`, `<slug>`, `xxx`, `YYYY-MM-DD`)가 있는 경로는 "해당 이름의 파일이 하나 이상 있는가"로 본다. `--post --ticket`을 주면 `<TKT>` 자리에 티켓 ID를 넣어 정확히 그 파일을 확인한다.
- UX가 만드는 산출물은 없어도 막지 않고 경고만 한다(§3.5).
- `만드는 단계` 칸에 단계가 여럿 적힌 행(부가 설명 속 단계 포함, 예: PM-TRACE `PM (ARCH가 이관 행 갱신)`, PM-DEC)은 적힌 모든 단계의 `--post`에서 점검한다. 의도한 동작이다.

**수동 점검 (Node가 없어 스크립트를 실행할 수 없을 때)**: 스크립트와 같은 항목을 직접 확인하고, 같은 형식의 STATUS 줄 뒤에 `(수동 점검)`을 붙여 보고한다.
- 실행 전
  1. 레지스트리에서 `읽는 단계 (필수)`에 내 단계가 있는 행의 파일이 있는지 확인한다. 자리표시자 경로는 그 이름의 파일이 하나 이상 있으면 된다. `AGENTS.md`는 `## 디렉토리 지도` 제목이 있어야 한다. 브리핑 파일은 머리말이 있고 `status: blocked`가 아니어야 한다.
  2. (DB·BE·FE·QA) `HANDOFF.md` 티켓 표에서 내 티켓의 "선행" 열에 있는 티켓마다, 그 단계의 브리핑이 있고 `blocked`가 아니며 머리말 `tickets`에 그 티켓이 있는지 확인한다.
  3. 승인 대기 결정을 확인한다: ARCH 전에는 `docs/01-pm/decision-log.md`의 `[PENDING]` D-xx, DB·BE·FE·QA 전에는 `docs/02-arch/adr/`의 `상태: Proposed`. 있으면 `STATUS: AWAITING_USER_DECISION <ID…>`.
- 실행 후 (`--post`): 레지스트리에서 `만드는 단계`에 내 단계가 있는 모든 행의 파일이 있는지, 실행 전 1번의 제목·머리말 조건을 만족하는지 확인한다. `--ticket`이면 `<TKT>` 자리에 티켓 ID를 넣는다. 결과는 `STATUS: DONE <STAGE> (수동 점검)` 또는 `STATUS: INCOMPLETE <STAGE> <ID…> (수동 점검)`.

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
| 2 | 에이전트가 `STATUS:` 줄을 남기고 멈춤 (결정 카드·ADR·접수 확인·질문 대기 등) | 결정 카드는 `decision-log.md`의 `[PENDING]`을 `[APPROVED by user, …]`로, ADR은 `Accepted`로 바꾼다. `INTAKE`는 `docs/01-pm/00-intake.md`의 판정표를 검토하고 첫 줄을 `상태: 확인됨 (날짜, 확인자)`로 바꾼다. `Q-xx`는 해당 질문 파일의 답변 섹션에 답을 적는다. 그 뒤 같은 명령 재실행 |
| 3 | 실행은 끝났지만 산출물이 레지스트리와 다름 | 출력된 ID 확인 후 같은 명령 재실행 |

- 실행 로그는 `.pipeline-logs/`에 남는다(Git 제외).
- `CLAUDE_ARGS`로 `claude -p` 옵션을 바꿀 수 있다(기본 `--permission-mode acceptEdits`). 빌드·테스트 명령까지 허용하려면 `--allowedTools`를 추가한다.
- 대화형으로 실행할 때는 Claude Code에서 `/db-agent TKT-DB-01`처럼 스킬을 직접 호출한다. 스킬 맨 위 0단계가 같은 점검을 수행한다.

### 5.3 기본 실행 순서
```
PM (P0~P9, 🔒마다 멈춤·재실행) → ARCH (A0~A8) → [마일스톤마다] HANDOFF 티켓 표의 "선행" 열 순서대로 DB·BE·FE·QA 티켓 실행
UX: PM 전에 컨텍스트 팩 배포, FE 이후 검수 (순서 밖에서 필요할 때 실행)
```
