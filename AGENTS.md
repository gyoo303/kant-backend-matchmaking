## 에이전트 파이프라인 규칙 (모든 작업에 적용)

이 저장소는 `PM → ARCH → DB → BE → FE → QA` (+ 횡단 UX) 에이전트 파이프라인으로 작업한다. 스킬을 쓰지 않는 작업에도 적용된다.

1. 문서 경로의 기준은 `docs/PIPELINE.md`(산출물 레지스트리) 하나다. 스킬 문서와 다르면 레지스트리를 따른다.
2. 파이프라인 단계 작업(기획·설계·DB·백엔드·프론트·QA·UX)은 해당 스킬(`pm-agent`, `architect-agent`, `db-agent`, `backend-agent`, `frontend-impl`, `qa-agent`, `ubuntubooks-uiux-domain`)을 로드해서 한다.
3. 작업 전 `node scripts/check-handoff.mjs <STAGE>`를 실행한다(DB·BE·FE·QA는 `--ticket <TKT>`를 붙여 HANDOFF 선행 티켓의 브리핑까지 확인). 마지막 줄이 `STATUS: READY`가 아니면 작업하지 않고 그 STATUS 줄을 보고한 뒤 멈춘다. 사용자가 예외를 승인하면 `docs/PIPELINE.md` §2-5대로 기록한다.
4. 산출물은 레지스트리에서 `만드는 단계`가 내 단계인 경로에만 쓰고, 끝나면 `node scripts/check-handoff.mjs <STAGE> --post --ticket <TKT>`로 확인한다.
5. 순차 실행은 `scripts/run-stage.sh <STAGE> [TKT]`로 한다 (`docs/PIPELINE.md` §5).

## 디렉토리 지도

파일 전체를 탐색하기 전에 이 지도부터 본다. 구조는 발제(`docs/00-inputs/kant-rubric.md` §4.2) 기준이며, 기능 폴더 이름과 상세 규칙은 ARCH가 `docs/02-arch/05-structure-conventions.md`에서 확정하고 이 지도를 갱신한다.

| 경로 | 책임 |
|---|---|
| `pyproject.toml` · `uv.lock` | 의존성 (uv) |
| `src/main.py` | 앱 엔트리, lifespan(테이블 생성·시드 주입), 라우터·미들웨어 조립 |
| `src/database.py` | AsyncEngine, AsyncSessionLocal, Base, `get_db()` |
| `src/auth/` | 회원·OAuth2 로그인·JWT 블랙리스트 (4계층) |
| `src/<기능>/domain/` | 순수 파이썬 도메인 클래스. fastapi·sqlalchemy import 금지 |
| `src/<기능>/infrastructure/` | `models.py`(테이블), `repositories.py`(ORM ↔ 도메인 객체 변환) |
| `src/<기능>/application/` | `service.py`(흐름 조율, commit) |
| `src/<기능>/presentation/` | `schemas.py`(Pydantic), `router.py`(APIRouter, 예외 변환) |
| `src/templates/` · `src/static/` | Jinja2 화면, 정적 파일 |
| `tests/` | 테스트 |

| 단계 | 쓰는 곳 | 읽는 설계 문서 |
|---|---|---|
| DB | `src/database.py`, `src/<기능>/infrastructure/`, 시드 데이터 | `03-db-schema.md`, `HANDOFF.md` |
| BE | `src/<기능>/{domain,application,presentation}/`, `src/auth/`, `src/main.py`, `pyproject.toml` | `04-interfaces-api.md`, `docs/03-db/briefing.md` |
| FE | `src/templates/`, `src/static/`, `README.md` | `04-interfaces-api.md`(화면 데이터 계약), `07-screens.md`, `05-structure-conventions.md` |
| QA | `tests/`, `docs/06-qa/` | `06-quality-gates.md`, PM-AC |

설계 문서: `docs/02-arch/` (ADR은 `adr/`). 티켓: `docs/02-arch/HANDOFF.md`.
