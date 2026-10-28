# 04. 인터페이스 & API 명세 (A4) · 실행 흐름 (A5)

- 입력: `03-db-schema.md`, `docs/01-pm/05-user-stories.md`, `06-acceptance-criteria.md`, `07-screens.md`, ADR-001~008
- JSON API는 `/api` 아래에 두고, Jinja2 화면은 접두사 없는 경로를 쓴다(화면 `/rooms/{id}`와 API `/api/rooms/{id}`가 겹치지 않게).
- 성공 응답은 모두 200(D-013). 오류 본문은 `{"detail": "<문자열>"}` 하나(ADR-004).

## 1. 도메인 예외

### 1.1 공통 기반 — `src/exceptions.py` (외부 import 없음)

| 클래스 | 부모 | HTTP | 용도 |
|---|---|---|---|
| `DomainError` | `ValueError` | — | 모든 도메인 예외의 부모. `message: str` |
| `DomainRuleError` | `DomainError` | 400 | 규칙 위반 (권한 성격 포함, D-015) |
| `NotFoundError` | `DomainError` | 404 | 대상 없음·조회 권한 없음 |
| `GoneError` | `DomainError` | 410 | 게임 시작으로 해산된 방 상세 조회 (ARCH-Q-04) |
| `AuthenticationError` | `Exception` | 401 | 토큰 없음·무효·만료·블랙리스트, 로그인 실패. 응답 헤더 `WWW-Authenticate: Bearer` |

- 전역 핸들러(`src/main.py`)는 위 4개 부모 클래스만 등록한다. `detail = exc.message`. 403은 쓰지 않는다(D-015).

### 1.2 기능별 예외

| 위치 | 클래스 | 부모 | `message` |
|---|---|---|---|
| `src/auth/domain/exceptions.py` | `InvalidLoginIdError` | `DomainRuleError` | "아이디는 4~20자의 영문 소문자와 숫자만 쓸 수 있습니다" |
| | `InvalidNicknameError` | `DomainRuleError` | "닉네임은 2~12자의 한글, 영문, 숫자만 쓸 수 있습니다" |
| | `InvalidPasswordError` | `DomainRuleError` | "비밀번호는 8자 이상이어야 합니다" |
| | `DuplicateLoginIdError` | `DomainRuleError` | "이미 사용 중인 아이디입니다" |
| | `DuplicateNicknameError` | `DomainRuleError` | "이미 사용 중인 닉네임입니다" |
| | `InvalidRefreshTokenError` | `DomainRuleError` | "유효하지 않거나 이미 만료된 토큰입니다" (로그아웃 본문의 refresh 토큰, 교안 6장) |
| | `AlreadyLoggedOutError` | `DomainRuleError` | "이미 로그아웃 처리된 토큰입니다" |
| `src/rooms/domain/exceptions.py` | `InvalidRoomTitleError` | `DomainRuleError` | "방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다" |
| | `RoomDeletedError` | `DomainRuleError` | "이미 삭제된 방입니다" |
| | `RoomFullError` | `DomainRuleError` | "정원이 마감되었습니다" |
| | `AlreadyParticipatingError` | `DomainRuleError` | "이미 다른 방에 참가 중입니다" |
| | `NotHostError` | `DomainRuleError` | "방장만 할 수 있습니다" |
| | `NotParticipantError` | `DomainRuleError` | "이 방의 참가자가 아닙니다" |
| | `TeamFullError` | `DomainRuleError` | "선택한 팀의 정원이 찼습니다" |
| | `InvalidTeamCompositionError` | `DomainRuleError` | "A팀과 B팀이 각각 2명일 때만 시작할 수 있습니다" |
| | `ParticipationAlreadyEndedError` | `DomainRuleError` | "이미 종료된 참가 기록입니다" |
| | `RoomNotFoundError` | `NotFoundError` | "방을 찾을 수 없습니다" |
| | `RoomDissolvedError` | `GoneError` | "게임이 시작되어 방이 해산되었습니다" |

- 로그인 실패·토큰 문제는 `AuthenticationError("아이디 또는 비밀번호가 올바르지 않습니다")` / `AuthenticationError("인증 토큰이 올바르지 않거나 로그인이 만료되었습니다")`(교안 6장 문구). Authorization 헤더가 아예 없으면 `OAuth2PasswordBearer`가 FastAPI 기본 401(`{"detail": "Not authenticated"}`)을 낸다.

## 2. 도메인 클래스 시그니처

외부 라이브러리 import 없음. 시각은 모두 인자로 받는다(`now: datetime`, UTC aware).

### 2.1 `src/auth/domain/user.py`
```
@dataclass
class User:
    id: int | None
    login_id: str
    nickname: str
    hashed_password: str
    created_at: datetime | None = None

    @classmethod
    def register(cls, login_id: str, nickname: str, hashed_password: str) -> "User"
        # login_id: ^[a-z0-9]{4,20}$ 아니면 InvalidLoginIdError
        # nickname: strip 후 ^[가-힣A-Za-z0-9]{2,12}$ 아니면 InvalidNicknameError, 다듬은 값 저장
    @staticmethod
    def validate_raw_password(raw: str) -> None   # len < 8 → InvalidPasswordError
```
- 관련 INV-13. 중복 검사는 서비스가 레포지토리 결과로 `DuplicateLoginIdError`/`DuplicateNicknameError`를 낸다.

