# 06. ADR-013·014 구현 가이드 (따라 치며 배우기)

- 대상: 부트캠프 1년차 개발자. 코드를 **직접 따라 치면서** 동시성 제어와 화면 피드백을 이해하는 것이 목표다
- 근거: `docs/02-arch/adr/ADR-013-concurrent-write-integrity.md`(서버), `ADR-014-request-feedback-ui.md`(화면), `05-decision.md`(AD-01~10)
- 검증: 이 가이드의 코드는 별도 작업 트리에 그대로 적용해 확인했다 — ruff 통과, **전체 테스트 96개 통과**(새 동시성 통합 테스트 포함). 새 동시성 테스트 4개는 **바꾸기 전 코드에서는 실패**하는 것도 확인했다. 화면 JS는 문법 검사(`node --check`)만 했고, 브라우저 동작은 7단계 VC-08 체크리스트로 확인한다
- 작업 브랜치: `feat/concurrent-join-integrity`

---

## 0. 시작 전에

### 0.1 무엇을 고치는가 — 한 장 요약

지금 코드는 같은 방에 100명이 동시에 참가하면 **4인 방에 7~10명**이 들어간다(기준선 측정). 이유는 "읽고 → 검사하고 → 저장"하는 사이에 다른 요청이 끼어들기 때문이다.

```
요청 A: 방 읽기(1명) ─ "빈자리 있음" ─ 저장 ─ commit
요청 B: 방 읽기(1명) ─ "빈자리 있음" ─ 저장 ─ commit     ← A가 저장하기 전에 읽어서 둘 다 통과
```

고친 뒤의 참가 요청 흐름:

```
[화면] 클릭 → 즉시 "입장 중…" + 모든 참가·만들기 버튼 잠금 → 3초 지나면 지연 안내 → 5초에 강제 종료
  │
[서버] 인증 ─ (커넥션 풀 대기 ≤ 1초, 넘으면 409)
  ├─ ① 빠른 거절: 잠금 없이 방을 읽어 이미 찼으면 바로 400
  ├─ ② 방 행 잠금 SELECT … FOR UPDATE (대기 ≤ 2초, 넘으면 409)
  ├─ ③ 잠금 "뒤에" 내 현재 참가 읽기
  ├─ ④ room.join() — 도메인 규칙 검사 (기존 코드 그대로)
  ├─ ⑤ save() — 같은 회원이 다른 방에 이미 들어갔으면 unique 위반 → 400
  └─ ⑥ 응답 조립 → commit (여기서 잠금 해제)
  │
[화면] 200 이동 / 400 사유 / 409 "입장하지 못했습니다. 다시 시도해 주세요" / 시간 초과 "입장 결과를 확인하지 못했습니다."
```

### 0.2 미리 알아 둘 개념 5개

| 개념 | 한 줄 설명 | 어디서 쓰나 |
|---|---|---|
| 트랜잭션 | 여러 SQL을 "전부 반영 아니면 전부 취소"로 묶는 단위. 이 프로젝트는 **요청 하나 = 트랜잭션 하나**(D-029, `get_db`가 끝에 commit) | 잠금이 언제 풀리는지 |
| 행 잠금 `SELECT … FOR UPDATE` | "이 행을 읽고 곧 바꿀 테니, 내 트랜잭션이 끝날 때까지 다른 트랜잭션은 이 행을 잠그거나 바꾸지 말고 기다려라" | 6단계 저장소 |
| `lock_timeout` | 잠금을 기다리는 최대 시간. 넘으면 PostgreSQL이 오류 `55P03`을 낸다 | 6단계 저장소 |
| identity map | SQLAlchemy 세션은 한 번 읽은 행을 객체로 기억해 두고, 같은 행을 다시 읽어도 **기억한 객체를 그대로** 돌려준다 | 6단계 `populate_existing` |
| `AbortController` | 브라우저 `fetch`를 중간에 멈추는 스위치. `fetch`에는 시간 제한 옵션이 없어서 이걸로 만든다 | 11단계 화면 |

### 0.3 작업 순서와 이유

안쪽(설정·예외)에서 바깥쪽(서비스·화면)으로 간다. 각 단계가 끝날 때마다 앱이 실행되고 테스트가 통과하는 상태를 유지한다.

| 단계 | 파일 | 계층 |
|---|---|---|
| 1 | `src/config.py`, `.env.example` | 설정 |
| 2 | `src/exceptions.py` | 공통 예외 |
| 3 | `src/bootstrap/error_handlers.py` | 부트스트랩 |
| 4 | `src/rooms/domain/repository.py` | 도메인(계약) |
| 5 | `src/rooms/infrastructure/models.py` | 인프라(ORM) |
| 6 | `src/rooms/infrastructure/repositories.py` | 인프라(저장소) |
| 7 | `src/container.py` | 조립 |
| 8 | `src/rooms/application/service.py` | 응용 |
| 9 | `tests/unit/...` | 단위 테스트 |
| 10 | `tests/integration/test_concurrency.py` | 통합 테스트 |
| 11 | `src/static/js/api.js` | 화면 |
| 12 | `src/static/js/rooms.js` | 화면 |
| 13 | 컨벤션·게이트·아키텍처 문서 | 문서 |

> **도메인 객체(`Room`, `Participation`, `Team`)는 한 줄도 바꾸지 않는다.** 규칙은 그대로 두고, "규칙을 검사하는 순간에 다른 요청이 끼어들지 못하게" 만드는 것이 이번 작업의 전부다.

---

## 1단계 — 설정: 대기 시간 상한 두 개

**목표**: 서버가 4초 안에 결론을 내도록 대기 구간마다 상한을 둔다(ADR-013 AD-02·03).

```
서버 4초 = 커넥션 풀 대기 1초 + 방 잠금 대기 2초 + 처리 여유 1초   <   화면 5초
```

`src/config.py` — `db_pool_timeout`을 바꾸고 `db_lock_timeout_ms`를 추가한다.

```python
    # 커넥션 풀에서 연결을 빌릴 때 최대 대기 시간(초).
    #   - 30초 → 1초 (ADR-013 AD-03). 풀이 고갈되면 30초 동안 응답이 없어 "화면이 멈춘" 상태가 된다.
    #   - 1초 안에 연결을 못 빌리면 SQLAlchemy가 TimeoutError를 던지고, 전역 핸들러가 409로 바꾼다.
    #   - float: 1.5초처럼 소수도 쓸 수 있게 한다.
    db_pool_timeout: float = 1.0
    db_pool_recycle: int = 1800
    db_pool_pre_ping: bool = True

    # 수업 추가 내용: DB 세션 관련 설정
    db_session_autoflush: bool = False
    db_session_expire_on_commit: bool = False

    # 방 행 잠금을 기다리는 최대 시간(밀리초) — ADR-013 AD-02
    #   쓰기 트랜잭션 안에서 SET LOCAL lock_timeout으로 건다. 넘으면 409(바빠서 거절).
    #   지연 예산: 풀 대기 1초 + 잠금 대기 2초 + 처리 여유 1초 = 서버 4초 < 클라이언트 5초
    db_lock_timeout_ms: int = 2000
```

`.env.example` — `DB_MAX_OVERFLOW=10` 아래에 추가한다.

```
# 풀에서 연결을 빌릴 때 최대 대기(초), 방 잠금 최대 대기(밀리초) — ADR-013
DB_POOL_TIMEOUT=1
DB_LOCK_TIMEOUT_MS=2000
```

