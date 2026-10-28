---
stage: DB
tickets: [TKT-DB-M2-01, TKT-DB-M3-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-DB, AR-API, AR-CONV, AR-GATE, AR-ADR, BE-BRIEF]
next_readers: [BE, QA]
---
# DB 에이전트 브리핑

## 처리한 티켓
| TKT | 완료 조건 | 충족 여부 |
|---|---|---|
| TKT-DB-M2-01 | GATE-05 | 충족 (`ruff check src`, `ruff format --check src` 통과) |
| | 세션 생성 확인 | 충족 (DB 접속 없이 세션 생성·풀 설정·예외 시 rollback 확인). 실제 PostgreSQL 접속은 확인하지 못함(아래 검증 결과) |
| TKT-DB-M3-01 | GATE-02 | 충족 (세 명령 0줄) |
| | GATE-08 | 충족 (`application`·`presentation`에서 Model import 0줄) |

## 만든 것

### TKT-DB-M2-01
- `src/database.py` (`04-interfaces-api.md` §8, ADR-003)
  - `engine = create_async_engine(settings.database_url, pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow)`
  - `AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)`
  - `class Base(DeclarativeBase)`: 모든 `<Entity>Model`의 부모
  - `async def get_db() -> AsyncIterator[AsyncSession]`: 요청당 세션 하나, 예외 시 `rollback()` 후 다시 올림. commit하지 않음
- 테이블·레포지토리: 없음 (TKT-DB-M3-01·02)

### TKT-DB-M3-01
- `src/auth/infrastructure/models.py`

| 테이블 | 컬럼 | 제약·인덱스 이름 | 근거 |
|---|---|---|---|
| `users` (`UserModel`) | `id`(identity PK), `login_id` String(20), `nickname` String(12), `hashed_password` String(255), `created_at` timestamptz DEFAULT now() | `uq_users_login_id`, `uq_users_nickname` | `03-db-schema.md` §3.1, Q-04 |
| `token_blacklist` (`TokenBlacklistModel`) | `id`(identity PK), `jti` String(36), `expires_at` timestamptz, `created_at` timestamptz DEFAULT now() | `uq_token_blacklist_jti`, `ix_token_blacklist_expires_at` | §3.2, INV-14 |

- `src/auth/infrastructure/repositories.py`

| 클래스 | 메서드 | 반환 |
|---|---|---|
| `UserRepository(session)` | `find_by_id(user_id)`, `find_by_login_id(login_id)` | `User` 또는 `None` |
| | `exists_login_id(login_id)`, `exists_nickname(nickname)` | `bool` |
| | `save(user)` — id 없으면 insert, 있으면 update, `flush`. `uq_users_login_id`·`uq_users_nickname` 위반 → `DuplicateLoginIdError`·`DuplicateNicknameError` | `User`(id·created_at 채워짐) |
| `TokenBlacklistRepository(session)` | `exists(jti)` | `bool` |
| | `save(entry)` — insert, `flush` | `None` |
| | `delete_expired(now)` — `expires_at < now` 행 삭제 | 삭제 건수 `int` |

## 인프라 확인 포인트
- 필요한 환경변수: `DATABASE_URL`(필수, `postgresql+asyncpg://…`), `DB_POOL_SIZE`·`DB_MAX_OVERFLOW`(기본 10). `config.Settings`가 `.env`에서 읽는다
- `database` 모듈을 import하는 순간 `get_settings()`가 실행되므로 `DATABASE_URL`·`JWT_SECRET_KEY`·`SEED_USER_PASSWORD`가 없으면 import 단계에서 `ValidationError`가 난다. 엔진 생성만으로는 DB에 접속하지 않는다(첫 쿼리 때 접속)
- 스키마 반영: 이 티켓에는 테이블이 없다. 테이블 생성은 lifespan의 `create_all`(TKT-BE-M3-05)

## 다음 단계(BE)가 쓸 것