### 2.2 `src/auth/domain/token_blacklist.py`
```
@dataclass(frozen=True)
class TokenBlacklist:
    token: str            # 로그아웃한 access·refresh 토큰 원문. 빈 문자열 → ValueError
```

### 2.3 `src/rooms/domain/room.py`
```
class TeamSide(StrEnum): A = "A"; B = "B"
class DeleteReason(StrEnum): GAME_STARTED = "GAME_STARTED"; EMPTY = "EMPTY"

@dataclass(frozen=True)
class RoomTitle:
    value: str
    @classmethod
    def of(cls, raw: str) -> "RoomTitle"   # strip 후 1~20자 아니면 InvalidRoomTitleError (INV-12)

class Room:
    CAPACITY = 4
    TEAM_CAPACITY = 2

    def __init__(self, id: int | None, title: RoomTitle, host_user_id: int, last_join_order: int,
                 created_at: datetime, deleted_at: datetime | None, delete_reason: DeleteReason | None,
                 participations: list[Participation]) -> None
        # 검증: last_join_order >= 0, (deleted_at, delete_reason) 둘 다 None 또는 둘 다 값 (INV-07)

    @classmethod
    def create(cls, title: str, creator_id: int, current_participation: Participation | None,
               now: datetime) -> "Room"
        # current_participation 있음 → AlreadyParticipatingError (INV-04)
        # 생성자 참가: join_order 1, TeamSide.A, joined_at now. host = creator

    # 조회 속성
    is_active: bool                         # deleted_at is None
    current_participants: list[Participation]   # left_at is None 인 것
    current_count: int
    is_full: bool                           # current_count >= CAPACITY
    available_seats: int
    def team_count(self, team: TeamSide) -> int
    def participation_of(self, user_id: int) -> Participation | None   # 현재 참가만

    # 행위 메서드 (모두 삭제된 방이면 RoomDeletedError 먼저)
    def rename(self, requester_id: int, title: str) -> None
        # requester != host → NotHostError
    def join(self, user_id: int, current_participation: Participation | None, now: datetime) -> Participation
        # current_participation.room_id == self.id → 그 기록 반환(변화 없음, D-006)
        # current_participation 다른 방 → AlreadyParticipatingError
        # is_full → RoomFullError
        # last_join_order += 1, 팀 = 인원이 적은 팀(같으면 A) (Q-03)
    def change_team(self, user_id: int, target: TeamSide) -> None
        # 참가자 아님 → NotParticipantError, 같은 팀 → 변화 없음, team_count(target) >= 2 → TeamFullError
    def leave(self, user_id: int, now: datetime) -> None
        # 참가자 아님 → NotParticipantError. 기록 end(now)
        # 남은 사람 0 → _soft_delete(EMPTY, now)
        # 나간 사람이 방장 → host = 남은 참가자 중 join_order 최소
    def start_game(self, requester_id: int, now: datetime) -> None
        # requester != host → NotHostError
        # team_count(A) != 2 or team_count(B) != 2 → InvalidTeamCompositionError
        # 전원 end(now) → _soft_delete(GAME_STARTED, now). 결과 데이터 없음 (INV-09)
    def _soft_delete(self, reason: DeleteReason, now: datetime) -> None
```
- `participations`에는 레포지토리가 읽은 현재 참가 기록과, 이번 요청에서 새로 생기거나 종료된 기록이 들어 있다. 레포지토리 `save`는 이 목록 전체를 저장한다.
- 거부 검사 순서는 위 주석 순서와 같다(테스트 기대값 고정).

### 2.4 `src/rooms/domain/participation.py`
```
@dataclass
class Participation:
    id: int | None
    room_id: int | None     # 새 방 생성 시 None, save 후 채워짐
    user_id: int
    join_order: int         # >= 1 아니면 ValueError
    team: TeamSide
    joined_at: datetime
    left_at: datetime | None = None
    is_current: bool        # 속성: left_at is None
    def change_team(self, team: TeamSide) -> None   # 종료 기록 → ParticipationAlreadyEndedError
    def end(self, now: datetime) -> None            # 종료 기록 → ParticipationAlreadyEndedError, now < joined_at → ValueError
```

## 3. 응용 서비스 시그니처

