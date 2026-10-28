---
stage: DB
tickets: [TKT-DB-M2-01, TKT-DB-M3-01, TKT-DB-M3-02]
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
| TKT-DB-M3-02 | GATE-02 | 충족 (세 명령 0줄) |
| | GATE-08 | 충족 (0줄) |
| | 제약 이름이 문서와 같음 | 충족 (DDL 컴파일 결과 대조, 아래 검증 결과) |

## 만든 것

### TKT-DB-M3-02
- `src/rooms/infrastructure/models.py`

| 테이블 | 컬럼 | 제약·인덱스 이름 | 근거 INV |
|---|---|---|---|
| `rooms` (`RoomModel`) | `id`(identity PK), `title` String(20), `capacity` SmallInteger DEFAULT 4, `host_user_id` FK `users.id` RESTRICT, `last_join_order` DEFAULT 0, `created_at`, `deleted_at`, `delete_reason` String(20) | `ck_rooms_title_not_blank`, `ck_rooms_capacity_fixed`, `ck_rooms_last_join_order`, `ck_rooms_delete_state`, `ix_rooms_active_created`(`created_at DESC, id DESC WHERE deleted_at IS NULL`), `ix_rooms_host_user_id` | INV-01·07·11·12 |
| `participations` (`ParticipationModel`) | `id`(identity PK), `room_id` FK `rooms.id` RESTRICT, `user_id` FK `users.id` RESTRICT, `join_order`, `team` String(1), `joined_at`, `left_at` | `ck_participations_join_order`, `ck_participations_team`, `ck_participations_left_after_join`, `uq_participations_room_join_order`, `ix_participations_room_current`(`WHERE left_at IS NULL`), `ix_participations_user_joined`(`user_id, joined_at DESC, id DESC`) | INV-10·11 |

- 도전 A 범위는 넣지 않았다: 부분 유니크 인덱스 `uq_participations_user_current`, `find_by_id_for_update`, `IntegrityError` → `AlreadyParticipatingError` 변환 (D-018, TKT-DB-M6-01)
- `src/rooms/infrastructure/repositories.py`

| 클래스 | 메서드 | 반환 |
|---|---|---|
| `RoomRepository(session)` | `find_by_id(room_id)` — 방 행 + 현재 참가 기록(입장 순서순, 별도 쿼리) | `Room` 또는 `None` |
| | `find_current_participation(user_id)` — `left_at IS NULL` 기록 중 가장 최근 | `Participation` 또는 `None` |
| | `save(room)` — 방 insert/update 후 `room.participations` 전체 저장(id 없으면 insert, 있으면 `team`·`left_at` update), `flush` | id가 채워진 `Room`(이번에 저장한 참가 기록 포함) |
| `RoomQueryRepository(session)` | `list_active_rooms(cond)` — 삭제 제외, 현재 인원 집계, 제목 ILIKE ESCAPE, 빈자리 필터, 최신순·오래된순(동률 id), LIMIT/OFFSET, 같은 조건 전체 건수 | `(list[RoomSummary], int)` |
| | `get_room_detail(room_id)` — **활성 방만**, 참가자 닉네임 조인(A팀 먼저, 팀 안에서 입장 순서), `my_team=None`·`am_i_host=False` | `RoomDetail` 또는 `None`(없음·삭제) |
| | `list_history(user_id, page, size)` — 본인 기록만, `joined_at DESC, id DESC` | `(list[HistoryItem], int)` |
| | `get_archived_room(room_id, user_id)` — 삭제된 방이고 본인 기록이 있을 때만, 본인 기록 입장순 | `ArchivedRoom` 또는 `None` |


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

### TKT-DB-M3-02
- 변경 서비스(SEQ-05~09): `find_current_participation` → `find_by_id`(없으면 `RoomNotFoundError`는 서비스가 낸다) → 도메인 메서드 → `save` → 서비스 commit. 필수 범위에는 잠금이 없다(D-018)
- `save`가 돌려준 `Room`의 `id`로 상세 응답을 조회한다(방 생성 직후 등)
- 상세 조회(`RoomQueryService.get_room_detail`): `RoomQueryRepository.get_room_detail`이 `None`이면 `RoomRepository.find_by_id`로 방을 다시 읽어 없음·EMPTY → `RoomNotFoundError`, GAME_STARTED → `RoomDissolvedError`. 값이 있으면 `my_team`·`am_i_host`를 조회 회원 기준으로 채운다(`dataclasses.replace`)
- 목록 조건의 `keyword`는 서비스·라우터가 strip하고 빈 문자열을 `None`으로 넘긴다. 이스케이프는 레포지토리가 한다
- 보관 정보: `None`이면 `RoomNotFoundError`

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

#### TKT-DB-M3-02 참가자 로딩 방식
- 결정: ORM 관계(`relationship`) 없이 방 행과 참가 기록을 별도 `select`로 읽는다 — STK-02·STK-03
- 선택지: **A. 별도 select (권장·채택)** / B. `relationship` + `selectinload`
- 권장 이유: 비동기 lazy loading 오류가 생길 경로가 없고, 도전 A에서 방 행만 `FOR UPDATE`로 잠그는 구조(STK-03)와 그대로 맞는다.
- trade-off: A — 방 하나를 읽을 때 쿼리가 2번 나간다. B — 쿼리 수는 같지만 관계 설정이 늘고, 잠금 쿼리와 함께 쓸 때 조인 범위를 따로 신경 써야 한다.