**고려사항**
- `db_pool_timeout`은 **앱 전체**에 적용된다. 과부하 때는 목록 조회도 1초 안에 연결을 못 빌리면 409가 된다. ADR-013이 "감수할 점"으로 받아들인 부분이다.
- pydantic-settings는 환경변수 이름을 대소문자 구분 없이 읽는다. `.env`에 값이 없으면 위 기본값이 쓰인다.

**확인**: `uv run ruff check src` 통과, 앱 기동 정상.

---

## 2단계 — 공통 예외: `ServiceBusyError`

**목표**: "규칙 위반(400)"과 다른 **"지금은 바빠서 처리 못 함(409)"**을 나타내는 예외를 만든다(AD-04, D-034).

`src/exceptions.py` — `AuthenticationError` 위에 추가한다.

```python
# ServiceBusyError → 409 (ADR-013 AD-04, D-034)
# 부모 클래스로 DomainError를 쓰지 않는다.
#   "정원 마감" 같은 규칙 위반이 아니라 "지금은 서버가 시간 안에 처리하지 못했다"는 뜻이라
#   도메인 규칙과 성격이 다르다. 같은 요청을 잠시 뒤 다시 보내면 성공할 수 있다.
# 어디서 생기나?
#   1) 방 잠금을 2초 넘게 기다림 (저장소가 PostgreSQL 55P03 오류를 이 예외로 바꾼다)
#   2) 커넥션 풀에서 1초 넘게 연결을 못 빌림 (전역 핸들러가 SQLAlchemy TimeoutError를 직접 409로)
class ServiceBusyError(Exception):
    """요청이 몰려 서버가 시간 안에 처리하지 못함 (다시 시도하면 될 수 있음)"""

    def __init__(
        self, message: str = "요청이 많아 처리하지 못했습니다. 다시 시도해 주세요"
    ) -> None:
        super().__init__(message)
        self.message = message
```

**고려사항**
- 이 파일은 도메인이 import하는 파일이라 **외부 라이브러리를 import하면 안 된다**(GATE-02). 순수 파이썬 클래스만 둔다.
- `self.message`를 두는 이유: 전역 핸들러가 `{"detail": exc.message}`를 만들 때 쓴다(D-027).

---

## 3단계 — 전역 핸들러: 409 두 개

**목표**: `ServiceBusyError`와 커넥션 풀 `TimeoutError`를 409로 바꾼다.

`src/bootstrap/error_handlers.py`

① import (`fastapi.responses` 아래):

```python
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from exceptions import (
    AuthenticationError,
    DomainRuleError,
    GoneError,
    NotFoundError,
    ServiceBusyError,
)
```

② 핸들러 두 개 (`handle_gone_error` 아래, 401 핸들러 위):

```python
# 409 — 바빠서 거절 (ADR-013 AD-04)
# 화면(rooms.js)은 문구가 아니라 상태 코드 409를 보고
#   "입장하지 못했습니다. 다시 시도해 주세요"를 띄운다.
async def handle_service_busy_error(_: Request, exc: ServiceBusyError) -> JSONResponse:
    return _detail(status_code=409, message=exc.message)


# 커넥션 풀 대기 초과 — SQLAlchemy가 던지는 TimeoutError를 409로 (ADR-013 AD-03)
# 왜 저장소가 아니라 여기서 바꾸나?
#   풀에서 연결을 빌리는 순간은 "그 요청의 첫 SQL"이다.
#   인증 조회(auth)일 수도, 방 조회(rooms)일 수도 있다.
#   어느 저장소에서 터질지 정해져 있지 않으므로, 모든 요청이 지나가는 전역 핸들러 한 곳에서 바꾼다.
async def handle_pool_timeout_error(_: Request, exc: PoolTimeoutError) -> JSONResponse:
    logger.warning("db pool timeout: %s", exc)
    return _detail(status_code=409, message=ServiceBusyError().message)
```

③ 등록 (`register_exception_handlers` 안, `GoneError` 다음):

```python
    app.add_exception_handler(ServiceBusyError, handle_service_busy_error)
    app.add_exception_handler(PoolTimeoutError, handle_pool_timeout_error)
```

**고려사항**
- `sqlalchemy.exc.TimeoutError`는 파이썬 내장 `TimeoutError`와 **다른 클래스**다. 이름이 겹쳐 헷갈리지 않게 `PoolTimeoutError`로 바꿔 import했다.
- 핸들러 고르는 규칙: Starlette는 예외 클래스의 상속 관계(MRO)를 따라 **가장 구체적인** 핸들러를 고른다. 그래서 맨 아래 `Exception`(500) 핸들러보다 409 핸들러가 먼저 잡는다.
- `bootstrap`은 조립 계층이라 sqlalchemy를 알아도 된다. 도메인·응용 계층에서는 import하지 않는다(GATE-02).

---

## 4단계 — 도메인 계약: `find_by_id_for_update`

**목표**: "잠그며 읽기"라는 **약속(계약)**만 도메인에 추가한다. 어떻게 잠그는지는 인프라가 정한다(AD-08).

`src/rooms/domain/repository.py` — `find_by_id` 아래에 추가한다.

```python
    @abstractmethod
    async def find_by_id_for_update(self, room_id: int) -> Room | None:
        """
        find_by_id와 같지만, 이 트랜잭션이 끝날(commit/rollback) 때까지 방을 잠근다 (ADR-013 AD-01)
        - 같은 방을 바꾸려는 다른 요청은 앞 요청이 끝날 때까지 기다린다 → 최신 상태를 읽고 검사한다
        - 잠금을 너무 오래 기다리면 ServiceBusyError (어떻게 잠그는지는 구현의 일)
        - 방을 바꾸는 쓰기 동작(참가·제목·팀·나가기·게임 시작)만 쓴다. 조회 화면은 find_by_id
        """
```

**고려사항**
- `@abstractmethod`를 추가하면 이 계약을 구현한 **모든 클래스**가 이 메서드를 가져야 한다. 실제 저장소(6단계)와 **테스트용 가짜 저장소(9단계)** 둘 다 고쳐야 한다. 안 고치면 객체를 만들 때 `TypeError: Can't instantiate abstract class`가 난다.
- 도메인 파일에는 "FOR UPDATE", "PostgreSQL" 같은 단어가 나오지 않는다. 그것은 인프라의 사정이다.

---

## 5단계 — ORM 모델: 제약에 이름 붙이기 + 안전망

**목표**
1. 기존 `user_id` unique에 **이름**을 붙인다. 위반됐을 때 "어떤 제약이 깨졌는지" 이름으로 구분하기 위해서다(AD-06).
2. `(room_id, join_order)` unique를 **안전망**으로 추가한다(AD-07).

`src/rooms/infrastructure/models.py`

① import에 `UniqueConstraint` 추가:

```python
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
```

② `ParticipationModel` 클래스 바로 위·안을 이렇게 바꾼다.