| 클래스 (위치) | 메서드 | 반환 | 흐름 |
|---|---|---|---|
| `AuthApplicationService` (`src/auth/application/service.py`) — 생성자 `(db: AsyncSession)` | `signup(login_id, nickname, password)` | `User` | SEQ-01 |
| | `login(login_id, password)` | `dict`: `{"access_token", "refresh_token", "token_type": "bearer"}` | SEQ-02 |
| | `refresh(refresh_token)` | `dict`: `{"access_token", "token_type": "bearer"}` | SEQ-04b |
| | `logout(access_token, refresh_token)` | `None` | SEQ-04 |
| | `authenticate(token)` | `User` | SEQ-03 |
| `RoomApplicationService` (`src/rooms/application/service.py`) — 생성자 `(db: AsyncSession, clock, list_cache: RoomListCache \| None = None)` | `create_room(user_id, title)` | `Room` | SEQ-05 |
| | `join_room(room_id, user_id)` | `Room` | SEQ-06 |
| | `rename_room(room_id, user_id, title)` | `Room` | SEQ-07 |
| | `change_team(room_id, user_id, team: TeamSide)` | `Room` | SEQ-07 |
| | `leave_room(room_id, user_id)` | `LeaveResult(room_deleted: bool, new_host_user_id: int \| None)` | SEQ-08 |
| | `start_game(room_id, user_id)` | `GameStartResult(room_id: int, dissolved_at: datetime)` | SEQ-09 |
| `RoomQueryService` (`src/rooms/application/queries.py`) — 생성자 `(db, list_cache=None)` | `list_rooms(cond: RoomListCondition)` | `RoomPage(items, total, page, size)` | SEQ-10 |
| | `get_room_detail(room_id, viewer_id)` | `RoomDetail` | 없음 → `RoomNotFoundError`, 삭제(EMPTY) → `RoomNotFoundError`, 삭제(GAME_STARTED) → `RoomDissolvedError` |
| | `get_current_room(user_id)` | `CurrentRoom \| None` | |
| | `list_history(user_id, page, size)` | `HistoryPage` | |
| | `get_archived_room(room_id, user_id)` | `ArchivedRoom` | 방이 삭제되지 않았거나 참가 기록 없음 → `RoomNotFoundError` |
| | `iter_history_csv(user_id)` (CH-B) | `AsyncIterator[str]` | SEQ-14 |

- 읽기 모델·조건은 `src/rooms/application/read_models.py`의 frozen dataclass: `RoomListCondition(keyword: str \| None, available_only: bool, sort: Literal["newest","oldest"], page: int, size: int)`, `RoomSummary`, `RoomDetail`, `ParticipantView`, `CurrentRoom`, `HistoryItem`, `ArchivedRoom`, `RoomPage`, `HistoryPage`, `LeaveResult`, `GameStartResult`. 필드는 §5 응답 스키마와 같은 이름이다.
- 인증 보조(`src/auth/infrastructure/security.py`, 교안 6장 1강 3.3절과 같은 모양): `PasswordHasher.hash(raw) -> str`, `PasswordHasher.verify(raw, hashed) -> bool`(passlib `CryptContext(schemes=["bcrypt"])`), `create_access_token(data: dict) -> str`(만료 `settings.access_token_expire_minutes`, `token_type: "access"`), `create_refresh_token(data: dict) -> str`(만료 `settings.refresh_token_expire_days`, `token_type: "refresh"`), `decode_token(token: str) -> dict`(`jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])`, 오류는 pyjwt `ExpiredSignatureError`·`InvalidTokenError` 그대로). JWT 페이로드: `sub`(아이디 `login_id`), `exp`, `token_type` (ADR-002, D-021).

## 4. REST API 명세

### 4.1 auth — `src/auth/presentation/router.py`, prefix `/api/auth`, tags `["auth"]`

| API-ID | Method | URI | 인증 | 매개변수 | 요청 스키마 | 응답 스키마 | 성공 | 에러 코드와 `detail` 예시 | US/AC |
|---|---|---|---|---|---|---|---|---|---|
| API-AUTH-01 | POST | `/api/auth/signup` | 없음 | — | `SignupRequest` | `UserResponse` | 200 | 400 "이미 사용 중인 아이디입니다", 400 "비밀번호는 8자 이상이어야 합니다", 422 | US-08 / AC-08-1~5 |
| API-AUTH-02 | POST | `/api/auth/token` | 없음 | form `username`(=아이디), `password` (`OAuth2PasswordRequestForm`) | form | `TokenResponse` | 200 | 401 "아이디 또는 비밀번호가 올바르지 않습니다" | US-09 / AC-09-1·2 |
| API-AUTH-03 | POST | `/api/auth/logout` | Bearer | — | `RefreshRequest` | `MessageResponse` | 200 | 401, 400 "유효하지 않거나 이미 만료된 토큰입니다", 400 "이미 로그아웃 처리된 토큰입니다" | US-10 / AC-10-1~3 |
| API-AUTH-04 | GET | `/api/auth/me` | Bearer | — | — | `UserResponse` | 200 | 401 | US-11 |
| API-AUTH-05 | POST | `/api/auth/refresh` | 없음(본문의 refresh 토큰) | — | `RefreshRequest` | `AccessTokenResponse` | 200 | 401 "로그아웃 처리되어 사용할 수 없는 토큰입니다", 401 "리프레시 토큰이 만료되었습니다. 다시 로그인하세요" | US-09 (교안 6장 1강) |

- Swagger summary: 01 "회원가입", 02 "로그인(OAuth2 토큰 발급)", 03 "로그아웃(토큰 차단)", 04 "내 정보", 05 "access 토큰 재발급".
- `OAuth2PasswordBearer(tokenUrl="/api/auth/token")`로 Swagger Authorize를 쓴다. 쿠키는 쓰지 않는다(D-021).

### 4.2 rooms — `src/rooms/presentation/router.py`, prefix `/api`, tags `["rooms"]`, `["me"]`