### TKT-DB-M3-01
- 회원가입(SEQ-01): `exists_login_id` → `exists_nickname` → `save`. 동시 가입으로 제약이 위반되면 `save`가 `Duplicate*Error`를 낸다. 그 뒤 세션은 실패 상태이므로 서비스는 예외를 그대로 올린다(`get_db`가 rollback)
- 로그인(SEQ-02): `find_by_login_id`
- 인증 의존성(SEQ-03): `TokenBlacklistRepository.exists(jti)` → `UserRepository.find_by_id`
- 로그아웃(SEQ-04): `save(TokenBlacklist(...))` → `delete_expired(now)` → 서비스 commit
- 두 레포지토리 모두 commit하지 않는다

### TKT-DB-M2-01
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

#### TKT-DB-M3-01 서버 기본값 컬럼을 저장 직후 채우는 방법
- 결정: 두 모델에 `__mapper_args__ = {"eager_defaults": True}`를 둔다 — `03-db-schema.md` §3.1·§3.2(`created_at` DEFAULT now()), §5(`save`가 채워진 객체 반환)
- 선택지: **A. eager_defaults로 INSERT … RETURNING에서 받음 (권장·채택)** / B. flush 뒤 `session.refresh(model)`
- 권장 이유: 쿼리를 한 번 더 보내지 않고, 비동기 세션에서 만료된 속성을 읽다 나는 lazy loading 오류(STK-02)를 피한다.
- trade-off: A — 모델 설정 한 줄이 더 필요하다. B — 저장마다 SELECT가 하나 더 나간다.

#### TKT-DB-M3-01 위반한 제약 이름 판별
- 결정: `IntegrityError`의 원인 예외(asyncpg)에서 `constraint_name`을 읽고, 없으면 메시지에서 제약 이름을 찾는다 — HANDOFF TKT-DB-M3-01("중복 아이디·닉네임 IntegrityError → Duplicate*Error")
- 선택지: **A. constraint_name 우선 + 메시지 대체 (권장·채택)** / B. 메시지 문자열만 검사
- 권장 이유: 제약 이름이 문서와 같게 고정되어 있어 정확히 구분할 수 있고, 드라이버 래핑이 바뀌어도 대체 경로가 있다.
- trade-off: A — 판별 함수가 하나 생긴다. B — DB 메시지 형식이 바뀌면 판별이 틀린다.

## 설계와 다르게 한 것 / 질문
- 없음

## 검증 결과

### TKT-DB-M3-01
- GATE-02: 세 명령 0줄 / GATE-08: 0줄 / GATE-05: `ruff check src` 통과, `ruff format --check src` 25 files already formatted
- DDL 확인(PostgreSQL 방언으로 컴파일): `users`·`token_blacklist` 컬럼·타입·NOT NULL·DEFAULT now()·제약 이름(`uq_users_login_id`, `uq_users_nickname`, `uq_token_blacklist_jti`)·인덱스(`ix_token_blacklist_expires_at`)가 `03-db-schema.md`와 일치
- 도메인 변환 확인: `_to_model` → `_to_domain` 왕복 시 필드 유지
- 실제 DB 쿼리(조회·저장·중복 위반 변환·만료 삭제): **확인하지 못함 (환경 문제)** — PostgreSQL 서버 없음. TKT-QA-M3-01 통합 테스트(테스트 DB)에서 확인 필요

### TKT-DB-M2-01
- GATE-05: `uv run ruff check src` → All checks passed, `uv run ruff format --check src` → 15 files already formatted
- 세션 생성 확인(임시 스크립트, 저장소에 남기지 않음): 더미 `DATABASE_URL`로 import → `pool.size()=3`, `max_overflow=2`(환경변수 반영), `expire_on_commit=False`, `get_db()`가 `AsyncSession`을 돌려줌, 예외를 던지면 `rollback()` 호출됨
- 실제 PostgreSQL 접속: **확인하지 못함 (환경 문제)** — 이 PC에 PostgreSQL 서버가 없고(5432 대기 없음, `psql` 없음) `.env`도 없다. 사람이 로컬 DB와 `.env`를 준비한 뒤 TKT-BE-M3-05(lifespan `create_all`)에서 접속을 확인한다