```python
# 제약 이름을 상수로 둔다 — 저장소가 IntegrityError의 제약 이름으로 "무슨 위반인지" 구분한다
UQ_PARTICIPATION_USER = "uq_participations_user_id"
UQ_PARTICIPATION_JOIN_ORDER = "uq_participations_room_join_order"


class ParticipationModel(Base):
    __tablename__ = "participations"
    # __table_args__: 컬럼 하나에 붙이기 어려운 테이블 단위 설정(여러 컬럼 unique 등)
    __table_args__ = (
        # 한 회원은 동시에 한 방에만 (ADR-011). 예전 unique=True와 같은 제약에 이름만 붙였다.
        #   이름이 있어야 위반 시 "이미 참가 중"(400)으로 정확히 바꿀 수 있다 (ADR-013 AD-06)
        UniqueConstraint("user_id", name=UQ_PARTICIPATION_USER),
        # 안전망 (ADR-013 AD-07): 한 방 안에서 입장 순번이 겹치면 저장 자체가 실패한다.
        #   잠금이 제대로 걸려 있으면 절대 생기지 않는다.
        #   생기면 버그 → 일부러 변환하지 않고 500으로 드러낸다.
        #   잠금 전에는 순번이 겹친 채 "조용히" 저장됐다 (기준선 측정)
        UniqueConstraint("room_id", "join_order", name=UQ_PARTICIPATION_JOIN_ORDER),
    )

    # 두 컬럼에 primary_key=True -> 복합PK (room_id, user_id)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    # unique는 위 __table_args__에서 이름을 붙여 건다
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    # (아래 컬럼들은 그대로)
```

**고려사항 — DB를 다시 만들어야 한다**
- 이 프로젝트는 마이그레이션 도구가 없다(DRV-C-04). `create_all`은 **없는 테이블만** 만들고, 이미 있는 테이블의 제약은 바꾸지 않는다.
- 그래서 개발 DB와 측정 DB를 비우고 앱을 다시 띄워 테이블을 새로 만든다. (개발 DB 데이터는 사라진다)

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking_bench -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

- 통합 테스트 DB는 테스트가 시작할 때 `drop_all` → `create_all`을 하므로 따로 할 일이 없다.
- 확인: `\d participations`에 두 제약 이름이 보이면 된다.

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking -c "\d participations"
```

---

## 6단계 — 저장소: 잠그며 읽기 + 오류 번역

**목표**: 계약(4단계)을 PostgreSQL로 구현하고, DB 오류를 우리 예외로 **번역**한다. DB 오류 코드를 아는 곳은 이 파일 하나뿐이어야 한다(계층 격리).

`src/rooms/infrastructure/repositories.py`

① import 수정·추가:

```python
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth.infrastructure.models import UserModel
from exceptions import ServiceBusyError
# (기존 import들 …)
from rooms.domain.exceptions import AlreadyParticipatingError
# (기존 import들 …)
from rooms.infrastructure.models import (
    UQ_PARTICIPATION_USER,
    ParticipationLogModel,
    ParticipationModel,
    RoomModel,
    TeamModel,
)
```

> import 순서는 `uv run ruff check --fix`가 자동으로 맞춰 준다.

② import 아래, 클래스 위에 오류 해석 도우미 두 개:

```python
# PostgreSQL 오류 코드(SQLSTATE) — "잠금을 lock_timeout 안에 못 얻음"
LOCK_NOT_AVAILABLE = "55P03"


def _sqlstate(error: DBAPIError) -> str | None:
    """SQLAlchemy가 감싼 DB 드라이버(asyncpg) 오류에서 SQLSTATE 코드를 꺼낸다"""
    return getattr(error.orig, "sqlstate", None)


def _constraint_name(error: IntegrityError) -> str | None:
    """unique 위반 등에서 "어느 제약이 깨졌는지" 이름을 꺼낸다.
    error.orig = SQLAlchemy 어댑터 오류
    error.orig.__cause__ = asyncpg 원래 오류 (constraint_name 속성을 가진다)"""
    cause = getattr(error.orig, "__cause__", None)
    return getattr(cause, "constraint_name", None)
```

> **오류가 세 겹으로 싸여 있다**: SQLAlchemy `IntegrityError` → `.orig`(SQLAlchemy의 asyncpg 어댑터 오류) → `.__cause__`(asyncpg 원래 오류). 오류 메시지 문자열을 `in`으로 찾는 방법보다 속성으로 꺼내는 쪽이 안전하다(메시지 문구는 버전·언어 설정에 따라 바뀔 수 있다).

③ 생성자에 잠금 대기 시간 받기:

```python
    def __init__(self, session: AsyncSession, lock_timeout_ms: int = 2000) -> None:
        # 동일 요청 안에서는 서비스, 레파지토리가 세션 하나를 함께 쓴다.
        self.session = session
        # 방 잠금 최대 대기(ms). container가 설정(db_lock_timeout_ms)에서 넣어 준다 (ADR-013 AD-02)
        self.lock_timeout_ms = lock_timeout_ms
```

④ `find_by_id` 아래에 `find_by_id_for_update`, 그리고 `_find_model`에 `for_update` 옵션:

```python
    #### 개념: 비관적 잠금 SELECT ... FOR UPDATE (ADR-013 AD-01)
    # "읽은 뒤 바꿀 테니, 내가 끝날 때까지 아무도 이 행을 바꾸지(잠그지) 마라"
    #
    #   요청 A: SELECT rooms ... FOR UPDATE  → 잠금 획득 → 검사 → 저장 → commit(잠금 해제)
    #   요청 B: SELECT rooms ... FOR UPDATE  → (A가 끝날 때까지 대기) → A가 저장한 최신 상태를 읽음
    #
    # - 잠그는 것은 rooms 행 하나뿐이다. teams·participations 행은 잠그지 않는다.
    #   그래도 충분한 이유: 방을 바꾸는 모든 쓰기 동작이
    #   "방 행부터 잠그고" 시작하기로 약속했기 때문(CONV-08).
    #   팀 변경처럼 rooms 행 값이 안 바뀌는 동작도 잠금은 똑같이 잡는다 (03-domain DC-03)
    # - 잠금은 commit/rollback 때 풀린다. 이 프로젝트는 요청이 끝날 때 get_db가 commit한다 (D-029)
    async def find_by_id_for_update(self, room_id: int) -> Room | None:
        # 1) 이 트랜잭션에만 잠금 대기 상한을 건다 (SET LOCAL = 트랜잭션이 끝나면 원래대로)
        #    set_config(이름, 값, true)의 true가 LOCAL이라는 뜻이다.
        #    SET LOCAL lock_timeout = '...' 문장은 값 자리에 바인드 파라미터(:v)를 못 써서,
        #    문자열을 직접 이어 붙이는 대신
        #    set_config 함수 + 바인드 파라미터를 쓴다(SQL 주입 방지 습관)
        await self.session.execute(
            text("SELECT set_config('lock_timeout', :timeout, true)"),
            {"timeout": f"{self.lock_timeout_ms}ms"},
        )
        try:
            # 2) 방 행을 잠그며 읽는다
            model = await self._find_model(room_id, for_update=True)
        except DBAPIError as error:
            # 3) lock_timeout 안에 잠금을 못 얻으면 PostgreSQL이 55P03 오류를 낸다
            #    → "바빠서 거절"(409)
            #    DB 오류 코드는 인프라만 안다. 바깥에는 우리 예외로 바꿔서 내보낸다(계층 격리)
            if _sqlstate(error) == LOCK_NOT_AVAILABLE:
                raise ServiceBusyError() from error
            raise
        if model is None:
            return None
        return self._to_domain(model)

    # 파일/클래스 안에서만 쓰는 메서드 -> _ 표시
    async def _find_model(self, room_id: int, *, for_update: bool = False) -> RoomModel | None:
        """
        방 ORM 객체를 team, participation, participation의 team까지 한 번에 읽어온다
        (save도 재사용한다)
        for_update=True면 rooms 행을 FOR UPDATE로 잠그며 읽는다
        """
        stmt = (
            select(RoomModel)
            .where(RoomModel.id == room_id)
            .options(
                selectinload(RoomModel.teams),
                selectinload(RoomModel.participations).selectinload(ParticipationModel.team),
            )
        )
        if for_update:
            stmt = (
                # FOR UPDATE: 첫 SELECT(rooms)에만 붙는다.
                #   selectinload의 추가 SELECT(teams 등)에는 안 붙는다
                stmt.with_for_update()
                #### 주의: identity map과 populate_existing
                # 세션은 한 번 읽은 행을 "identity map"에 기억해 두고, 같은 행을 다시 SELECT해도
                # 이미 가진 객체를 그대로 돌려준다(값을 새로 덮어쓰지 않음).
                # 서비스가 잠금 전에 같은 방을 한 번 읽었다면(빠른 거절),
                # 잠금 뒤에도 "잠금 전의 낡은 값"을 보게 된다 → 잠금을 걸어도 정합성이 깨진다!
                # populate_existing=True: 이미 가진 객체라도
                #   방금 읽은 DB 값으로 덮어쓴다(관계 컬렉션 포함)
                .execution_options(populate_existing=True)
            )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