| API-ID | Method | URI | 인증 | 매개변수 | 요청 스키마 | 응답 스키마 | 성공 | 에러 코드와 `detail` 예시 | US/AC |
|---|---|---|---|---|---|---|---|---|---|
| API-ROOM-01 | GET | `/api/rooms` | 필요 | `keyword: str \| None`(max 50), `available_only: bool = False`, `sort: Literal["newest","oldest"] = "newest"`, `page: int = 1 (>=1)`, `size: int = 10 (1~50)` | — | `RoomListResponse` | 200 | 401, 422 "size: Input should be less than or equal to 50" | US-12 / AC-12-1~8 |
| API-ROOM-02 | POST | `/api/rooms` | 필요 | — | `RoomCreateRequest` | `RoomDetailResponse` | 200 | 400 "방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다", 400 "이미 다른 방에 참가 중입니다", 401, 422 | US-01 / AC-01-1~5 |
| API-ROOM-03 | GET | `/api/rooms/{room_id}` | 필요 | `room_id: int` | — | `RoomDetailResponse` | 200 | 404 "방을 찾을 수 없습니다", 410 "게임이 시작되어 방이 해산되었습니다", 401 | US-07 / AC-07-1·4·5 |
| API-ROOM-04 | PATCH | `/api/rooms/{room_id}` | 필요 | `room_id` | `RoomRenameRequest` | `RoomDetailResponse` | 200 | 400 "방장만 할 수 있습니다", 400 "이미 삭제된 방입니다", 400 제목 규칙, 404 | US-03 / AC-03-1~4 |
| API-ROOM-05 | POST | `/api/rooms/{room_id}/participants` | 필요 | `room_id` | — | `RoomDetailResponse` | 200 | 400 "정원이 마감되었습니다", 400 "이미 다른 방에 참가 중입니다", 400 "이미 삭제된 방입니다", 404 | US-02 / AC-02-1~8 |
| API-ROOM-06 | PATCH | `/api/rooms/{room_id}/participants/me` | 필요 | `room_id` | `TeamChangeRequest` | `RoomDetailResponse` | 200 | 400 "선택한 팀의 정원이 찼습니다", 400 "이 방의 참가자가 아닙니다", 400 "이미 삭제된 방입니다", 404, 422 | US-04 / AC-04-1~6 |
| API-ROOM-07 | DELETE | `/api/rooms/{room_id}/participants/me` | 필요 | `room_id` | — | `LeaveResponse` | 200 | 400 "이 방의 참가자가 아닙니다", 404 | US-05 / AC-05-1~5 |
| API-ROOM-08 | POST | `/api/rooms/{room_id}/start` | 필요 | `room_id` | — | `GameStartResponse` | 200 | 400 "방장만 할 수 있습니다", 400 "A팀과 B팀이 각각 2명일 때만 시작할 수 있습니다", 400 "이미 삭제된 방입니다", 404 | US-06 / AC-06-1~6 |
| API-ROOM-09 | GET | `/api/me/room` | 필요 | — | — | `CurrentRoomResponse` | 200 | 401 | US-07 / AC-07-2·3 |
| API-ROOM-10 | GET | `/api/me/room-history` | 필요 | `page: int = 1 (>=1)`, `size: int = 10 (1~50)` | — | `HistoryListResponse` | 200 | 401, 422 | US-13 / AC-13-1~4 |
| API-ROOM-11 | GET | `/api/me/room-history/{room_id}` | 필요 | `room_id` | — | `ArchivedRoomResponse` | 200 | 404 "방을 찾을 수 없습니다" | US-14 / AC-14-1·2 |
| API-ROOM-12 (CH-B) | GET | `/api/me/room-history.csv` | 필요 | — | — | `StreamingResponse(text/csv; charset=utf-8)` | 200 | 401 | US-19 / AC-19-2 |

- 라우트 등록 순서: `/api/me/room-history.csv`를 `/api/me/room-history/{room_id}`보다 먼저 등록한다.
- Swagger summary: 01 "공개 방 목록", 02 "방 만들기", 03 "방 상세", 04 "방 제목 변경(방장)", 05 "방 참가", 06 "내 팀 변경", 07 "방 나가기", 08 "게임 시작(방 해산, 방장)", 09 "내가 참가 중인 방", 10 "내 이용 이력", 11 "삭제된 방 보관 정보", 12 "내 이용 이력 CSV".

### 4.3 권한 표

관리자는 없다(D-004).

| API-ID | 비로그인 | 회원 | 본인·역할 조건 |
|---|---|---|---|
| AUTH-01, AUTH-02, AUTH-05 | 허용 | 허용 | — (AUTH-05는 유효한 refresh 토큰 필요) |
| AUTH-03, AUTH-04 | 401 | 허용 | 본인 토큰 |
| ROOM-01, ROOM-02, ROOM-03, ROOM-05, ROOM-09 | 401 | 허용 | — |
| ROOM-04, ROOM-08 | 401 | 허용 | 현재 방장 (아니면 400) |
| ROOM-06, ROOM-07 | 401 | 허용 | 이 방 현재 참가자 본인 (아니면 400) |
| ROOM-10, ROOM-11, ROOM-12 | 401 | 허용 | 본인 기록만 (ROOM-11은 과거 참가자 아니면 404) |

## 5. 스키마 명세

모든 스키마는 `src/<기능>/presentation/schemas.py`, `model_config = ConfigDict(from_attributes=True)`. **요청·응답 JSON 필드 이름은 아래 표 그대로 snake_case**이며 별칭(camelCase alias)을 두지 않는다. 화면 JS도 같은 이름을 쓴다. 응답은 도메인 객체·읽기 모델에서 `model_validate`한다(ORM 아님). 요청 스키마는 정의되지 않은 필드를 무시한다(AC-01-4).

