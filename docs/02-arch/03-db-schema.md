# 03. 도메인 모델 & DB 스키마 (A3)

- 입력: `docs/01-pm/03-domain.md` §3·§4·§6, ADR-001, ADR-002, ADR-009, ADR-010, ADR-011
- DB: PostgreSQL 15+. 테이블은 lifespan의 `Base.metadata.create_all`로 만든다(마이그레이션 없음).
- 현재 참가는 `participations`(PK `room_id`+`user_id`), 끝난 이용은 `participation_logs`에 1건씩 둔다. 회원의 이용 이력 = 현재 참가 + 로그다(ARCH-Q-03, D-025, ADR-011).
- 시각 컬럼은 모두 `timestamptz`(UTC 저장).
- **교안 수준(D-020)**: 컬럼은 교안 5장의 `mapped_column` 옵션(`primary_key`, `nullable`, `unique=True`, `index=True`, `default`, `server_default`, `ForeignKey`)과 `relationship`만 쓴다. 도메인이 이미 검사하는 규칙의 CHECK, 이름 붙인 제약, 성능용 복합·조건부 인덱스는 두지 않는다.

## 1. 엔티티

| ENT | 도메인 클래스 | 위치 | 테이블 | ORM 모델 |
|---|---|---|---|---|
| ENT-01 | `User` | `src/auth/domain/user.py` | `users` | `UserModel` |
| ENT-02 | `TokenBlacklist` | `src/auth/domain/token_blacklist.py` | `token_blacklist` | `TokenBlacklistModel` |
| ENT-03 | `Room` (+ 값 객체 `RoomTitle`, 열거 `DeleteReason`) | `src/rooms/domain/room.py` | `rooms` | `RoomModel` |
| ENT-04 | `Participation` (+ 열거 `TeamSide`) | `src/rooms/domain/participation.py` | `participations` | `ParticipationModel` |
| ENT-05 | `Team` (ADR-010) | `src/rooms/domain/team.py` | `teams` | `TeamModel` |
| ENT-06 | — (조회 전용, 읽기 모델 `HistoryItem`·`MyRecord`) | — | `participation_logs` | `ParticipationLogModel` |

## 2. ERD

```mermaid
erDiagram
    users ||--o| participations : "현재 참가"
    users ||--o{ rooms : "방장"
    rooms ||--|{ teams : "A·B 두 팀"
    users ||--o{ participation_logs : "지난 이용"
    rooms ||--o{ participations : "현재 참가자"
    rooms ||--o{ participation_logs : "지난 이용"
    teams ||--o{ participations : "현재 팀"
    teams ||--o{ participation_logs : "마지막 팀"
    users {
        int id PK
        string login_id UK
        string nickname UK
        string hashed_password
        timestamptz created_at
    }
    token_blacklist {
        int id PK
        string token
        timestamptz created_at
    }
    rooms {
        int id PK
        string title
        int capacity
        int host_user_id FK
        int last_join_order
        timestamptz created_at
        timestamptz deleted_at
        string delete_reason
    }
    teams {
        int id PK
        int room_id FK
        string side
    }
    participations {
        int room_id PK, FK
        int user_id PK, FK "UK"
        int join_order
        int team_id FK
        timestamptz joined_at
    }
    participation_logs {
        int id PK
        int room_id FK
        int user_id FK
        int join_order
        int team_id FK
        timestamptz joined_at
        timestamptz left_at
    }
```

## 3. 테이블 정의

### 3.1 `users` (ENT-01)

| 컬럼 | SQLAlchemy 타입(Mapped) | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `id` | `Mapped[int]` | N | 자동 증가 | `primary_key=True` | 회원 ID |
| `login_id` | `Mapped[str]`, `String(20)` | N | — | `unique=True` | 4~20자 영문 소문자·숫자 (도메인 검증) |
| `nickname` | `Mapped[str]`, `String(12)` | N | — | `unique=True` | 2~12자 |
| `hashed_password` | `Mapped[str]`, `String(255)` | N | — | — | bcrypt 해시. 응답 스키마에 없음 |
| `created_at` | `Mapped[datetime]`, `DateTime(timezone=True)` | N | `func.now()` | — | 가입 시각 |

### 3.2 `token_blacklist` (ENT-02)

| 컬럼 | 타입 | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `id` | `Mapped[int]` | N | 자동 증가 | `primary_key=True` | |
| `token` | `String(500)` | N | — | `index=True` | 로그아웃한 access·refresh 토큰 원문(교안 6장 1강, ADR-002). 행 정리 없음 |
| `created_at` | `DateTime(timezone=True)` | N | `func.now()` | — | 로그아웃 시각 |