⑤ `save()`의 맨 끝 flush를 감싼다:

```python
        # 4. flush -> SQL을 DB로 보낸다, 확정(commit)은 안한다
        # 이 시점에서 새로운 방 / 룸 / 로그 테이블 행의 id가 입력된다.
        try:
            await self.session.flush()
        except IntegrityError as error:
            # 한 회원 한 방(ADR-011)은 방 잠금으로 막을 수 없다 — 서로 다른 방을 각각 잠그기 때문.
            #   예) 같은 회원이 1번 방·2번 방에 동시에 참가 → 둘 다 "현재 참가 없음"을 읽고 INSERT
            #   → 두 번째 INSERT가 user_id unique에 걸린다 = DB가 마지막 방어선 (ADR-013 AD-06)
            # 그 제약 위반만 도메인 예외(400 "이미 다른 방에 참가 중입니다")로 바꾼다.
            # 다른 제약(예: 순번 안전망 uq_participations_room_join_order) 위반은
            #   버그 신호이므로 그대로 올려 500.
            if _constraint_name(error) == UQ_PARTICIPATION_USER:
                raise AlreadyParticipatingError() from error
            raise
```

**고려사항**
- **`populate_existing`을 빼먹으면 생기는 일**: 8단계의 "빠른 거절"이 잠금 전에 방을 한 번 읽는다. 이때 세션이 그 방을 기억해 두므로, 잠금 뒤 SELECT가 최신 행을 가져와도 SQLAlchemy는 **기억해 둔 옛 객체**를 돌려준다. 잠금은 걸렸는데 검사는 낡은 값으로 하게 되어, 정원 초과가 그대로 재현된다. 잠금 코드에서 가장 찾기 어려운 버그라 꼭 기억해 두자.
- `raise … from error`: 원래 DB 오류를 원인(`__cause__`)으로 남겨 둔다. 로그에서 "왜 409/400이 됐는지" 추적할 수 있다.
- 잠금 대기 초과(`55P03`)나 unique 위반이 나면 그 트랜잭션은 더 쓸 수 없는 상태가 된다. 예외가 올라가면 `get_db`가 rollback하므로 따로 정리할 필요는 없다.
- **교착 상태(deadlock)가 안 생기는 이유**: 한 요청이 잠그는 방 행은 하나뿐이다. 두 요청이 서로 상대의 잠금을 기다리는 순환이 만들어질 수 없다. 나중에 "방 두 개를 한 번에 잠그는" 기능을 만들면 **항상 같은 순서(예: id 오름차순)로** 잠가야 한다.

---

## 7단계 — 조립: 저장소에 설정 값 넣기

`src/container.py`

```python
    # 잠금 대기 상한은 설정에서 받는다(ADR-003).
    # 세션은 요청마다 presentation이 넣는다(rooms__session=db)
    room_repository = providers.Factory(
        SqlAlchemyRoomRepository,
        lock_timeout_ms=config.db_lock_timeout_ms,
    )
```

**고려사항**
- `config`는 `main.create_app()`이 `settings.model_dump()`로 채운다. 그래서 1단계에서 `Settings`에 필드를 추가하면 `config.db_lock_timeout_ms`로 바로 꺼낼 수 있다.
- `Factory`는 부를 때마다 새 객체를 만든다. 생성자 인자 중 `lock_timeout_ms`는 여기서 고정하고, `session`은 요청마다 `factory(rooms__session=db)`로 넣는다(CONV-04).

---

## 8단계 — 응용 서비스: 잠금 순서 지키기

**목표**: 방을 바꾸는 메서드 다섯 개가 모두 "잠그며 읽기"를 쓰게 하고, 참가는 **빠른 거절 → 잠금 → 잠금 뒤 읽기** 순서를 지킨다(AD-01·05).

`src/rooms/application/service.py`

① 클래스 위 주석:

```python
# 방을 바꾸는 흐름 (SEQ-05~09)
# 도전 A (ADR-013): 방을 바꾸는 메서드는 모두 _get_room_for_update로 방을 "잠그며" 읽는다 (CONV-08)
#   잠금 → 도메인 메서드 → save → (요청 끝) commit에서 잠금 해제
#   같은 방 요청은 이 구간을 한 번에 하나씩 지나가므로,
#   도메인 검사(정원·팀 정원·방장…)가 그대로 유효하다
```

② `join_room` 전체:

```python
    # 참가 — 같은 방에 다시 요청하면 도메인이 기존 기록을 돌려주고 변화가 없다
    async def join_room(self, room_id: int, user_id: int) -> Room:
        now = self.clock()

        # ① 빠른 거절 (ADR-013 AD-05) — 잠금 없이 읽은 "사본"으로 도메인 규칙을 먼저 돌려 본다
        #    인기 방이 이미 찼다면 잠금 줄에 서지 않고 바로 400("정원이 마감되었습니다")
        #    - 규칙을 서비스에 다시 쓰지 않고 room.join()을 그대로 쓴다(규칙은 도메인 한 곳에만)
        #    - 사본은 저장하지 않고 버린다. 여기서 통과해도 ③에서 최신 상태로 다시 검사한다
        #    - 이미 이 방에 있는 회원의 재요청은 건너뛴다(꽉 찬 방이어도 "변화 없음"이 정답, D-006)
        snapshot = await self._get_room(room_id)
        if snapshot.participation_of(user_id) is None:
            snapshot.join(user_id, None, now)

        # ② 방 잠금 — 앞 요청이 commit할 때까지 기다린다(최대 lock_timeout, 넘으면 409)
        room = await self._get_room_for_update(room_id)

        # ③ 잠금 "뒤에" 현재 참가를 읽는다 (순서가 중요!)
        #    잠금 전에 읽으면: 같은 회원이 같은 방에 두 번 동시에 요청할 때 둘 다 "참가 없음"을 읽고
        #    둘 다 INSERT → PK 위반(500).
        #    잠금 뒤에 읽으면 두 번째 요청은 첫 번째가 commit한 참가를 보고
        #    도메인이 "같은 방 재요청 → 변화 없음"으로 처리한다
        current = await self.rooms.find_current_participation(user_id)
        room.join(user_id, current, now)
        saved = await self.rooms.save(room)
        return saved
```

③ 나머지 네 메서드(`rename_room`, `change_team`, `leave_room`, `start_game`)는 첫 줄만 바꾼다.

```python
        room = await self._get_room_for_update(room_id)   # 기존: await self._get_room(room_id)
```

④ 클래스 맨 끝에 도우미 추가:

```python
    # 잠그며 읽기 — 방을 "바꾸는" 메서드는 반드시 이것으로 읽는다 (CONV-08, GATE-09)
    async def _get_room_for_update(self, room_id: int) -> Room:
        room = await self.rooms.find_by_id_for_update(room_id)
        if room is None:
            raise RoomNotFoundError()
        return room
```