### 5.1 auth
| 스키마 | 필드 | 타입 | 필수 | Field 제약 | description |
|---|---|---|---|---|---|
| `SignupRequest` | `login_id` | `str` | Y | `max_length=50` | "아이디(4~20자 영문 소문자·숫자)" |
| | `nickname` | `str` | Y | `max_length=50` | "닉네임(2~12자 한글·영문·숫자)" |
| | `password` | `str` | Y | `max_length=128` | "비밀번호(8자 이상)" |
| `UserResponse` | `id`, `login_id`, `nickname`, `created_at` | `int`, `str`, `str`, `datetime` | Y | — | 해시 필드 없음 (INV-13) |
| `TokenResponse` | `access_token`, `refresh_token`, `token_type` | `str`, `str`, `str` | Y | — | 교안 6장 `Token` (`token_type` 기본 "bearer") |
| `RefreshRequest` | `refresh_token` | `str` | Y | — | "토큰 재발급 및 로그아웃용 리프레시 토큰" |
| `AccessTokenResponse` | `access_token`, `token_type` | `str`, `str` | Y | — | 재발급 응답 |
| `MessageResponse` | `message` | `str` | Y | — | "로그아웃되었습니다" |

- 형식 규칙(길이·문자)은 스키마가 아니라 도메인이 검사해 400을 낸다(AC-08-2~4). 스키마 `max_length`는 비정상 입력 방어용(422)이다.

### 5.2 rooms
| 스키마 | 필드 | 타입 | 필수 | Field 제약 | description |
|---|---|---|---|---|---|
| `RoomCreateRequest` | `title` | `str` | Y | `max_length=100` | "방 제목(앞뒤 공백 제외 1~20자)" |
| `RoomRenameRequest` | `title` | `str` | Y | `max_length=100` | 같음 |
| `TeamChangeRequest` | `team` | `Literal["A","B"]` | Y | — | "옮길 팀" (그 밖의 값 422, AC-04-4) |
| `RoomSummaryResponse` | `id`, `title`, `current_count`, `capacity`, `is_full`, `created_at` | `int`, `str`, `int`, `int`, `bool`, `datetime` | Y | — | 목록 행 |
| `RoomListResponse` | `items`, `total`, `page`, `size` | `list[RoomSummaryResponse]`, `int`, `int`, `int` | Y | — | `total` = 조건 적용 건수 |
| `ParticipantResponse` | `user_id`, `nickname`, `team`, `is_host` | `int`, `str`, `Literal["A","B"]`, `bool` | Y | — | 입장 순서 없음 (REQ-045) |
| `RoomDetailResponse` | `id`, `title`, `capacity`, `current_count`, `is_full`, `host_user_id`, `participants`, `my_team`, `am_i_host`, `created_at` | `int`, `str`, `int`, `int`, `bool`, `int`, `list[ParticipantResponse]`(A팀 먼저, 팀 안에서 입장 순서), `Literal["A","B"] \| None`, `bool`, `datetime` | Y | — | `my_team`·`am_i_host`는 조회한 회원 기준 |
| `LeaveResponse` | `room_deleted`, `new_host_user_id` | `bool`, `int \| None` | Y | — | |
| `GameStartResponse` | `room_id`, `dissolved_at`, `message` | `int`, `datetime`, `str` | Y | — | `message` = "게임이 시작되어 방이 해산되었습니다" |
| `CurrentRoomResponse` | `room_id`, `title` | `int \| None`, `str \| None` | Y | — | 참가 중 아니면 둘 다 null |
| `HistoryItemResponse` | `participation_id`, `room_id`, `room_title`, `joined_at`, `left_at`, `is_current`, `room_deleted` | `int`, `int`, `str`, `datetime`, `datetime \| None`, `bool`, `bool` | Y | — | |
| `HistoryListResponse` | `items`, `total`, `page`, `size` | | Y | — | 정렬: `joined_at DESC, id DESC` (D-007) |
| `MyRecordResponse` | `joined_at`, `left_at` | `datetime`, `datetime \| None` | Y | — | |
| `ArchivedRoomResponse` | `room_id`, `title`, `capacity`, `created_at`, `deleted_at`, `my_records` | `int`, `str`, `int`, `datetime`, `datetime`, `list[MyRecordResponse]` | Y | — | 다른 회원 정보 없음 (D-009) |

- CSV 열(CH-B): `room_id,room_title,joined_at,left_at` (ISO 8601, `left_at` 비면 빈 칸).

## 6. 에러 모델

| 코드 | 기준 | 발생 위치 |
|---|---|---|
| 400 | `DomainRuleError` 하위: 입력 규칙 위반, 정원·팀 정원, 삭제된 방 변경, 방장·참가자가 아닌 요청 | 도메인 → 전역 핸들러 |
| 401 | `AuthenticationError`: 서명 오류·만료·refresh 토큰으로 API 접근·블랙리스트·회원 없음, 로그인 실패. 헤더 없음은 `OAuth2PasswordBearer` 기본 401 | 인증 의존성, `AuthApplicationService.login`·`refresh` |
| 404 | `NotFoundError`: 없는 방, EMPTY로 삭제된 방 상세, 보관 정보 권한 없음 | 응용 서비스 |
| 410 | `GoneError`: GAME_STARTED로 삭제된 방 상세 조회 (폴링 해산 신호) | `RoomQueryService.get_room_detail` |
| 422 | `RequestValidationError` → `{"detail": "<loc 마지막>: <msg>; …"}`(최대 3개) | 전역 핸들러 (ADR-004) |
| 500 | 처리하지 않은 예외 → `{"detail": "서버 오류가 발생했습니다"}`. 스택은 로그에만 | 전역 핸들러 (NFR-02) |