### 3.3 `rooms` (ENT-03)

| 컬럼 | 타입 | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `id` | `Mapped[int]` | N | 자동 증가 | `primary_key=True` | |
| `title` | `String(20)` | N | — | — | 다듬어진 제목 (INV-12, `RoomTitle`이 검사) |
| `capacity` | `Integer` | N | `default=4` | — | INV-01 (`Room.CAPACITY`) |
| `host_user_id` | `Integer` | N | — | `ForeignKey("users.id")` | 현재(삭제 방은 마지막) 방장 |
| `last_join_order` | `Integer` | N | `default=0` | — | 마지막으로 부여한 입장 순서. 재입장 번호 증가용 (INV-11) |
| `created_at` | `DateTime(timezone=True)` | N | — | — | 서비스가 `now`를 넣음 |
| `deleted_at` | `DateTime(timezone=True)` | Y | NULL | — | 소프트 삭제 시각 |
| `delete_reason` | `String(20)` | Y | NULL | — | `GAME_STARTED`·`EMPTY` (INV-07, `Room`이 검사) |

- 관계: `participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="room", cascade="all, delete-orphan")`(현재 참가자만, 목록에서 빼면 행이 지워진다), `teams: Mapped[list["TeamModel"]] = relationship(back_populates="room")` (1:N, 교안 5장 1강 6.1)
- `updated_at`은 두지 않는다(변경 시각을 쓰는 요구가 없음).

### 3.4 `participations` (ENT-04, ADR-011)

현재 참가 중인 회원만 담는다. 퇴장·해산하면 그 행은 `participation_logs`로 옮겨지고 지워진다.

| 컬럼 | 타입 | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `room_id` | `Integer` | N | — | `ForeignKey("rooms.id")`, `primary_key=True` | |
| `user_id` | `Integer` | N | — | `ForeignKey("users.id")`, `primary_key=True`, `unique=True` | 한 회원 한 방(INV-04) |
| `join_order` | `Integer` | N | — | — | 방 안 입장 순서 (INV-11, `Room`이 부여) |
| `team_id` | `Integer` | N | — | `ForeignKey("teams.id")` | 현재 소속 팀. 같은 방의 팀만 가리킨다(`RoomRepository.save`가 정함, RISK-13) |
| `joined_at` | `DateTime(timezone=True)` | N | — | — | 입장 시각 |

- 관계: `room: Mapped["RoomModel"] = relationship(back_populates="participations")` (N:1), `team: Mapped["TeamModel"] = relationship(back_populates="participations")` (N:1)
- `left_at` 컬럼은 없다. 행이 있으면 참가 중이다.
- 필수 범위에서 `unique`·PK 위반(동시 요청)은 `IntegrityError` → 500이다(D-018). 400 변환은 도전 A.

### 3.5 `teams` (ENT-05, ADR-010)

| 컬럼 | 타입 | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `id` | `Mapped[int]` | N | 자동 증가 | `primary_key=True` | 팀 ID |
| `room_id` | `Integer` | N | — | `ForeignKey("rooms.id")` | 소속 방. 방마다 A·B 두 행(방 생성 때 함께 저장) |
| `side` | `String(1)` | N | — | — | 편 `A`·`B` (`TeamSide`) |

- 관계: `room: Mapped["RoomModel"] = relationship(back_populates="teams")` (N:1), `participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="team")` (1:N)
- 팀 정원(2명)은 컬럼이 아니라 도메인 상수 `Team.CAPACITY`다. 방이 삭제돼도 팀 행은 남는다(보관).

### 3.6 `participation_logs` (ENT-06, ADR-011)

끝난 이용 1건 = 1행. 퇴장·해산 때 `RoomRepository.save`가 INSERT하고 이후 바꾸거나 지우지 않는다(INV-10). 같은 (방, 회원) 행이 여러 개면 재입장이다(REQ-046).

| 컬럼 | 타입 | null | 기본값 | 제약 | 설명 |
|---|---|---|---|---|---|
| `id` | `Mapped[int]` | N | 자동 증가 | `primary_key=True` | 로그 ID (응답에 내보내지 않음, D-025) |
| `room_id` | `Integer` | N | — | `ForeignKey("rooms.id")` | |
| `user_id` | `Integer` | N | — | `ForeignKey("users.id")` | |
| `join_order` | `Integer` | N | — | — | 그 체류의 입장 순서 |
| `team_id` | `Integer` | N | — | `ForeignKey("teams.id")` | 퇴장 때의 마지막 팀 |
| `joined_at` | `DateTime(timezone=True)` | N | — | — | 입장 시각 |
| `left_at` | `DateTime(timezone=True)` | N | — | — | 퇴장 시각 (입장 시각 이후, `Participation.end`가 검사) |