**고려사항**
- **왜 빠른 거절에 `current`(현재 참가)를 `None`으로 넘기나?** 빠른 거절은 "이미 찼나 / 삭제됐나"만 빨리 보려는 것이다. 현재 참가를 읽으면 SQL이 하나 늘고, 어차피 ③에서 잠금 뒤에 다시 정확히 검사한다.
- **빠른 거절의 비용**: 참가 성공 경로에 SQL이 3번(방·팀·참가자) 늘어난다. 처리량 한계(VC-04, 86 TPS 이상)를 깎을 수 있으니 7단계 측정에서 확인한다. 기준을 못 넘으면 ①을 지우는 것이 첫 번째 조정 후보다.
- **`create_room`은 그대로 둔다.** 잠글 방이 아직 없다. 같은 회원이 동시에 방 두 개를 만들거나 방 만들기와 참가를 동시에 하면, 6단계의 unique 위반 번역이 막아 준다.
- `now = self.clock()`을 한 번만 부르는 이유: 사본 검사와 실제 참가에 같은 시각을 쓰기 위해서다(CONV-06).

---

## 9단계 — 단위 테스트: "잠금 조회를 썼는가"

진짜 잠금은 DB가 있어야 확인할 수 있다(10단계). 단위 테스트에서는 **서비스가 올바른 메서드를 올바른 순서로 부르는지**만 본다.

`tests/unit/fakes/repositories.py` — `FakeRoomRepository`에 추가한다.

```python
    def __init__(self) -> None:
        self.rooms: dict[int, Room] = {}
        self.locked_room_ids: list[int] = []

    # (find_by_id 아래)
    async def find_by_id_for_update(self, room_id: int) -> Room | None:
        # 메모리 가짜: 동시 요청이 없으므로 잠금 없이 같은 방을 돌려준다
        self.locked_room_ids.append(room_id)  # 테스트가 "잠금 조회를 썼는지" 확인할 수 있게 기록
        return self.rooms.get(room_id)
```

`tests/unit/test_room_service_locking.py` (새 파일)

```python
# 응용 서비스가 "잠그며 읽기"를 올바른 순서로 쓰는지 확인 (ADR-013, CONV-08)
# 진짜 잠금(동시 요청)은 DB가 있어야 하므로 통합 테스트(test_concurrency.py)에서 본다.
# 여기서는 가짜 저장소가 남긴 기록(locked_room_ids)으로 "어느 메서드가 잠금 조회를 썼는지"만 본다.
from datetime import UTC, datetime

import pytest

from rooms.application.service import RoomApplicationService
from rooms.domain.exceptions import RoomFullError
from rooms.domain.participation import TeamSide
from tests.unit.fakes.repositories import FakeRoomRepository

NOW = datetime(2026, 11, 10, tzinfo=UTC)


async def make_service_with_room(member_ids: list[int]) -> tuple[RoomApplicationService, int]:
    """member_ids[0]이 방장인 방을 만들고 나머지를 순서대로 참가시킨다"""
    repo = FakeRoomRepository()
    service = RoomApplicationService(rooms=repo, clock=lambda: NOW)
    room = await service.create_room(member_ids[0], "테스트 방")
    for user_id in member_ids[1:]:
        await service.join_room(room.id, user_id)
    repo.locked_room_ids.clear()  # 준비 단계 기록은 지운다
    return service, room.id


async def test_join_locks_room():
    service, room_id = await make_service_with_room([1])
    await service.join_room(room_id, 2)
    assert service.rooms.locked_room_ids == [room_id]


async def test_join_full_room_is_rejected_before_locking():
    # 빠른 거절(AD-05): 이미 찬 방이면 잠금 조회까지 가지 않는다
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    with pytest.raises(RoomFullError):
        await service.join_room(room_id, 5)
    assert service.rooms.locked_room_ids == []


async def test_rejoin_same_full_room_is_no_change():
    # 이미 이 방에 있는 회원의 재요청은 꽉 찬 방이어도 "변화 없음"(D-006) — 빠른 거절 대상 아님
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    room = await service.join_room(room_id, 4)
    assert room.current_count == 4


async def test_every_write_operation_locks_room():
    service, room_id = await make_service_with_room([1, 2, 3, 4])
    # A팀(1·2), B팀(3·4) — 2가 나가 A팀에 자리가 생기면 3이 A팀으로 옮긴다
    await service.rename_room(room_id, 1, "새 제목")
    await service.leave_room(room_id, 2)
    await service.change_team(room_id, 3, TeamSide.A)
    assert service.rooms.locked_room_ids == [room_id, room_id, room_id]
```

**확인**

```bash
uv run pytest tests/unit -q
```

---

## 10단계 — 통합 테스트: 진짜 동시 요청

**목표**: 실제 PostgreSQL에 요청을 **동시에** 보내 AC-18과 409를 확인한다.

`tests/integration/test_concurrency.py` (새 파일)

```python
# 동시 요청 정합성 통합 테스트 (AC-18, ADR-013) — 실제 PostgreSQL 필요(TEST_DATABASE_URL)
#
# 개념: asyncio.gather로 "동시에" 보내기
#   gather(a(), b(), c())는 세 코루틴을 한꺼번에 시작한다. 각 요청이 DB 응답을 기다리는(await) 동안
#   다른 요청이 진행되므로, 실제 서버에 여러 사용자가 동시에 누른 것과 같은 경합이 생긴다.
#   요청마다 get_db가 세션(=DB 연결·트랜잭션)을 따로 열기 때문에 DB 잠금도 실제처럼 동작한다.
import asyncio

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def create_room(client: AsyncClient, host) -> int:
    res = await client.post("/api/rooms", json={"title": "동시성"}, headers=host.headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]


async def participant_count(engine: AsyncEngine, room_id: int) -> int:
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT count(*) FROM participations WHERE room_id = :id"), {"id": room_id}
        )
        return result.scalar_one()


# AC-18-1: 빈자리 1개인 방에 10명이 동시에 참가 → 성공 1, 거절 9, 참가자 4명
async def test_last_seat_concurrent_join(client, make_member, engine):
    members = [await make_member(f"cc{i:02d}") for i in range(13)]
    host, early, racers = members[0], members[1:3], members[3:]
    room_id = await create_room(client, host)
    for member in early:  # 방장 + 2명 = 3명, 빈자리 1개
        res = await client.post(f"/api/rooms/{room_id}/participants", headers=member.headers)
        assert res.status_code == 200

    responses = await asyncio.gather(
        *(client.post(f"/api/rooms/{room_id}/participants", headers=m.headers) for m in racers)
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses.count(200) == 1
    assert statuses.count(400) == 9  # "정원이 마감되었습니다" — 5xx 없음
    assert await participant_count(engine, room_id) == 4


# AC-18-2: 같은 회원이 서로 다른 방 2개에 동시 참가 → 현재 참가 1건, 나머지는 400(500 아님)
async def test_same_member_two_rooms_concurrently(client, make_member, engine):
    host1, host2, player = [await make_member(f"tw{i:02d}") for i in range(3)]
    room1 = await create_room(client, host1)
    room2 = await create_room(client, host2)

    responses = await asyncio.gather(
        client.post(f"/api/rooms/{room1}/participants", headers=player.headers),
        client.post(f"/api/rooms/{room2}/participants", headers=player.headers),
    )

    assert sorted(r.status_code for r in responses) == [200, 400]
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT count(*) FROM participations WHERE user_id = :id"), {"id": player.id}
        )
        assert result.scalar_one() == 1


# 같은 회원이 같은 방에 동시에 두 번(연타) → 둘 다 200, 참가는 1건 (잠금 뒤 읽기, D-006)
async def test_same_member_same_room_double_click(client, make_member, engine):
    host, player = await make_member("dc00"), await make_member("dc01")
    room_id = await create_room(client, host)

    responses = await asyncio.gather(
        *(
            client.post(f"/api/rooms/{room_id}/participants", headers=player.headers)
            for _ in range(2)
        )
    )

    assert [r.status_code for r in responses] == [200, 200]
    assert await participant_count(engine, room_id) == 2  # 방장 + player


# AC-18-4: 방장이 게임 시작을 5번 동시에 → 성공 1건, 해산 1회
async def test_start_game_concurrently(client, make_member, engine):
    host, *others = [await make_member(f"sg{i:02d}") for i in range(4)]
    room_id = await create_room(client, host)
    for member in others:
        await client.post(f"/api/rooms/{room_id}/participants", headers=member.headers)

    responses = await asyncio.gather(
        *(client.post(f"/api/rooms/{room_id}/start", headers=host.headers) for _ in range(5))
    )

    assert sorted(r.status_code for r in responses).count(200) == 1
    assert all(r.status_code < 500 for r in responses)
    assert await participant_count(engine, room_id) == 0


# 잠금 대기 상한(AD-02): 다른 트랜잭션이 방을 오래 잡고 있으면 409(바빠서 거절)
async def test_lock_timeout_returns_409(client, make_member, engine):
    host, player = await make_member("lt00"), await make_member("lt01")
    room_id = await create_room(client, host)

    async with engine.connect() as conn:
        trans = await conn.begin()
        # psql에서 BEGIN; SELECT ... FOR UPDATE; 하고 놔두는 것과 같다 (VC-08 재현 방법)
        await conn.execute(text("SELECT id FROM rooms WHERE id = :id FOR UPDATE"), {"id": room_id})
        res = await client.post(f"/api/rooms/{room_id}/participants", headers=player.headers)
        await trans.rollback()

    assert res.status_code == 409
    assert await participant_count(engine, room_id) == 1
```