- 403은 쓰지 않는다. 방장 아님·참가자 아님은 PM AC 기본값대로 400이다(D-015).
- 사용자 문구는 `message`만 응답에 넣고, 로그에는 예외 클래스 이름·요청 경로·회원 ID를 남긴다(비밀번호·토큰 원문 금지).

## 7. 화면 데이터 계약 (PAGE)

화면 라우터: `src/rooms/presentation/pages.py`(`page_router`), `src/auth/presentation/pages.py`(`page_router`). `include_in_schema=False`. 템플릿은 `src/templates/`. **화면 라우트는 인증하지 않는다**(쿠키 없음, D-021). 서버는 템플릿 틀과 URL에서 온 값만 넘기고, 회원 데이터는 JS가 `localStorage`의 access 토큰으로 API를 불러 채운다. 로그인이 필요한 화면은 JS가 토큰이 없으면 바로 `/login`으로 이동한다(AC-11-3).

| PAGE | SCR | 경로 | 템플릿 | 서버 컨텍스트 변수(타입) | JS가 부르는 API | 데이터 없음·오류 시 |
|---|---|---|---|---|---|---|
| PAGE-01 | SCR-01 | `GET /signup` | `auth/signup.html` | — | API-AUTH-01 | 실패 문구 표시, 성공 시 `/login` |
| PAGE-02 | SCR-02 | `GET /login` | `auth/login.html` | `notice: str \| None` (`?expired=1` → "로그인이 만료되었습니다. 다시 로그인해 주세요") | API-AUTH-02(form) → 두 토큰을 `localStorage`에 저장 후 `/` | 401 문구 표시 |
| PAGE-03 | SCR-03 | `GET /` (쿼리 `keyword`, `available_only`, `sort`, `page`, `notice`) | `rooms/list.html` | `cond`(쿼리 값 그대로: 검색 폼 초기값), `notice: str \| None` (`notice=dissolved` → "게임이 시작되어 방이 해산되었습니다") | API-AUTH-04(머리글 닉네임), API-ROOM-01·02·05·09 | 목록 비면 "조건에 맞는 방이 없습니다. 새 방을 만들어 보세요" |
| PAGE-04 | SCR-04 | `GET /rooms/{room_id}` | `rooms/detail.html` | `room_id: int` | API-AUTH-04, API-ROOM-03·04·06·07·08 | 410 → `/?notice=dissolved`, 404 → "방을 찾을 수 없습니다" |
| PAGE-05 | SCR-05 | `GET /me/history` (쿼리 `page`) | `rooms/history.html` | `page: int` | API-AUTH-04, API-ROOM-10 | 비면 "아직 이용 기록이 없습니다" |
| PAGE-06 | SCR-06 | `GET /me/history/{room_id}` | `rooms/archived.html` | `room_id: int` | API-AUTH-04, API-ROOM-11 | 404 → "찾을 수 없습니다" |

- 공통 레이아웃 `base.html`, 조각 `partials/notice.html`, `partials/pagination.html`(필요 시). 목록 행은 JS가 그린다.
- 정적 파일: `src/static/css/app.css`, `src/static/js/api.js`(fetch 래퍼: `localStorage`의 access 토큰을 `Authorization: Bearer`로 붙임, JSON, `detail` 추출, 401 → `/api/auth/refresh`로 한 번 재발급 후 재시도, 실패하면 토큰 삭제 후 `/login?expired=1`, 로그아웃 → API-AUTH-03 후 토큰 삭제), `src/static/js/polling.js`(SEQ-13), `src/static/js/rooms.js`(목록·상세 동작).
- 변경 요청(생성·참가·팀·나가기·시작·로그아웃)은 모두 `api.js`의 JSON `fetch`로 보낸다.
- JS는 교안 수준을 넘지 않게 단순하게 쓴다: `fetch`·`localStorage`·`setInterval`·DOM 조작만, 외부 라이브러리·번들러 없음(D-020).

---

# A5. 실행 흐름

## 8. 트랜잭션 경계

- 요청 하나 = `get_db()` 세션 하나. `get_db()`는 `async with AsyncSessionLocal() as session: try: yield session / except: await session.rollback(); raise`.
- 변경 서비스 메서드는 마지막에 `await self.db.commit()`을 한 번만 한다. 레포지토리는 `flush`만 한다.
- 조회 서비스는 commit하지 않는다.
- 현재 시각은 서비스가 `self.clock()`으로 한 번 얻어 도메인 메서드에 넘긴다. 기본 `clock = lambda: datetime.now(UTC)`.

## 9. 시퀀스

