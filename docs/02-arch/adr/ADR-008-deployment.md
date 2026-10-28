# ADR-008: 실행·배포 구성 (도전 C, Could)
- 상태: Accepted (user, 2026-10-28)
- 관련 계층: [인프라]
- 근거: D-002, D-018, US-20, AC-20-3, CH-C, DRV-C-02

## 맥락
도전 C는 환경변수 분리와 프로덕션 실행 구성을 요구한다. 외부 배포는 범위 밖이다(REQ-129). 목록 캐시가 프로세스 내 dict다(ADR-007).

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 컨테이너 없음. 프로덕션 실행 `uv run uvicorn main:app --app-dir src --host 0.0.0.0 --port 8000 --workers 1`(`--reload` 없음), 설정은 환경변수만(ADR-003), README에 개발·시연 실행을 따로 적음 | 설정 최소, 시연 PC에서 바로 실행 | PostgreSQL은 각자 설치 | 낮음 | 충족 | 낮음 |
| B. A + `docker-compose.yml`(PostgreSQL만) | DB 준비가 명령 하나 | Docker 설치 필요, 파일 1개 추가 | 낮음 | 충족 | 낮음 |

## 계층 관점 설명
[인프라] 워커는 1개로 고정한다(프로세스 내 캐시 일관성). `COOKIE_SECURE`는 HTTPS 환경에서만 true.

## 결정 / 추천
결정: A — 외부 배포가 없는 시연 범위에서 가장 단순하다.

## 결과
- 후속 작업: TKT-FE-M7-01(README 실행 방법), TKT-BE-M6-02
