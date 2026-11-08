## 에이전트 파이프라인 규칙 (모든 작업에 적용)

이 저장소는 `PM → ARCH → DB → BE → FE → QA` (+ 횡단 UX) 에이전트 파이프라인으로 작업한다. 스킬을 쓰지 않는 작업에도 적용된다.

1. 문서 경로의 기준은 `docs/PIPELINE.md`(산출물 레지스트리) 하나다. 스킬 문서와 다르면 레지스트리를 따른다.
2. 파이프라인 단계 작업(기획·설계·DB·백엔드·프론트·QA·UX)은 해당 스킬(`pm-agent`, `architect-agent`, `db-agent`, `backend-agent`, `frontend-impl`, `qa-agent`, UX 스킬)을 로드해서 한다. 어떤 단계를 쓸지(예: UX 단계 사용 여부)는 프로젝트 프로파일(`docs/00-inputs/project-profile.md`) 제약 대장을 따른다.
3. 작업 전 `node scripts/check-handoff.mjs <STAGE>`를 실행한다(DB·BE·FE·QA는 `--ticket <TKT>`를 붙여 HANDOFF 선행 티켓의 브리핑까지 확인). 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 STATUS 줄을 보고한 뒤 멈춘다. 사용자가 예외를 승인하면 `docs/PIPELINE.md` §2-5대로 기록한다.
4. 산출물은 레지스트리에서 `만드는 단계`가 내 단계인 경로에만 쓰고, 끝나면 `node scripts/check-handoff.mjs <STAGE> --post`로 확인한다(DB·BE·FE·QA는 `--ticket <TKT>`를 붙인다).
5. 순차 실행은 `scripts/run-stage.sh <STAGE> [TKT]`로 한다 (`docs/PIPELINE.md` §5).
6. 구현 단계(DB·BE·FE·QA)는 HANDOFF에 "요청 시" 표시가 없는 티켓을 먼저 구현한다. "요청 시" 티켓(프로파일 범위 등급의 하위 등급)은 사용자가 티켓을 지정해 따로 요청할 때만 착수하고, 다른 티켓에 그 범위를 미리 넣지 않는다.
7. 문서끼리 충돌하면 **프로파일의 `고정` 제약 → PM 산출물(`docs/01-pm/`) → ARCH 산출물(`docs/02-arch/`, 이 파일) → 스킬 문서** 순서로 따르고, 충돌 내용을 브리핑에 적는다. 단, PM 문서가 "후보"로 표시한 코드 식별자(클래스·메서드 이름 등)는 ARCH가 확정한 이름을 쓴다(충돌이 아니라 확정). 어느 문서에도 정의되지 않은 것은 스킬의 예시·기본값이나 추측으로 채우지 않고 **반드시 사용자에게 확인**한다(헤드리스: `STATUS: AWAITING_USER_DECISION <미정 항목>` 출력 후 종료).
8. 프로젝트 고유 규칙(코드 수준 기준, 특정 결정·마일스톤에 묶인 규칙 등)은 이 섹션에 두지 않는다. 프로파일 제약(C-ID)이나 ARCH 산출물(ADR, `05-structure-conventions.md`)에 두고, ARCH가 이 파일의 디렉토리 지도 섹션에서 위치를 안내한다.

<!-- 디렉토리 지도 섹션(제목 "디렉토리 지도", h2)은 ARCH가 A6에서 프로젝트 설계에 맞춰 만든다. 섹션이 없으면 DB·BE·FE·QA 점검(AR-MAP)이 막힌다. -->
