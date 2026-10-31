# 앱 기동 때 DB 테이블과 시드가 만들어지는 과정

> 대상: 5인 팀 전원 — "Docker로 PostgreSQL을 띄웠는데 테이블이 없어요"에 대한 답
> 기준: `reference/agent-pipeline-blueprint` 브랜치의 참고 구현. `dev`에서 이름·시그니처를 같게 구현하면 똑같이 동작해요
> 표기: (A) 공통·앱 조립 / (B) 인증 / (C) 방 도메인 / (D) 방 DB

---

## 한 줄 요약

**Docker는 빈 DB만 만들어요. 테이블은 앱이 처음 뜰 때 `main.py`의 lifespan이 `create_all`로 만들고, 이어서 `seed_initial_data`가 시드 60건을 넣어요.**

그래서 다음 파일이 모두 구현돼야 테이블·시드가 생겨요.

| 파일 | 담당 | 역할 |
|---|---|---|
| `src/config.py`, `src/database.py` | A | `.env` 읽기, 엔진·세션·`Base` |
| `src/auth/infrastructure/models.py` | B | `users`, `token_blacklist` 설계도 |
| `src/rooms/infrastructure/models.py` | D | `rooms`, `teams`, `participations`, `participation_logs` 설계도 |
| `src/main.py` | A | 모델 import, lifespan(`create_all` → 시드 → commit) |
| `src/seed.py` | A | 시드 데이터 (B·C·D 코드를 불러 씀) |

## 전체는 세 구간이에요

| 구간 | 언제 | 하는 일 |
|---|---|---|
| **1. import 구간** | `uvicorn`이 `main.py`를 읽을 때 | 설정 읽기, 엔진 준비, 테이블 **설계도**를 `Base.metadata`에 등록 (DB 접속 없음) |
| **2. 시작 구간** | lifespan의 `yield` 전 | 실제 `CREATE TABLE`, 시드 INSERT, commit |
| **3. 종료 구간** | lifespan의 `yield` 뒤 | 엔진 정리 |

---

## 0. 시작점

```powershell
uv run uvicorn main:app --app-dir src --reload
```

`--app-dir src` 때문에 `src/`가 import 경로가 돼요. uvicorn은 `main` 모듈(`src/main.py`)을 import한 뒤 그 안의 `app` 객체를 찾아요.

---

## 1. import 구간 — 아직 DB에 접속하지 않아요

`src/main.py` 맨 위의 import 문이 위에서부터 차례로 실행돼요.

### 1-1. `import auth.infrastructure.models` (B)

이 줄 하나가 연쇄적으로 여러 파일을 불러요.

```
main.py
 └─ import auth.infrastructure.models          (B)
     └─ from database import Base               (A) database.py 처음 실행
         └─ from config import get_settings     (A) config.py 실행
```

1. **`config.py` (A)**
   - `class Settings(BaseSettings)`와 `get_settings()`가 정의돼요.
   - 이 시점에는 `.env`를 아직 읽지 않아요. 정의만 돼요.
2. **`database.py` (A)**
   - `_settings = get_settings()`가 실행되면서 이때 처음으로 `.env`를 읽어요.
     - `DATABASE_URL` 같은 필수값이 없으면 **여기서 바로 실패**해요.
     - `@lru_cache` 덕분에 이후 `get_settings()` 호출은 같은 객체를 돌려줘요.
   - `engine = create_async_engine(database_url, pool_size=…, max_overflow=…)`
     - 엔진은 "접속하는 방법"만 준비한 상태예요.
     - **실제 접속은 아직 하지 않아요.** 그래서 DB가 꺼져 있어도 여기까지는 통과해요.
   - `AsyncSessionLocal = async_sessionmaker(engine, …)`로 세션을 찍어 낼 틀을 만들어요.
   - `class Base(DeclarativeBase)`가 정의되고, `Base.metadata`라는 **빈 테이블 목록**이 생겨요.
3. **`auth/infrastructure/models.py` (B)로 돌아와서**
   - `class UserModel(Base)`가 정의되는 순간 `__tablename__ = "users"`와 컬럼 정보가 `Base.metadata`에 등록돼요.
   - `class TokenBlacklistModel(Base)`도 같은 방식으로 `"token_blacklist"`를 등록해요.