- 관계: `room: Mapped["RoomModel"] = relationship()` (N:1, 이력의 방 제목·삭제 여부 조회용), `team: Mapped["TeamModel"] = relationship()` (N:1, `save`가 팀 객체로 연결). 역방향 관계는 두지 않는다.
- 퇴장 사유 컬럼은 두지 않는다(요구 없음, ADR-011).

## 4. INV → 제약 대응

규칙은 도메인 클래스가 검사한다(D-020). DB에는 NOT NULL·FK·`unique=True`(아이디·닉네임)만 둔다.

| INV | DB | 도메인 검사 |
|---|---|---|
| INV-01 | — | `Room.CAPACITY=4`, `Team.CAPACITY=2` |
| INV-02·03 | — | `Room.join()`(정원), `Team.add()`(팀 정원, `Room.join`·`Room.change_team`이 호출). 동시 요청은 도전 A의 방 행 잠금(ADR-009) |
| INV-04 | `participations` PK(`room_id`+`user_id`), `user_id` `unique=True` (ADR-011) | `Room.create()`, `Room.join()`의 `current_participation` 검사 |
| INV-05 | `host_user_id` NOT NULL FK | `Room.leave()` 위임 |
| INV-06·08 | — | 삭제 방 행위 메서드 거부, `start_game()`·`leave()`가 전원 종료 |
| INV-07 | — | `Room.__init__`, `_soft_delete()` |
| INV-09 | 결과 테이블 없음 | — |
| INV-10 | 삭제 API 없음, `participation_logs`는 INSERT만 | `Participation.end()` |
| INV-11 | — | `Room.last_join_order` 증가 |
| INV-12 | `String(20)` | `RoomTitle` |
| INV-13 | — | 응답 스키마에 필드 없음 |
| INV-14 | — | 인증 서비스가 블랙리스트 토큰을 거부(ADR-002) |
| INV-15 | — | 조회 쿼리 조건(`user_id`) |

## 5. ORM ↔ 도메인 매핑

모든 레포지토리는 `src/<기능>/infrastructure/repositories.py`에 있고 생성자에서 `AsyncSession`을 받는다. `commit`은 하지 않는다(`flush`만, 서비스가 commit).

| ORM 모델 | 도메인/읽기 모델 | 레포지토리 | 변환 | 메서드 시그니처 |
|---|---|---|---|---|
| `UserModel` | `User` | `UserRepository` | `_to_domain(model) -> User`, `_to_model(user) -> UserModel` | `find_by_id(user_id: int) -> User \| None` · `find_by_login_id(login_id: str) -> User \| None` · `exists_login_id(login_id: str) -> bool` · `exists_nickname(nickname: str) -> bool` · `save(user: User) -> User` (`flush` 후 `refresh`로 id·`created_at`을 읽음) |
| `TokenBlacklistModel` | `TokenBlacklist` | `TokenBlacklistRepository` | — | `exists(token: str) -> bool` · `save(entry: TokenBlacklist) -> None` |
| `RoomModel` + `TeamModel` + `ParticipationModel` (+ `ParticipationLogModel` 쓰기) | `Room`(팀 2개·현재 참가자 포함), `Team`, `Participation` | `RoomRepository` | `_to_domain(room_model) -> Room`(팀은 `Team(id, side)`로, 팀원은 `Room` 생성자가 현재 참가로 채움), `_participation_to_domain(model) -> Participation`(`team = TeamSide(model.team.side)`) | `find_by_id(room_id: int) -> Room \| None` (`select(RoomModel).options(selectinload(RoomModel.teams), selectinload(RoomModel.participations).selectinload(ParticipationModel.team))`) · (도전 A) `find_by_id_for_update(room_id: int) -> Room \| None` (`with_for_update()`) · `find_current_participation(user_id: int) -> Participation \| None` (`participations`에서 `user_id`로 1건) · `save(room: Room) -> Room` (방 행 insert/update, 새 방이면 `TeamModel` A·B 두 행을 함께 만듦. 참가는 `user_id`로 짝지음: 행이 없고 참가 중 → `ParticipationModel` append / 행이 있고 참가 중 → `team` 갱신 / 행이 있고 `left_at` 있음 → `ParticipationLogModel` add 후 `room_model.participations.remove(행)`. `TeamSide` → 같은 방의 `TeamModel`, `flush` 후 id가 채워진 `Room` 반환) |
| 조회 전용 | `RoomSummary`, `RoomDetail`, `HistoryItem`, `ArchivedRoom` (`src/rooms/application/read_models.py`) | `RoomQueryRepository` | ORM 객체 → frozen dataclass | `list_active_rooms(cond: RoomListCondition) -> tuple[list[RoomSummary], int]` · `get_room_detail(room_id: int) -> RoomDetail \| None` · `list_history(user_id: int, page: int, size: int) -> tuple[list[HistoryItem], int]` (`participations` 현재 1건 + `participation_logs`를 합쳐 `joined_at` 최신순, 같으면 로그 `id` 큰 것 먼저) · `get_archived_room(room_id: int, user_id: int) -> ArchivedRoom \| None` (`participation_logs`만, `joined_at`·`id` 순) |