### SEQ-01 회원가입 (API-AUTH-01)
router → `AuthApplicationService.signup` → `User.validate_raw_password` → `UserRepository.exists_login_id` (참 → `DuplicateLoginIdError`) → `exists_nickname` (참 → `DuplicateNicknameError`) → `hasher.hash` → `User.register` → `UserRepository.save` → commit → `UserResponse`. (동시에 같은 아이디가 들어오는 경우는 다루지 않는다: DB `unique`가 막고 500, D-020)

### SEQ-02 로그인 (API-AUTH-02, 교안 6장 `/login`)
router(`OAuth2PasswordRequestForm = Depends()`) → `login` → `find_by_login_id` (없음 → `AuthenticationError`) → `hasher.verify` (거짓 → 같은 `AuthenticationError`) → `create_access_token({"sub": login_id})`, `create_refresh_token({"sub": login_id})` → `TokenResponse`.

### SEQ-03 인증 의존성 (`src/auth/presentation/dependencies.py`, 교안 6장 `get_current_user`)
1. `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")` — 헤더 없으면 FastAPI가 401
2. `get_current_user(token = Depends(oauth2_scheme), db = Depends(get_db)) -> User` → `AuthApplicationService(db).authenticate(token)`:
   `decode_token` (`ExpiredSignatureError`·`InvalidTokenError` → `AuthenticationError`) → `token_type == "refresh"` → `AuthenticationError` → `sub` 없음 → `AuthenticationError` → `TokenBlacklistRepository.exists(token)` 참 → `AuthenticationError` → `find_by_login_id(sub)` 없음 → `AuthenticationError` → `User`
3. `get_current_user_id(user = Depends(get_current_user)) -> int` — rooms 라우터가 쓴다.

### SEQ-04 로그아웃 (API-AUTH-03)
router: `token = Depends(oauth2_scheme)`, `Depends(get_current_user)`(유효한 access 토큰만), 본문 `RefreshRequest` → `logout(token, body.refresh_token)`: `decode_token(refresh)` 실패 → `InvalidRefreshTokenError`(400) → 블랙리스트에 refresh 있음 → `AlreadyLoggedOutError`(400) → `TokenBlacklistRepository.save(TokenBlacklist(access))`, `save(TokenBlacklist(refresh))` → commit → `MessageResponse("로그아웃되었습니다")`. 이후 그 access 토큰은 SEQ-03의 블랙리스트 확인에서 401(AC-10-2). 참가 상태는 건드리지 않는다(AC-10-3).

### SEQ-04b 재발급 (API-AUTH-05, 교안 6장 `/refresh`)
`refresh(refresh_token)`: 블랙리스트에 있음 → `AuthenticationError("로그아웃 처리되어 사용할 수 없는 토큰입니다")` → `decode_token` 실패 → `AuthenticationError("리프레시 토큰이 만료되었습니다. 다시 로그인하세요")` → `token_type != "refresh"` → 같은 401 → `create_access_token({"sub": sub})` → `AccessTokenResponse`.

### SEQ-05 방 생성 (API-ROOM-02)
`create_room` → `RoomRepository.find_current_participation(user_id)` → `Room.create(title, user_id, current, now)` → `RoomRepository.save(room)` (방 insert → 참가 insert. 도전 A 적용 후에는 `uq_participations_user_current` 위반 → `AlreadyParticipatingError`) → commit → 캐시 clear(CH-C) → router가 `RoomQueryService.get_room_detail(room.id, user_id)`로 응답.

### SEQ-06 방 참가 (API-ROOM-05)
`join_room` → `find_current_participation(user_id)` → `find_by_id(room_id)` (없음 → `RoomNotFoundError`) → `room.join(user_id, current, now)` → `save` → commit → 캐시 clear → 상세 응답.
- 도전 A(ADR-009): `find_by_id`를 `find_by_id_for_update`(방 행 잠금)로 바꾸고, `save`가 부분 유니크 위반을 `AlreadyParticipatingError`로 바꾼다. 잠금 후 도메인이 삭제 상태·정원을 다시 검사하므로 마지막 자리 동시 참가는 하나만 성공한다(AC-18-1).

### SEQ-07 제목 변경·팀 변경 (API-ROOM-04, API-ROOM-06)
`find_by_id` (없음 → 404, 도전 A는 `find_by_id_for_update`) → `room.rename(...)` 또는 `room.change_team(...)` → `save` → commit → 캐시 clear → 상세 응답.

### SEQ-08 나가기 (API-ROOM-07)
`find_by_id`(도전 A는 `find_by_id_for_update`) → 기존 방장 기억 → `room.leave(user_id, now)` → `save` → commit → 캐시 clear → `LeaveResult(room_deleted=not room.is_active, new_host_user_id=room.host_user_id if 방장이 바뀌었고 방이 활성 else None)`.

### SEQ-09 게임 시작 (API-ROOM-08)
`find_by_id`(도전 A는 `find_by_id_for_update`) → `room.start_game(user_id, now)` (삭제 → 400, 방장 아님 → 400, 구성 불일치 → 400) → `save`(방 `deleted_at`·`delete_reason`, 참가 4건 `left_at`) → commit → 캐시 clear → `GameStartResult` → (CH-B) `background_tasks.add_task(log_room_dissolved, room_id, dissolved_at)`.
- 반복 요청(순차): 두 번째 요청은 삭제된 방을 읽어 `RoomDeletedError`(400). 해산은 한 번뿐이다(AC-06-5).
- 도전 A: 동시 반복 요청은 잠금을 기다린 뒤 같은 결과가 된다(AC-18-4). 시작과 나가기 경합도 같은 방 행 잠금으로 순서가 정해져 AC-18-5의 두 결과 중 하나만 생긴다.

