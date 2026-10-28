# ADR-005: 개발 도구 (린트·포맷·타입 검사)
- 상태: Accepted (user, 2026-10-28)
- 관련 계층: [인프라]
- 근거: GATE-05, DRV-C-06(13일 일정), 5인 협업

## 맥락
5명이 같은 저장소에 쓴다. 포맷 차이로 생기는 충돌과 쓰지 않는 import 같은 실수를 PR 전에 잡을 기준이 필요하다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 도구 없음 | 설정 0 | 포맷 충돌·실수가 리뷰로만 걸러짐 | 중 | 영향 없음 | 낮음 |
| B. ruff(린트 + 포맷) 하나, dev 그룹. `uv run ruff check src tests`, `uv run ruff format --check src tests` | 도구 하나로 두 역할, 빠름 | 타입 오류는 못 잡음 | 낮음 | 영향 없음 | 낮음 |
| C. ruff + mypy | 타입 오류까지 | SQLAlchemy·Pydantic 타입 설정 부담, 일정 압박 | 중 — 설정 디버깅 비용 | 영향 없음 | 중 |

## 계층 관점 설명
[인프라] `pyproject.toml`의 `[tool.ruff]`에 `line-length = 100`, `target-version = "py313"`, `[tool.ruff.lint] select = ["E", "F", "I", "B", "UP"]`. GATE-05가 두 명령을 실행한다.

## 결정 / 추천
결정: B — 비용이 가장 낮은 기준으로 충돌과 흔한 실수를 막는다.

## 결과
- 후속 작업: TKT-BE-M2-01, GATE-05