- 조회 방식(교안 수준, D-020): `select(...).where(...).options(selectinload(...)).order_by(...)`로 읽고, 현재 인원 계산·제목 검색(`keyword.lower() in title.lower()`)·`available_only`·전체 건수(`len`)·페이지 자르기(`items[skip:skip+size]`)는 파이썬에서 한다(교안 2·3장 목록 필터 방식). 집계 서브쿼리·`ILIKE ESCAPE`는 쓰지 않는다.
- 상세의 닉네임은 `await session.get(UserModel, user_id)`로 읽는다(같은 요청 안에서 방을 바꾼 직후에도 정확). `RoomQueryRepository`만 `auth.infrastructure.models.UserModel`을 import한다(ADR-001).
- 아이디·닉네임 중복은 서비스가 `exists_*`로 먼저 확인한다. 레포지토리는 `IntegrityError`를 바꾸지 않는다(동시 가입 중복은 500, D-018·D-020).
- (도전 A) `IntegrityError`(`participations`의 PK·`user_id` unique 위반)는 `RoomRepository.save()`가 잡아 `AlreadyParticipatingError`(도메인 예외, 400)로 바꾼다(ADR-011이 ADR-009의 부분 유니크 인덱스를 대체).
- 현재 인원은 `len(room_model.participations)`다(현재 참가만 들어 있음). `left_at` 거르기는 없다.

## 6. 시드 계획

- 위치: `src/seed.py`의 `async def seed_initial_data(session: AsyncSession, settings: Settings) -> None`. `src/main.py` lifespan이 `create_all` 직후 호출한다.
- 중복 방지: `users`에 `login_id = 'seed01'`이 있으면 아무것도 넣지 않고 반환한다. 전체를 한 트랜잭션으로 넣는다(RISK-12, NFR-06).
- 비밀번호: 모든 시드 회원은 `settings.seed_user_password`(환경변수 `SEED_USER_PASSWORD`)를 bcrypt로 해시해 넣는다. 값은 `.env.example`과 README에만 적는다(D-014).
- 시각: 기준 시각 `base = 서버 시작 시각`에서 분 단위로 빼서 생성 시각 순서를 만든다.

| 엔티티 | 건수 | 내용 |
|---|---|---|
| `users` | 14 | `seed01`~`seed14`, 닉네임 `시드유저01`~`시드유저14` |
| 활성 `rooms` | 5 | R1 "2vs2 시연 방"(seed01~04, A·B 각 2명 — 게임 시작 시연, D-014) / R2 "한 자리 남음"(seed05~07, A2·B1) / R3 "Fun Room"(seed08~09, A2·B0 — A팀 우선 배정, D-024) / R4 "100% 즐겜"(seed10) / R5 "초보 환영"(seed11). 방장은 각 방의 입장 순서 1 |
| 삭제 `rooms` | 3 | D1 "어제 한 판"(GAME_STARTED, seed01~04 과거 기록) / D2 "아무도 없음"(EMPTY, seed12 과거 기록) / D3 "저녁 매치"(GAME_STARTED, seed05~08 과거 기록) |
| `teams` | 16 | 방 8개 × A·B (방 생성 때 함께 저장) |
| `participations` | 11 | 현재 참가(R1~R5) |
| `participation_logs` | 10 | 끝난 이용(D1 4, D2 2, D3 4). D2는 seed12가 입장 → 퇴장 → 재입장 → 퇴장한 재입장 예시(입장 순서 1·2, ADR-011) |
| 합계 | 59 | 20건 이상 |

- seed12~14는 참가 중이 아닌 회원이다(시연 중 참가·생성용). R2는 정원 마감 직전, R1은 정원 마감 + 게임 시작 가능 상태다.
