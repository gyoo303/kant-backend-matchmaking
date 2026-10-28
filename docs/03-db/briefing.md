---
stage: DB
tickets: [TKT-DB-M2-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, AR-ADR, BE-BRIEF]
next_readers: [BE, QA]
---
# DB 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-DB-M2-01 | GATE-05 | 충족 (`ruff check src`, `ruff format --check src` 통과) |
| | 세션 생성 확인 | 충족 (DB 접속 없이 세션 생성·풀 설정·예외 시 rollback 확인). 실제 PostgreSQL 접속은 확인하지 못함(아래 검증 결과) |

## 만든 것

### TKT-DB-M2-01
- `src/database.py` (`04-interfaces-api.md` §8, ADR-003)
  - `engine = create_async_engine(settings.database_url, pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow)`
  - `AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)`
  - `class Base(DeclarativeBase)`: 모든 `<Entity>Model`의 부모
  - `async def get_db() -> AsyncIterator[AsyncSession]`: 요청당 세션 하나, 예외 시 `rollback()` 후 다시 올림. commit하지 않음
- 테이블·레포지토리: 없음 (TKT-DB-M3-01·02)

## 인프라 확인 포인트
- 필요한 환경변수: `DATABASE_URL`(필수, `postgresql+asyncpg://…`), `DB_POOL_SIZE`·`DB_MAX_OVERFLOW`(기본 10). `config.Settings`가 `.env`에서 읽는다
- `database` 모듈을 import하는 순간 `get_settings()`가 실행되므로 `DATABASE_URL`·`JWT_SECRET_KEY`·`SEED_USER_PASSWORD`가 없으면 import 단계에서 `ValidationError`가 난다. 엔진 생성만으로는 DB에 접속하지 않는다(첫 쿼리 때 접속)
- 스키마 반영: 이 티켓에는 테이블이 없다. 테이블 생성은 lifespan의 `create_all`(TKT-BE-M3-05)

## 다음 단계(BE)가 쓸 것
- 라우터 의존성: `Depends(get_db)`
- 트랜잭션 확정: 서비스가 `await self.db.commit()`. `get_db`는 예외 때만 rollback한다
- lifespan: `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)`, 종료 시 `await engine.dispose()`(STK-12)
- 모델 등록: `create_all` 전에 모든 `models.py`가 import되어 있어야 `Base.metadata`에 테이블이 잡힌다

## 구현 중 자율 결정

#### TKT-DB-M2-01 설정을 읽는 시점
- 결정: `database.py` 모듈 로드 시 `get_settings()`로 엔진을 만든다 — `04-interfaces-api.md` §8, HANDOFF TKT-DB-M2-01("`create_async_engine(settings.database_url, …)`")
- 선택지: **A. 모듈 로드 시 엔진 생성 (권장·채택)** / B. `get_engine()` 함수로 첫 호출 때 생성
- 권장 이유: 설계가 모듈 수준 `engine`·`AsyncSessionLocal`을 정했고, lifespan·테스트가 같은 객체를 바로 import할 수 있다.
- trade-off: A — 환경변수 없이 `database`를 import하면 실패하므로 테스트는 import 전에 환경변수를 넣어야 한다. B — import는 자유롭지만 호출 지점마다 함수 호출이 필요하고 설계 시그니처와 달라진다.

## 설계와 다르게 한 것 / 질문
- 없음

## 검증 결과
- GATE-05: `uv run ruff check src` → All checks passed, `uv run ruff format --check src` → 15 files already formatted
- 세션 생성 확인(임시 스크립트, 저장소에 남기지 않음): 더미 `DATABASE_URL`로 import → `pool.size()=3`, `max_overflow=2`(환경변수 반영), `expire_on_commit=False`, `get_db()`가 `AsyncSession`을 돌려줌, 예외를 던지면 `rollback()` 호출됨
- 실제 PostgreSQL 접속: **확인하지 못함 (환경 문제)** — 이 PC에 PostgreSQL 서버가 없고(5432 대기 없음, `psql` 없음) `.env`도 없다. 사람이 로컬 DB와 `.env`를 준비한 뒤 TKT-BE-M3-05(lifespan `create_all`)에서 접속을 확인한다