### 1-2. `import rooms.infrastructure.models` (D)

- `database.py`는 이미 import됐으니 다시 실행되지 않아요(파이썬은 모듈을 한 번만 실행해요).
- `RoomModel`(`rooms`), `TeamModel`(`teams`), `ParticipationModel`(`participations`), `ParticipationLogModel`(`participation_logs`)이 등록돼요.
- 이제 `Base.metadata`에는 **테이블 6개의 설계도**가 있어요.

> 💡 **`main.py`가 이 두 모듈을 굳이 import하는 이유**
> `create_all`은 `Base.metadata`에 **등록된 것만** 만들어요. 모델 클래스가 한 번도 실행되지 않으면 등록도 되지 않아요. 그러면 오류 없이 테이블만 빠진 채로 앱이 떠요.
> 그래서 쓰지 않는 import처럼 보여도 `# noqa: F401`을 붙여 남겨요(ruff의 "쓰지 않는 import" 경고를 끄는 표시).

### 1-3. 나머지 import

- `auth`·`rooms`의 `router`와 `page_router` (B·C·E)
- `config`, `database`, `exceptions`, `logging_middleware` (A)
- `from seed import seed_initial_data` (A)
  - `seed.py`는 다른 파트의 코드를 import해요: B의 `User`·`UserRepository`·`PasswordHasher`, C의 `Room`, D의 `RoomRepository`
  - 이 중 하나라도 비어 있으면 **import 단계에서 앱이 멈춰요.** `seed.py`를 가장 마지막에 하는 이유예요.

### 1-4. `app = FastAPI(..., lifespan=lifespan)` (A)

- `lifespan` 함수는 **등록만** 되고 아직 실행되지 않아요.
- 이어서 미들웨어, 예외 핸들러, 라우터, `/static`이 등록돼요.

여기까지 DB에는 아무 일도 일어나지 않았어요.

---

## 2. 시작 구간 — lifespan의 `yield` 전

uvicorn이 서버를 열기 직전에 `lifespan(app)`을 실행해요.

```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:                         # 2-1
        await conn.run_sync(Base.metadata.create_all)           # 2-2
    async with AsyncSessionLocal() as session:                  # 2-3
        await seed_initial_data(session, get_settings())        # 2-4
        await session.commit()                                  # 2-5
    yield                                                       # 2-6
    await engine.dispose()                                      # 3
```

### 2-1. `engine.begin()` — 처음으로 DB에 접속

- 커넥션 풀에서 연결 하나를 열고 트랜잭션을 시작해요.
- DB가 꺼져 있거나 `.env` 값이 틀렸으면 **여기서 처음 실패**해요(예: `connection refused`, `password authentication failed`).

### 2-2. `Base.metadata.create_all` — 테이블 만들기

- `create_all`은 동기 함수라서 비동기 연결 위에서는 `run_sync`로 감싸 실행해요(교안 5장).
- 하는 일:
  1. FK 관계를 보고 **만들 순서를 정해요**(참조되는 쪽이 먼저).
     `users` → `token_blacklist` → `rooms`(→`users`) → `teams`(→`rooms`) → `participations`(→`rooms`·`users`·`teams`) → `participation_logs`
  2. 테이블마다 이미 있는지 확인하고 **없으면 `CREATE TABLE`**, 있으면 건너뛰어요.
     - 있는 테이블의 컬럼이나 PK를 고치지는 않아요(STK-13).
- `async with` 블록이 끝나면 commit돼요. **테이블은 이 시점에 확정**돼요.

### 2-3. `AsyncSessionLocal()` — 시드용 세션 하나

- 2-1과는 다른 새 세션이에요.
- 시드 전체가 이 세션 하나의 트랜잭션 안에서 실행돼요.

### 2-4. `seed_initial_data(session, settings)` (A) — 안쪽 호출 순서

#### ① 중복 확인

`UserRepository(session).exists_login_id("seed01")` (B)
→ `SELECT EXISTS(SELECT … FROM users WHERE login_id='seed01')`

- `True`면 `seed skipped` 로그를 남기고 **바로 반환**해요. 두 번째 실행부터는 여기서 끝나요.

#### ② 준비