**실행** — 테스트 전용 DB를 한 번 만들고, 주소를 환경변수로 넘긴다.

```bash
docker exec matchmaking-db psql -U matchmaking -d matchmaking -c "create database matchmaking_test owner matchmaking;"
```

```bash
TEST_DATABASE_URL="postgresql+asyncpg://matchmaking:matchmaking@localhost:5432/matchmaking_test" uv run pytest tests -q
```

**해 볼 만한 실험 — "테스트가 정말 문제를 잡는가?"**
- 8단계 이전 코드(잠금 없음)에서 위 테스트를 돌리면 409 테스트를 뺀 4개가 **실패**한다: 정원 초과, 500(`IntegrityError`), 해산 여러 번.
- ⚠️ 잠금 대기 상한이 없는 옛 코드에서 `test_lock_timeout_returns_409`를 돌리면 **끝나지 않는다.** 테스트가 쥔 잠금을 요청이 무한정 기다리고, 테스트는 그 응답을 기다리는 교착 상태가 되기 때문이다. 옛 코드로 실험할 때는 `-k "not lock_timeout"`을 붙인다. 이것이 바로 대기 상한이 필요한 이유를 직접 보여 준다.

**고려사항**
- 테스트 엔진의 커넥션 풀 기본 크기는 5 + 넘침 10 = 15다. 동시 요청을 15개보다 많이 보내면 풀 대기가 생긴다.
- 동시성 테스트는 "운이 좋아서" 통과할 수도 있다. 기대한 경합이 실제로 일어났는지는 바꾸기 전 코드에서 **실패하는 것**을 한 번 확인해 두면 믿을 수 있다(위 실험).

---

## 11단계 — 화면 `api.js`: 5초 시간 제한

**목표**: 클릭 하나(토큰 재발급 포함)를 **5초** 안에 끝낸다(ADR-014). `refreshAccessToken`, `sendOnce`, `apiRequest` 세 함수를 아래로 바꾼다.

```javascript
// ---------------------------------------------------------------- 요청 시간 제한 (ADR-014)
// 사용자 동작 하나(클릭)는 5초 안에 결론이 나야 한다 (CQ-10).
// 서버는 4초 안에 결론을 내도록 만들었고(ADR-013), 네트워크·화면 여유 1초를 더해 5초에서 끊는다.
const REQUEST_TIMEOUT_MS = 5000;

// 개념: AbortController
//   fetch에 "중단 스위치(signal)"를 넘겨 두고, 나중에 controller.abort()를 부르면
//   진행 중인 fetch가 AbortError로 즉시 끝난다. 브라우저 fetch에는 시간 제한 옵션이 따로 없어서
//   setTimeout(() => controller.abort(), 5000)으로 "5초 뒤 스위치를 내리는" 방식으로 만든다.
//   주의: 브라우저가 기다리기를 멈출 뿐, 이미 서버에 도착한 요청을 취소하지는 못한다(서버는 계속 처리할 수 있다).

// refresh 토큰으로 access 토큰을 재발급
//   signal: 재발급도 "사용자 동작 하나"의 5초 안에 포함되므로 같은 중단 스위치를 받는다
async function refreshAccessToken(signal) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    // refresh 토큰이 없으면 재발급을 요청하지 않음
    if (!refreshToken) {
        return false;
    }

    try {
        // 저장된 refresh 토큰을 JSON 본문으로 보냄
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
            signal: signal,
        });

        // 서버가 재발급을 거부하면 실패를 반환
        if (!response.ok) {
            return false;
        }

        // 응답에 저장 가능한 access 토큰이 있는지 확인
        const data = await response.json();
        if (typeof data.access_token !== 'string' || !data.access_token) {
            return false;
        }

        // 기존 refresh 토큰을 유지하고 access 토큰만 교체
        saveTokens(data.access_token, null);
        return true;
    } catch (error) {
        // 시간 초과(AbortError)면 그대로 다시 던져 apiRequest가 "결과 모름"으로 처리하게 한다
        if (error.name === 'AbortError') {
            throw error;
        }
        // 그 밖의 통신 또는 응답 해석 실패는 재발급 실패로 본다
        return false;
    }
}

// access 토큰을 붙여 API 요청을 한 번 보냄
async function sendOnce(method, url, body, signal) {
    // 요청에 사용할 헤더를 준비
    const headers = {};
    const token = getAccessToken();

    // access 토큰이 있으면 인증 헤더를 추가
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    // 요청 메서드와 헤더, 중단 스위치를 설정
    const options = { method: method, headers: headers, signal: signal };

    // 본문을 전달받으면 JSON으로 변환
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    return fetch(url, options)
}

// api 요청 결과를 공통 형식으로 변환
//   반환: { ok, status, data, timedOut }
//   - status 0 = 결과를 모름(5초 시간 초과 또는 통신 실패). timedOut이 true면 시간 초과
//   - status 409 = 서버가 바빠서 처리하지 못함(ADR-013) — 다시 시도하면 될 수 있음
async function apiRequest(method, url, body) {
    // 이 사용자 동작 전체(첫 요청 → 401이면 재발급 → 재요청)에 5초 제한을 하나만 건다
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        let response;
        try {
            // 현재 access 토큰으로 요청
            response = await sendOnce(method, url, body, controller.signal);

            // 401이면 재발급 성공 후 원래 요청을 한번 더 보냄
            if (response.status === 401 && (await refreshAccessToken(controller.signal))) {
                response = await sendOnce(method, url, body, controller.signal);
            }
        } catch (error) {
            // 시간 초과 또는 통신 실패 → 서버가 처리했는지 알 수 없다("결과 모름")
            return {
                ok: false,
                status: 0,
                timedOut: error.name === 'AbortError',
                data: { detail: '최신 정보를 불러오지 못했습니다' },
            };
        }
        // 인증을 복구하지 못하면 토큰을 삭제하고 로그인 화면으로 이동
        if (response.status === 401) {
            clearTokens();
            goToLogin(true);
            return {
                ok: false,
                status: 401,
                data: { detail: '로그인이 만료되었습니다. 다시 로그인해 주세요' },
            };
        }
        // 응답 본문을 JSON으로 읽음 (상태 코드는 이미 받았으므로 결과는 확정된 상태)
        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            // JSON으로 읽을 수 없는 본문은 null로 둠
            data = null;
        }

        return {
            ok: response.ok,
            status: response.status,
            data: data,
        };
    } finally {
        // 결론이 났으면 타이머를 꼭 정리한다(안 그러면 5초 뒤 쓸데없이 abort가 불린다)
        clearTimeout(timer);
    }
}
```