### SEQ-10 공개 방 목록 (API-ROOM-01)
router가 쿼리를 `RoomListCondition`으로 묶음(keyword strip, 빈 문자열 → None) → `RoomQueryService.list_rooms` → (CH-C) 캐시 조회 → `RoomQueryRepository.list_active_rooms`: `select(RoomModel).where(deleted_at IS NULL).options(selectinload(participations)).order_by(created_at, id 정렬)` → 파이썬에서 방마다 현재 인원(`left_at is None` 개수) 계산 → `keyword.lower() in title.lower()`·`available_only`(인원 < 4)로 거름 → `total = len(목록)` → `목록[(page-1)*size : page*size]` → `RoomPage` (교안 2·3장 방식, D-020).

### SEQ-11 화면 렌더링 (PAGE-03 예)
page_router → `templates.TemplateResponse(request, "rooms/list.html", {"cond": …, "notice": …})`(인증 없음) → 브라우저에서 `api.js`가 토큰 확인(없으면 `/login`) → API-AUTH-04·ROOM-01·09를 불러 화면을 채운다.

### SEQ-12 lifespan
`create_all`(`run_sync(Base.metadata.create_all)`) → `async with AsyncSessionLocal() as s: await seed_initial_data(s, settings); await s.commit()` → yield → `engine.dispose()`.

### SEQ-13 화면 폴링 (`polling.js`)
- `startPolling(fetchFn, intervalMs=1000)`: 진행 중인 요청이 있으면 건너뜀, 요청마다 증가하는 `seq`를 붙여 조건 변경 전 응답은 버림, `document.visibilitychange`로 숨김 시 중단·보이면 즉시 1회 후 재개.
- 목록(SCR-03): `GET /api/rooms?…`와 `GET /api/me/room`을 같은 주기로 호출.
- 상세(SCR-04): `GET /api/rooms/{id}` — 200 → 갱신, 410 → 중단 후 `/?notice=dissolved`, 404 → 중단 후 "방을 찾을 수 없습니다", 401 → (`api.js`가 재발급에 실패하면) 중단 후 `/login?expired=1`, 네트워크 오류·5xx → 마지막 정보 유지 + "최신 정보를 불러오지 못했습니다".
- 게임 시작 성공(방장): 폴링 중단 → `/?notice=dissolved`.

### SEQ-14 도전 B
- 해산 로그: `log_room_dissolved(room_id, dissolved_at)`가 `logger.info("room dissolved room_id=%s at=%s", …)`. 예외는 잡아 `logger.exception`으로만 남기고 응답에는 영향 없음.
- CSV: `iter_history_csv(user_id)`가 헤더 1줄 후 `stream_scalars`(yield_per 500)로 본인 기록을 한 줄씩 생성, router가 `StreamingResponse(..., media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=room-history.csv"})`.

## 10. 상태 머신

| 현재 상태 | 이벤트(도메인 메서드) | 다음 상태 | 실행 주체 | 권한 | 부수 효과 |
|---|---|---|---|---|---|
| — | `Room.create` | 활성 | 회원 | 참가 중 아님 | 참가 1건(A, 순서 1), host = 생성자 |
| 활성 | `Room.join` | 활성 | 회원 | 참가 중 아님(같은 방이면 변화 없음) | 참가 1건, `last_join_order`+1 |
| 활성 | `Room.rename` | 활성 | 방장 | 방장 | 제목 변경 |
| 활성 | `Room.change_team` | 활성 | 참가자 | 본인 | 팀 변경 |
| 활성 | `Room.leave` (남은 사람 있음) | 활성 | 참가자 | 본인 | `left_at`, 방장이면 위임 |
| 활성 | `Room.leave` (마지막) | 삭제됨(EMPTY) | 참가자 | 본인 | `left_at`, `deleted_at` |
| 활성 (A2·B2) | `Room.start_game` | 삭제됨(GAME_STARTED) | 방장 | 방장 | 전원 `left_at`, `deleted_at` |
| 삭제됨 | 모든 행위 메서드 | — | — | — | `RoomDeletedError` |

참가: `참가 중 --change_team--> 참가 중`, `참가 중 --end--> 종료`, `종료 --*--> ParticipationAlreadyEndedError`.

## 11. 중복 요청·응답 유실 (ARCH-Q-06)

| 요청 | 결과 |
|---|---|
| 같은 방 참가 2회 | 두 번째도 200, 기록 추가 없음 (D-006) |
| 나가기 2회 | 두 번째 400 "이 방의 참가자가 아닙니다" |
| 게임 시작 2회 | 두 번째 400 "이미 삭제된 방입니다" |
| 같은 팀으로 변경 2회 | 둘 다 200, 변화 없음 |
| 방 생성 2회(응답 유실 후 재시도) | 두 번째 400 "이미 다른 방에 참가 중입니다" |

- 응답을 못 받은 클라이언트는 `GET /api/me/room`(현재 참가 방)과 `GET /api/rooms/{id}`(404/410 포함)로 결과를 확인한다. 화면은 다음 폴링이 이 역할을 한다.
