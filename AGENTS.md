## 에이전트 파이프라인 규칙 (모든 작업에 적용)

이 저장소는 `PM → ARCH → DB → BE → FE → QA` (+ 횡단 UX) 에이전트 파이프라인으로 작업한다. 스킬을 쓰지 않는 작업에도 적용된다.

1. 문서 경로의 기준은 `docs/PIPELINE.md`(산출물 레지스트리) 하나다. 스킬 문서와 다르면 레지스트리를 따른다.
2. 파이프라인 단계 작업(기획·설계·DB·백엔드·프론트·QA·UX)은 해당 스킬(`pm-agent`, `architect-agent`, `db-agent`, `backend-agent`, `frontend-impl`, `qa-agent`, `ubuntubooks-uiux-domain`)을 로드해서 한다.
3. 작업 전 `node scripts/check-handoff.mjs <STAGE>`를 실행한다(DB·BE·FE·QA는 `--ticket <TKT>`를 붙여 HANDOFF 선행 티켓의 브리핑까지 확인). 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 STATUS 줄을 보고한 뒤 멈춘다. 사용자가 예외를 승인하면 `docs/PIPELINE.md` §2-5대로 기록한다.
4. 산출물은 레지스트리에서 `만드는 단계`가 내 단계인 경로에만 쓰고, 끝나면 `node scripts/check-handoff.mjs <STAGE> --post --ticket <TKT>`로 확인한다.
5. 순차 실행은 `scripts/run-stage.sh <STAGE> [TKT]`로 한다 (`docs/PIPELINE.md` §5).
6. 구현 단계(DB·BE·FE·QA)는 필수 범위 티켓(M2~M5, M7)을 먼저 구현한다. 도전 과제 티켓(M6, HANDOFF에 "요청 시" 표시: 동시성·백그라운드 작업·CSV·캐시)은 사용자가 티켓을 지정해 따로 요청할 때만 착수하고, 필수 티켓에 도전 범위를 미리 넣지 않는다(D-018).

## 디렉토리 지도

파일 전체를 탐색하기 전에 이 지도부터 본다. 구조는 발제(`docs/00-inputs/kant-rubric.md` §4.2) 기준이며, 파일 단위 트리와 규칙은 `docs/02-arch/05-structure-conventions.md`에 있다. 기능 폴더는 `auth`, `rooms` 두 개다(ADR-001).

| 경로 | 책임 |
|---|---|
| `pyproject.toml` · `uv.lock` · `.env.example` | 의존성(uv), ruff 설정, 환경변수 이름 |
| `src/main.py` | 앱 엔트리, lifespan(테이블 생성·시드), 미들웨어, 전역 예외 핸들러, 라우터·StaticFiles |
| `src/config.py` · `src/database.py` · `src/exceptions.py` | 설정(pydantic-settings) · AsyncEngine·`get_db()` · 도메인 예외 기반 클래스 |
| `src/seed.py` · `src/logging_middleware.py` | 초기 시드 · 요청 로깅 미들웨어 |
| `src/auth/` | 회원가입·OAuth2 로그인(JWT+쿠키)·블랙리스트 로그아웃·현재 회원 의존성 |
| `src/rooms/` | 2vs2 방 생성·참가·팀·나가기·게임 시작(해산), 목록·상세·이력 조회, 화면 라우트 |
| `src/<기능>/domain/` | 순수 파이썬 도메인 클래스·예외. 외부 라이브러리 import 금지 |
| `src/<기능>/infrastructure/` | `models.py`, `repositories.py`(ORM ↔ 도메인 변환, `FOR UPDATE`), auth만 `security.py` |
| `src/<기능>/application/` | `service.py`(변경·commit), rooms만 `queries.py`·`read_models.py`·`list_cache.py` |
| `src/<기능>/presentation/` | `schemas.py`, `router.py`(`/api`), `pages.py`(Jinja2 화면), auth만 `dependencies.py` |
| `src/templates/` · `src/static/` | Jinja2 화면, CSS·JS(폴링) |
| `tests/` | `unit/`(도메인), `integration/`(API), `concurrency/`(CH-A) |

| 단계 | 쓰는 곳 | 읽는 설계 문서 |
|---|---|---|
| DB | `src/database.py`, `src/<기능>/infrastructure/models.py`·`repositories.py`, `src/seed.py` | `03-db-schema.md`, `04-interfaces-api.md` §2, `HANDOFF.md` |
| BE | `src/<기능>/{domain,application,presentation}/`, `src/auth/infrastructure/security.py`, `src/main.py`, `src/config.py`, `src/exceptions.py`, `src/logging_middleware.py`, `pyproject.toml`, `.env.example` | `04-interfaces-api.md`, `05-structure-conventions.md`, `docs/03-db/briefing.md` |
| FE | `src/templates/`, `src/static/`, `README.md` | `04-interfaces-api.md` §7(PAGE), `07-screens.md`, `05-structure-conventions.md` |
| QA | `tests/`, `docs/06-qa/` | `06-quality-gates.md`, PM-AC |

설계 문서: `docs/02-arch/` (ADR은 `adr/`). 티켓: `docs/02-arch/HANDOFF.md`.