**고려사항**
- **시간 제한은 공통 함수 한 곳에만** 둔다. 그러면 목록 조회·방 만들기·팀 변경 등 `apiRequest`를 쓰는 모든 요청이 같은 5초 상한을 얻는다.
- 시간 초과도 기존과 같이 `status: 0`으로 돌려준다. 기존 화면 코드는 `status 0`을 "조회 실패"로 처리하므로 조회 화면은 고칠 필요가 없다. 쓰기 동작은 12단계에서 "결과 모름" 문구로 바꾼다.
- `try { … } finally { clearTimeout(timer) }`: 어떤 경로로 끝나든 타이머를 정리하는 습관이다.

---

## 12단계 — 화면 `rooms.js`: 진행 표시·버튼 잠금·결론 문구

**목표**: 즉시 "입장 중…" → 3초 뒤 지연 안내 → 상태 코드별 결론 문구. 처리 중에는 모든 참가·만들기 버튼을 잠근다(ADR-014, AD-09·10).

① `setupRefreshButton` 위에 공통 도우미:

```javascript
// ------------------------------------------------------------------ 요청 진행 표시 (ADR-014)
// 고객 요구(CQ-08~12): 누르는 즉시 "처리 중", 3초 지나면 "지연 안내", 5초 안에 결론.
//   5초 시간 제한은 api.js의 apiRequest가 건다. 여기서는 화면에 무엇을 보여 줄지만 정한다.
// 결론별 문구는 상태 코드로 고른다(문구 문자열로 분기하지 않는다, D-016·D-034):
//   409 = 서버가 바빠서 처리하지 못함, 0 = 결과 모름(시간 초과·통신 실패), 그 밖 = 서버가 준 사유
const SLOW_NOTICE_MS = 3000;
const SLOW_TEXT = "사람이 많아 처리가 늦어지고 있습니다";
const MESSAGES = {
  // 참가 버튼(목록·상세) — 고객이 정한 문구
  join: {
    progress: "입장 중…",
    busy: "입장하지 못했습니다. 다시 시도해 주세요",
    unknown: "입장 결과를 확인하지 못했습니다.",
  },
  // 그 밖의 쓰기 동작(방 만들기·제목·팀·나가기·게임 시작) — 같은 구조의 기본 문구
  other: {
    progress: "처리 중…",
    busy: "처리하지 못했습니다. 다시 시도해 주세요",
    unknown: "처리 결과를 확인하지 못했습니다.",
  },
};

// 진행 표시를 켜고, "끄는 함수"를 돌려준다.
//   const stop = startProgress(MESSAGES.join);  …요청…  stop();
// setTimeout은 3초 뒤 문구를 한 번 바꾸는 "단발 타이머"다. 서버에 다시 묻지 않으므로
// 자동 조회 금지(ADR-012, DRV-C-05)와 부딪히지 않는다. 반복 타이머는 쓰지 않는다.
function startProgress(texts) {
  showNotice(texts.progress, "");
  showingLoadError = false;
  const slowTimer = setTimeout(() => showNotice(SLOW_TEXT, ""), SLOW_NOTICE_MS);
  return () => clearTimeout(slowTimer);
}

// 실패 결과 → 화면 문구
function writeFailureMessage(result, texts) {
  if (result.status === 409) {
    return texts.busy;
  }
  if (result.status === 0) {
    // 결과 모름: 서버가 실제로는 처리했을 수도 있다. 자동으로 다시 확인하지 않고(폴링 금지)
    // 사용자가 [새로고침]하면 목록의 "현재 참가 방"에서 확인할 수 있다(CQ-11)
    return texts.unknown;
  }
  return errorMessage(result);
}
```

② `renderRoomRows` 안 참가 버튼 부분:

```javascript
    joinButton.textContent = "참가";
    // 꽉 찬 방인지 버튼에 적어 둔다 — 처리 중 잠갔다가 풀 때 "원래 꺼져 있던 버튼"을 구분하기 위해
    joinButton.dataset.full = String(room.is_full);
    joinButton.disabled = room.is_full || listBusy;
    joinButton.addEventListener("click", () => joinRoom(room.id));
```

③ 기존 `joinRoom`·`createRoom`을 아래로 바꾼다.

```javascript
// 목록 화면에서 쓰기 요청(참가·방 만들기)을 보내는 중인지 (ADR-014, AD-09)
// 상세 화면의 detailBusy와 같은 방식: 요청 하나가 끝날 때까지 "모든" 참가·만들기 버튼을 잠근다.
// 누른 버튼만 잠그면 다른 방의 [참가]를 또 눌러 같은 회원의 중복 요청이 생긴다(DC-14).
let listBusy = false;

function setListBusy(busy) {
  listBusy = busy;
  for (const button of document.querySelectorAll("#room-rows button")) {
    // 꽉 찬 방의 버튼은 처리가 끝나도 계속 꺼 둔다
    button.disabled = busy || button.dataset.full === "true";
  }
  document.getElementById("create-button").disabled = busy;
}

// 목록 화면 쓰기 요청의 공통 흐름: 잠금 → 진행 표시 → 요청 → 결론
//   성공하면 onSuccess(data)를 부르고(보통 화면 이동), 실패하면 버튼을 풀고 문구를 보인다.
async function sendListWrite(texts, method, url, body, onSuccess) {
  if (listBusy) {
    return; // 이미 처리 중이면 무시(연타 방지)
  }
  setListBusy(true); // ① 즉시: 버튼 잠금 + 진행 표시 (요청을 보내기 "전"에 화면부터 바꾼다)
  const stopProgress = startProgress(texts);
  const result = await apiRequest(method, url, body); // ② 최대 5초 (api.js)
  stopProgress();
  if (result.ok) {
    onSuccess(result.data); // ③-a 성공: 화면 이동. 이동하는 동안 버튼은 잠근 채로 둔다
    return;
  }
  setListBusy(false); // ③-b 실패: 버튼을 풀고 결론 문구
  if (result.status !== 401) {
    showError(writeFailureMessage(result, texts));
  }
}

function joinRoom(roomId) {
  return sendListWrite(MESSAGES.join, "POST", "/api/rooms/" + roomId + "/participants", undefined, () => {
    location.href = "/rooms/" + roomId;
  });
}

function createRoom(event) {
  event.preventDefault();
  const title = document.getElementById("create-room-title").value;
  return sendListWrite(MESSAGES.other, "POST", "/api/rooms", { title }, (data) => {
    location.href = "/rooms/" + data.id;
  });
}
```