- `base = datetime.now(UTC)`: 모든 생성 시각을 계산할 기준 시각
- `PasswordHasher().hash(settings.seed_user_password)` (B): bcrypt 해시를 **한 번만** 만들어 14명이 함께 써요

#### ③ 회원 14명 — 14번 반복

| 순서 | 호출 | 계층 | 일어나는 일 |
|---|---|---|---|
| 1 | `User.register("seed01", "시드유저01", hashed)` | 도메인 (B) | 아이디·닉네임 규칙 검사 → `id=None`인 `User` |
| 2 | `UserRepository.save(user)` | 인프라 (B) | `UserModel`로 바꿔 `session.add` → `flush` |
| 3 | `flush` | SQLAlchemy | `INSERT INTO users … RETURNING id` → DB가 매긴 `id`를 받음 |
| 4 | 반환된 `User.id` | 시드 (A) | `user_ids[1] = 1`처럼 번호 → id 표에 적음 |

> **`flush`와 `commit`의 차이**: `flush`는 SQL을 DB에 보내지만 확정하지 않아요. 다른 연결에서는 아직 안 보이지만, 같은 세션 안에서는 `id`를 바로 받아 쓸 수 있어요.

#### ④ 삭제된 방 3개 (D1·D2·D3) — 먼저 만들어요

**a. `_build_room(title, member_ids, created)` (A) — 도메인 메서드만 불러요**

- `Room.create(title, host_id, None, created)` (C)
  - 메모리 안에 `Room(id=None)`, `Team(id=None, side=A)`·`Team(id=None, side=B)`를 만들어요.
  - 만든 사람의 `Participation(join_order=1, team=A)`를 만들어요.
  - 세 번째 인자 `None`은 "이 회원은 지금 참가 중인 방이 없다"는 뜻이에요.
- `room.join(user_id, None, created + n분)` (C)
  - 나머지 회원이 1분 간격으로 들어와요. A팀 우선, A팀이 차면 B팀이에요(D-024).

**b. 방을 끝내요 (C)**

- **D1·D3**: `room.start_game(host_id, ended)` → 방에 `deleted_at`·`delete_reason=GAME_STARTED`, 모든 참가에 `left_at`
- **D2**: `_leave_and_reenter_then_empty`
  1. `leave(seed12)` → 2. `join(seed12)`(재입장, `join_order=3`) → 3. `leave(seed12)` → 4. `leave(seed13)`(마지막 1명 → `EMPTY` 삭제)
  - 끝난 참가 3건이 남아요.

**c. `RoomRepository.save(room)` (D) — DB로 옮겨요**

1. `room.id is None`이면 새 방: `TeamModel(side="A")`·`TeamModel(side="B")`, `RoomModel(participations=[], teams=[…])`를 만들어 `session.add`
2. 제목·방장·생성/삭제 시각 등을 `RoomModel`에 복사
3. 도메인의 참가를 하나씩 보며 분기
   - **현재 참가(`left_at` 없음)** → `ParticipationModel`을 `model.participations`에 추가
   - **끝난 참가(`left_at` 있음)** → `ParticipationLogModel(room=model, team=…, left_at=…)`을 `session.add`
   - 삭제된 방은 참가가 **전부 끝난 상태**라 `participations` 행은 하나도 안 생기고 바로 `participation_logs`에 들어가요
4. `flush` → FK 순서대로 `INSERT rooms` → `INSERT teams` 2행 → `INSERT participation_logs`

#### ⑤ 활성 방 5개 (R1~R5)

- ④와 같은 흐름에서 b(방 끝내기)만 없어요.
- 참가가 모두 **현재 참가**라 `INSERT participations`가 실행돼요.
- **삭제된 방을 먼저 만드는 이유**: seed01~08이 과거 방에서 이미 나간 상태로 기록되고, 생성 시각도 과거 방이 더 이르며, D1~D3이 작은 방 번호를 가져가요.

#### ⑥ 마무리

`session.flush()` 뒤 건수 로그 한 줄:

```
seed inserted: users=14 rooms=8 teams=16 participations=11 participation_logs=11 total=60
```

`seed_initial_data`는 **commit하지 않고** 반환해요.

### 2-5. `session.commit()` — lifespan이 확정