#### TKT-DB-M3-02 현재 참가 기록이 여러 건일 때
- 결정: `find_current_participation`은 `left_at IS NULL` 기록 중 가장 최근(`joined_at DESC, id DESC`) 1건을 돌려준다 — INV-04
- 선택지: **A. 가장 최근 1건 (권장·채택)** / B. 2건 이상이면 예외
- 권장 이유: 필수 범위에는 부분 유니크 인덱스가 없어(D-018) 동시 요청으로 2건이 생길 수 있는데, 조회 자체가 실패하면 그 회원이 나가기도 못 한다.
- trade-off: A — 중복 상태를 조용히 넘긴다(도전 A 인덱스가 근본 대책). B — 중복을 바로 드러내지만 회원이 방을 정리할 방법이 없어진다.

## 설계와 다르게 한 것 / 질문
- TKT-DB-M3-02 사용자 확인 결과(2026-10-28): `03-db-schema.md` §5의 `get_room_detail(room_id) -> RoomDetail | None` 시그니처에 조회 회원·삭제 사유가 없어, 서비스가 `my_team`·`am_i_host`를 채우고 404/410을 구분할 방법이 정의되지 않았다. 사용자가 선택한 방식: **레포지토리는 활성 방만 반환(없음·삭제 → None), 서비스가 None일 때만 `RoomRepository.find_by_id`로 삭제 사유를 확인하고 조회 회원 기준 필드를 채운다.** 시그니처는 바꾸지 않았다. ARCH에 `03-db-schema.md` §5와 `04-interfaces-api.md` §3 `get_room_detail` 설명 갱신을 요청한다
- TKT-DB-M3-02: `rooms.host_user_id`의 인덱스는 문서에 "INDEX"로만 적혀 있어 SQLAlchemy 기본 이름 `ix_rooms_host_user_id`를 썼다. ARCH 문서에 이름을 적어 달라고 요청한다

## 검증 결과

### TKT-DB-M3-02
- GATE-02: 세 명령 0줄 / GATE-08: 0줄 / GATE-05: `ruff check src` 통과, `ruff format --check src` 27 files already formatted
- ADR-001: `auth.infrastructure.models`를 import하는 곳은 `src/rooms/infrastructure/repositories.py` 한 곳(닉네임 조인)
- DDL 확인(PostgreSQL 방언으로 컴파일): `rooms`·`participations`의 컬럼·타입·DEFAULT·FK(`ON DELETE RESTRICT`)·CHECK 4개·3개·UNIQUE·부분 인덱스 조건이 `03-db-schema.md` §3.3·§3.4와 일치. `uq_participations_user_current`는 없음(도전 A)
- 조회 SQL 확인(컴파일): 목록은 현재 인원 서브쿼리 LEFT JOIN + `deleted_at IS NULL` + `ILIKE … ESCAPE '\'` + 빈자리 조건 + 정렬·LIMIT/OFFSET, 전체 건수는 같은 조건의 `count(*)`. 이력은 본인 `user_id` 조건 + `joined_at DESC, id DESC`
- 도메인 변환: `RoomModel`·`ParticipationModel` → `Room` 변환 확인
- 실제 DB 실행(저장·조회·집계·검색 이스케이프 결과): **확인하지 못함 (환경 문제)** — PostgreSQL 서버 없음. TKT-QA-M3-01 통합 테스트에서 확인 필요

### TKT-DB-M3-01
- GATE-02: 세 명령 0줄 / GATE-08: 0줄 / GATE-05: `ruff check src` 통과, `ruff format --check src` 25 files already formatted
- DDL 확인(PostgreSQL 방언으로 컴파일): `users`·`token_blacklist` 컬럼·타입·NOT NULL·DEFAULT now()·제약 이름(`uq_users_login_id`, `uq_users_nickname`, `uq_token_blacklist_jti`)·인덱스(`ix_token_blacklist_expires_at`)가 `03-db-schema.md`와 일치
- 도메인 변환 확인: `_to_model` → `_to_domain` 왕복 시 필드 유지
- 실제 DB 쿼리(조회·저장·중복 위반 변환·만료 삭제): **확인하지 못함 (환경 문제)** — PostgreSQL 서버 없음. TKT-QA-M3-01 통합 테스트(테스트 DB)에서 확인 필요

### TKT-DB-M2-01
- GATE-05: `uv run ruff check src` → All checks passed, `uv run ruff format --check src` → 15 files already formatted
- 세션 생성 확인(임시 스크립트, 저장소에 남기지 않음): 더미 `DATABASE_URL`로 import → `pool.size()=3`, `max_overflow=2`(환경변수 반영), `expire_on_commit=False`, `get_db()`가 `AsyncSession`을 돌려줌, 예외를 던지면 `rollback()` 호출됨
- 실제 PostgreSQL 접속: **확인하지 못함 (환경 문제)** — 이 PC에 PostgreSQL 서버가 없고(5432 대기 없음, `psql` 없음) `.env`도 없다. 사람이 로컬 DB와 `.env`를 준비한 뒤 TKT-BE-M3-05(lifespan `create_all`)에서 접속을 확인한다