④ 상세 화면: `showChangeFailure`·`sendDetailChange`를 바꾼다.

```javascript
// 거부 사유를 보이고 상세를 1회 다시 읽는다. 해산된 방이면 400 뒤 조회가 410이라 목록으로 간다(AC-16-4).
// 결과 모름(status 0)이면 다시 읽지 않는다 — 결과를 스스로 확인하는 자동 조회가 되기 때문(ADR-014 옵션 D 기각).
async function showChangeFailure(result, texts) {
  if (result.status === 401) {
    return;
  }
  showError(writeFailureMessage(result, texts));
  if (result.status !== 0) {
    await loadRoomDetail();
  }
}

// 변경 요청 하나. 성공하면 응답 data를, 실패하면 null을 돌려준다. 성공 뒤에는 다시 조회하지 않는다.
//   texts: 진행·실패 문구 묶음 (참가 버튼은 MESSAGES.join, 나머지는 MESSAGES.other)
async function sendDetailChange(method, url, body, texts = MESSAGES.other) {
  if (detailBusy) {
    return null;
  }
  detailBusy = true;
  updateDetailButtons();
  const stopProgress = startProgress(texts);
  let result;
  try {
    result = await apiRequest(method, url, body);
  } finally {
    stopProgress();
    detailBusy = false;
    updateDetailButtons();
  }
  if (!result.ok) {
    await showChangeFailure(result, texts);
    return null;
  }
  hideNotice();
  showingLoadError = false;
  return result.data;
}
```

⑤ 상세 화면 참가 버튼만 참가 문구를 쓰게 한다.

```javascript
async function joinFromDetail() {
  const detail = await sendDetailChange("POST", detailUrl("/participants"), undefined, MESSAGES.join);
  if (detail) {
    renderDetail(detail);
  }
}
```

**고려사항**
- **"즉시" 표시의 의미**: `startProgress`를 `apiRequest`보다 **먼저** 부른다. 요청을 보내기 전에 화면부터 바뀌어야 "눌렸다"는 느낌을 준다.
- **보안**: 서버에서 온 문구는 지금처럼 `showNotice` → `textContent`로만 넣는다(XSS 방지). `innerHTML`을 쓰지 않는다.
- 성공해서 다른 화면으로 이동할 때는 버튼을 풀지 않는다. 이동하는 짧은 순간에 또 누르는 것을 막기 위해서다.
- 진행 문구가 평소(약 20ms)에도 잠깐 깜빡일 수 있다. ADR-014가 "감수할 점"으로 받아들인 부분이다.
- 게이트: `grep -rnE "setInterval|polling" src/static src/templates`가 0줄이어야 한다(ADR-012). **주석에 이 단어를 쓰면 게이트에 걸린다** — 실제로 이 가이드를 검증하다가 한 번 걸려서 주석을 "반복 타이머"로 바꿨다.

**확인**

```bash
node --check src/static/js/api.js
```

```bash
node --check src/static/js/rooms.js
```

```bash
grep -rnE "setInterval|polling" src/static src/templates
```

---

## 13단계 — 문서·게이트 갱신

코드와 문서가 어긋나지 않게 ADR-009를 가리키던 곳을 ADR-013으로 바꾼다.

| 파일 | 바꿀 내용 |
|---|---|
| `docs/02-arch/05-structure-conventions.md` CONV-08 | "(도전 A 적용 후)" 삭제. "방을 바꾸는 서비스 메서드(참가·제목·팀·나가기·게임 시작)는 `_get_room_for_update`(`RoomRepository.find_by_id_for_update`)로 방을 읽는다. 잠금 없는 `_get_room`은 참가의 빠른 거절 사본에만 쓴다(ADR-013)." |
| `docs/02-arch/06-quality-gates.md` GATE-09 | 근거를 ADR-013으로 바꾸고 명령을 아래로 교체 |
| `docs/02-arch/01-drivers.md` RISK-03~05, ARCH-Q-02 | "도전 A: ADR-009 …" → "ADR-013: 방 행 잠금(잠금 뒤 읽기) + lock_timeout + 제약 위반 400 변환" |
| `docs/02-arch/03-db-schema.md` | `participations` 제약에 `uq_participations_user_id`·`uq_participations_room_join_order` 추가, 동시성 설명의 ADR-009 → ADR-013 |
| `docs/02-arch/04-interfaces-api.md` | 오류 응답에 409(바빠서 거절) 추가, 참가 흐름(§ SEQ) 설명을 ADR-013 순서로 |

GATE-09 새 명령 — 잠금 없는 조회(`_get_room(`)은 정의 1줄 + 참가 빠른 거절 1줄, **정확히 2줄**이어야 한다.

```bash
grep -nE "^[^#]*(self\._get_room\(|def _get_room\()" src/rooms/application/service.py
```

> `^[^#]*`는 "줄 맨 앞부터 `#` 없이 이어진 부분"이라, `# room = await self._get_room(...)` 같은 주석 속 옛 코드는 세지 않는다. 옛 코드를 주석으로 남기는 것 자체도 금지 패턴 9에 걸리므로, 바꾼 코드는 지우고 기록은 git에 맡긴다.
>
> 예전 GATE-09 명령(`grep "find_by_id("` 0줄)은 빠른 거절 때문에 더는 맞지 않는다. 게이트도 결정이 바뀌면 함께 바꿔야 한다.

---

## 14단계 — 마무리 확인과 커밋 단위

**전체 확인**

```bash
uv run ruff check src tests
```

```bash
uv run ruff format --check src tests
```

```bash
TEST_DATABASE_URL="postgresql+asyncpg://matchmaking:matchmaking@localhost:5432/matchmaking_test" uv run pytest tests -q
```

기대: 린트 오류 0, 테스트 전부 통과(가이드 검증 때 96개).

**커밋 단위 제안** (CONV-13, 한 커밋에 한 가지 일)

| # | 커밋 | 단계 |
|---|---|---|
| 1 | `feat(be): 바빠서 거절 예외·409 핸들러와 대기 상한 설정 (ADR-013)` | 1~3 |
| 2 | `feat(be): 방 행 잠금 조회와 제약 위반 변환, 순번 안전망 제약 (ADR-013)` | 4~7 |
| 3 | `feat(be): 쓰기 동작 잠금 조회 적용, 참가 빠른 거절 (ADR-013)` | 8 |
| 4 | `test: 잠금 조회 단위 테스트와 동시 요청 통합 테스트 (AC-18)` | 9~10 |
| 5 | `feat(fe): 요청 5초 제한과 진행 표시·버튼 일괄 잠금 (ADR-014)` | 11~12 |
| 6 | `docs: CONV-08·GATE-09·드라이버·스키마 문서를 ADR-013 기준으로 갱신` | 13 |

**7단계(부하 테스트)로 넘어가기 전에 알아 둘 것**
- 측정 DB를 5단계 명령으로 다시 만든다(새 제약).
- `src/database.py`의 엔진은 `echo=True`(모든 SQL을 콘솔에 출력)라 처리량을 깎는다. **기준선도 이 조건에서 쟀으므로**, before/after 비교를 위해 7단계에서도 그대로 둔다. 바꾸려면 기준선부터 다시 잰다.
- 측정 스크립트에 추가할 것: 시간 제한 5초, 409 집계, s4(중복 요청)·s5(핫스팟 + 60 TPS 동시)·s6(과부하). 화면은 VC-08 체크리스트로 확인한다.