- ③~⑤의 INSERT 60건이 **한꺼번에** 확정돼요.
- 중간에 예외가 나면 commit 없이 빠져나가 시드는 하나도 남지 않고(롤백) 앱 기동도 실패해요.
  - 2-2에서 만든 빈 테이블은 이미 commit돼 그대로 남아요.
  - 다음 실행 때 `seed01`이 없으니 시드를 처음부터 다시 넣어요.

### 2-6. `yield`

이제 서버가 요청을 받기 시작해요. `/docs`나 화면에 접속할 수 있는 건 이때부터예요.

---

## 3. 종료 구간

`Ctrl+C`로 서버를 끄면 `await engine.dispose()`가 실행돼 커넥션 풀의 연결을 모두 닫아요(STK-12).

---

## 한 장 요약

```
uvicorn main:app
│
├─ [import] main.py
│   ├─ auth.infrastructure.models (B) ─▶ database.py (A) ─▶ config.py (A): .env 읽기
│   │     engine·AsyncSessionLocal·Base 준비 (접속 X)
│   │     UserModel·TokenBlacklistModel → Base.metadata 등록
│   ├─ rooms.infrastructure.models (D): Room·Team·Participation·ParticipationLog Model 등록
│   ├─ routers (B·C·E), seed.py (A) ─▶ User·UserRepository·PasswordHasher(B), Room(C), RoomRepository(D)
│   └─ app = FastAPI(lifespan=…)  ← 등록만
│
├─ [startup] lifespan
│   ├─ engine.begin()                 ← 첫 DB 접속
│   ├─ create_all                     ← CREATE TABLE ×6 (없을 때만) → commit
│   ├─ seed_initial_data(session)
│   │   ├─ exists_login_id("seed01")  ← 있으면 여기서 끝
│   │   ├─ 회원 14: User.register → UserRepository.save (flush)
│   │   ├─ 삭제 방 3: Room.create/join → start_game|leave → RoomRepository.save
│   │   │                                   └ rooms·teams·participation_logs INSERT
│   │   └─ 활성 방 5: Room.create/join → RoomRepository.save
│   │                                     └ rooms·teams·participations INSERT
│   ├─ session.commit()               ← 시드 60건 한 번에 확정
│   └─ yield → 요청 받기 시작
│
└─ [shutdown] engine.dispose()
```

## 실행할 때마다 달라지는 점

| 상황 | 2-2 `create_all` | 2-4 시드 |
|---|---|---|
| 빈 DB로 처음 실행 | 테이블 6개 생성 | 60건 INSERT |
| 두 번째 실행부터 | 전부 이미 있어서 건너뜀 | `seed01`이 있어서 바로 반환 |
| 모델을 바꾼 뒤 기존 DB 그대로 | 건너뜀. **바뀐 컬럼은 반영 안 됨** | 건너뜀 |
| 모델을 바꾸고 DB를 다시 만든 뒤 | 새 구조로 생성 | 60건 INSERT |

## 직접 확인하기

```powershell
docker exec -it matchmaking-db psql -U matchmaking -d matchmaking -c "\dt"
```

- 앱이 한 번도 제대로 뜨지 않았으면 `Did not find any relations.`
- 앱이 처음 제대로 뜬 뒤에는 `users`, `token_blacklist`, `rooms`, `teams`, `participations`, `participation_logs` 6개

## 어디서 실패하면 무엇을 의심할까

| 증상 | 실패 지점 | 확인할 것 |
|---|---|---|
| `ValidationError: database_url Field required` | 1-1 `get_settings()` | 저장소 루트에서 실행했는지, `.env`가 있는지 |
| `ImportError` / `cannot import name …` | 1-3 import | 아직 구현 안 된 파트의 import를 `main.py`·`seed.py`에 넣었는지 |
| `connection refused` / `password authentication failed` | 2-1 첫 접속 | 컨테이너가 켜져 있는지(`docker ps`), `.env` 값 |
| 앱은 뜨는데 테이블이 일부 없음 | 2-2 | `main.py`가 해당 모델 모듈을 import했는지 |
| `column … does not exist` | 2-2 이후 요청 | 모델을 바꾼 뒤 DB를 다시 만들지 않음(STK-13) |
| 기동 중 도메인 예외(`RoomFullError` 등) | 2-4 시드 | 시드 데이터가 도메인 규칙에 맞는지, C·D 구현 |
