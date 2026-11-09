# 에이전트 파이프라인 템플릿

사용자 요구사항에서 기획 → 설계 → 구현 → 검증까지를 Claude 에이전트 단계로 나눠 진행하기 위한 저장소입니다. 아직 특정 프로젝트의 코드는 없습니다.

> 프로젝트를 시작하면 이 파일은 ARCH 단계가 정한 README 티켓에서 그 프로젝트의 README로 바뀝니다.

## 단계

```
PM → ARCH → DB → BE → FE → QA → 사람 확인 → PR merge
```

| 단계 | 스킬 | 하는 일 |
|---|---|---|
| PM | `pm-agent` | 프로젝트 분류(특성 판정), 요구사항 정리, 질문, 도메인·범위·스토리·수용 기준 |
| ARCH | `architect-agent` | 드라이버, ADR, 데이터·인터페이스 설계, 구조·컨벤션, 품질 게이트, 구현 티켓 |
| DB·BE·FE·QA | `db-agent` 등 | ARCH 티켓 단위 구현과 검증 |

## 시작하는 법

1. `.claude/skills/pm-agent/references/project-profile-template.md`를 `docs/00-inputs/project-profile.md`로 복사해 채웁니다(입력 문서 목록, 제약 대장, 일정·팀 등).
2. 요구사항 원문 등 입력 문서를 `docs/00-inputs/`에 두고 프로파일 §2에 등록합니다.
3. Claude Code에서 `pm-agent` 스킬로 PM 단계를 시작합니다. 결정이 필요한 곳에서는 선택지별 장단점을 쉬운 말로 보여 주고 묻습니다.

## 기준 문서

- `AGENTS.md`: 모든 에이전트가 따르는 파이프라인 규칙
- `docs/PIPELINE.md`: 산출물 경로 레지스트리, 사용 규칙, 점검·실행 방법
- `.claude/skills/pm-agent/references/`: 프로파일 템플릿, 특성 카탈로그, 특성별 팩
- `scripts/check-handoff.mjs`, `scripts/run-stage.sh`: 단계 입력·산출물 점검과 순차 실행 (Node 필요)
