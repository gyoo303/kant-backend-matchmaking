# C 파트 작업계획표 — 방 도메인·변경 서비스

> 기준: `origin/dev`의 `docs/work-assignment.md`(D-026 반영본, C ≈ 665, 난이도 상), `docs/01-pm/`·`docs/02-arch/`, 참고 구현 `reference/agent-pipeline-blueprint`
> 교안: [백엔드 아키텍처 & API 설계 실습 모음](https://charmed-watch-60f.notion.site/API-405566040df880fbbe34c039dd0f281d) — 아래 표의 "교안"은 `장-강 / 문제 번호`로 적었어요
> 다른 파트 단계 번호: A는 `work-plan-A.md`의 ①~⑩을 그대로 썼어요. B·D·E는 **파일·이름**으로 적었어요. 파트별 단계 번호로 맞춘 전체 그림은 `team-work-plan.md`와 `team-dependency-diagram.html`을 보세요

---

## 0. 시작 전에 확인할 것

| 확인 | 내용 |
|---|---|
| 최신 `dev` 받기 | 지금 로컬 `dev` = `origin/dev`(b7fac74)예요. 작업 시작 전에 `git pull`만 한 번 해요 |
| 내 파일 8개 | `src/rooms/domain/`의 `room.py`·`team.py`·`participation.py`·`exceptions.py`, `src/rooms/application/service.py`, `src/rooms/presentation/pages.py`, `src/templates/rooms/history.html`·`archived.html`. **템플릿 실제 경로는 `src/templates/…`**예요(분담표 §2의 `templates/rooms/…`는 앞의 `src/`를 뺀 표기) |
| 내 파일이 아닌 것 | `read_models.py`·`repositories.py`·`queries.py`(D), `router.py`·`schemas.py`·`list.html`·`detail.html`·`rooms.js`(E), `base.html`·`partials/*`·`main.py`·`seed.py`(A), `api.js`·`auth/presentation/pages.py`(B). 가져다 쓰기만 해요 |
| 가장 먼저 할 일 | 분담표 §5: **도메인 생성자·메서드 이름을 빈 껍데기로 먼저 올리기**(반나절 안). D(레포지토리)와 E(라우터)가 이걸 import해요 → §2 ① |
| 교안 수준 규칙 | `docs/02-arch/05-structure-conventions.md` §8(D-020). `@dataclass`(`frozen`·`__post_init__`)·`StrEnum`·`@property`·`typing.Protocol`·`Callable` 주입은 B등급이라 써도 돼요 |
| 시그니처 고정 | 이름·인자 순서·예외 문구는 `docs/02-arch/04-interfaces-api.md` §1.2·§2.3~2.5·§3이 정답이에요. 바꿔야 하면 혼자 바꾸지 말고 D·E·A에게 먼저 말해요 |
| 이번 범위 밖 | 잠금(`find_by_id_for_update`)·`IntegrityError` 400 변환·목록 캐시 구현은 도전 과제(D-018)라 넣지 않아요. 테스트 파일도 이 표 범위가 아니에요(분담표 머리말) |

## 1. 전체 순서 한눈에 보기

```
[1일차 오전: 선행 — D·E가 기다림]  (A PR① exceptions.py 머지 직후)
  ① 도메인 껍데기: exceptions.py 완성 + participation·team·room 이름·생성자·시그니처 → PR①(반나절 안에 머지·공지)

[1일차 오후~2일차: 도메인 완성 — 단독 진행]
  ② participation.py → ③ team.py → ④ room.py 기본(제목·생성자·조회 속성·create)
  → ⑤ room.py 행위(join·change_team·leave·start_game·rename) → PR②

[도메인과 나란히: 의존 거의 없음]
  ⑥ pages.py(화면 라우트 4개) → PR③ (A ⑧에 page_router 이름 전달)

[D RoomRepository·read_models 머지 뒤]
  ⑦ service.py(RoomApplicationService 6개 흐름) → PR④ (E 라우터가 import)

[A ⑦ 공통 틀 + B api.js 합의 뒤]
  ⑧ history.html → ⑨ archived.html → PR⑤

[마지막: A ⑧ 조립·D 조회·E 라우터 머지 뒤]
  ⑩ 연결 확인(Swagger로 SEQ-05~09, 화면 SCR-05·06)
```

## 2. 단계별 계획

### ① 도메인 껍데기 — `rooms/domain/exceptions.py` 완성 + `participation.py`·`team.py`·`room.py` 이름만 → **PR① 먼저 머지하고 D·E에 공지**

| 항목 | 내용 |
|---|---|
| 할 일 — 예외 | `exceptions.py` 11개를 **완성**해요(한 줄짜리라 껍데기가 곧 완성). `DomainRuleError` 하위 9개: `InvalidRoomTitleError`, `RoomDeletedError`, `RoomFullError`, `AlreadyParticipatingError`, `NotHostError`, `NotParticipantError`, `TeamFullError`, `InvalidTeamCompositionError`, `ParticipationAlreadyEndedError` / `NotFoundError` 하위 `RoomNotFoundError` / `GoneError` 하위 `RoomDissolvedError`. 각 `__init__`에서 `super().__init__("<문구>")` |
| 할 일 — 껍데기 | `participation.py`: `TeamSide(StrEnum)` A·B, `@dataclass Participation(room_id, user_id, join_order, team, joined_at, left_at=None)`, `is_current`·`change_team`·`end` / `team.py`: `@dataclass Team(id, side, members)`, `CAPACITY`, `count`·`is_full`·`add`·`remove` / `room.py`: `DeleteReason(StrEnum)`, `@dataclass(frozen=True) RoomTitle(value)` + `of`, `Room.__init__`(9개 인자, 속성 저장까지), 조회 속성·메서드 이름 전부. 본문이 긴 메서드는 `raise NotImplementedError`로 둬요 |
| 참고 | 교안 3-1 심화1(ValueError 전역 예외 처리기 — 예외 계층), 1-2 필수2(유효성 검사 포함 도메인 모델 클래스), 7-1 필수1(도메인 디렉터리·순수 도메인 규칙) / `04-interfaces-api.md` §1.2(문구 표)·§2.3~2.5(시그니처), ADR-010, ADR-011, blueprint `src/rooms/domain/*.py` |
| 유의 — 문구 | 문구는 `04-interfaces-api.md` §1.2를 **글자 그대로** 써요(E의 응답·화면 안내·QA 기대값이 이 문구를 씀). 예: `RoomFullError` "정원이 마감되었습니다", `InvalidTeamCompositionError` "A팀과 B팀이 각각 2명일 때만 시작할 수 있습니다", `RoomDissolvedError` "게임이 시작되어 방이 해산되었습니다" |
| 유의 — D·E가 쓰는 이름 | D의 레포지토리가 `Room(id=, title=RoomTitle(...), host_user_id=, last_join_order=, created_at=, deleted_at=, delete_reason=, teams=[Team(id=, side=)], participations=[...])`로 **키워드 인자** 생성하고, `room.teams.values()`, `room.participations`, `room.title.value`, `Room.CAPACITY`를 읽어요. D의 `read_models.py`·E의 `router.py`는 `from rooms.domain.room import TeamSide`로 가져가요 → `room.py`·`team.py`가 `TeamSide`를 **다시 내보내야**(`__all__`) 해요(§2.3 첫 줄) |
| 유의 — 의존 | `exceptions.py`는 A의 `src/exceptions.py`(`DomainRuleError`·`NotFoundError`·`GoneError`)를 import해요 → A PR① 머지가 선행이에요. 도메인은 표준 라이브러리 + `exceptions` + 같은 기능 `domain`만 import(GATE-02). import 방향은 `team.py → participation.py`, `room.py → team.py·participation.py` 한 방향(순환 금지, ADR-010) |
| 완료 확인 | `PYTHONPATH=src uv run python -c "from rooms.domain.room import Room, RoomTitle, DeleteReason, TeamSide; from rooms.domain.team import Team; from rooms.domain.participation import Participation"` 오류 없음, GATE-02 첫 명령 0줄, `uv run ruff check src` 오류 0 |

### ② `src/rooms/domain/participation.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `__post_init__`: `join_order < 1` → `ValueError`, `left_at`이 있고 `joined_at`보다 이르면 `ValueError`. `is_current`(속성) = `left_at is None`. `change_team(team)`: 끝난 기록이면 `ParticipationAlreadyEndedError`, 아니면 `self.team = team`. `end(now)`: 끝난 기록 → `ParticipationAlreadyEndedError`, `now < joined_at` → `ValueError`, 아니면 `left_at = now` |
| 참고 | 교안 1-2 필수2(생성자 검증 + `ValueError`, 상태 변경 메서드), 7-1 필수1 / `04-interfaces-api.md` §2.5·§10 마지막 줄, `03-domain.md` §4.5·INV-10·11, ADR-011, blueprint `src/rooms/domain/participation.py` |
| 유의 | **`id` 필드를 만들지 않아요**(D-025). 식별은 (`room_id`, `user_id`). `room_id`는 새 방이면 `None`. `left_at`은 "이번 요청에서 끝났다"는 표시예요 — 이걸 보고 D의 `save`가 `participation_logs`로 옮겨요. 도메인에서 `datetime.now()`를 부르지 않고 `now`를 인자로 받아요(금지 패턴 11) |

### ③ `src/rooms/domain/team.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `CAPACITY: ClassVar[int] = 2`, 필드 `id: int \| None`, `side: TeamSide`, `members: list[Participation] = field(default_factory=list)`. `count` = `len(members)`, `is_full` = `count >= CAPACITY`. `add(p)`: 가득 차면 `TeamFullError` → `p.change_team(self.side)` → `members.append(p)`. `remove(p)`: `members.remove(p)` |
| 참고 | 교안 7-1 필수1 / `04-interfaces-api.md` §2.4, `03-domain.md` §4.4·INV-03, ADR-010, D-023, blueprint `src/rooms/domain/team.py` |
| 유의 | 문서의 `members: list[Participation] = []`는 표기일 뿐, dataclass에서는 `field(default_factory=list)`로 써야 해요. `CAPACITY`는 `ClassVar`라야 dataclass 필드가 되지 않아요. `add`가 `change_team`을 부르므로 끝난 기록은 `ParticipationAlreadyEndedError`로 막혀요. **`Team`은 `Room`을 통해서만 바뀌어요** — 서비스·레포지토리가 `add`/`remove`를 직접 부르지 않아요 |

### ④ `src/rooms/domain/room.py` 기본 — 제목·생성자·조회 속성·`create`

| 항목 | 내용 |
|---|---|
| 할 일 | `DeleteReason`(`GAME_STARTED`·`EMPTY`), `RoomTitle.__post_init__`(공백이 앞뒤에 있거나 1~20자가 아니면 `InvalidRoomTitleError`), `RoomTitle.of(raw)` = `cls(raw.strip())`. `Room.CAPACITY = 4`. `__init__` 검증 3개 + `self.teams = {team.side: team}` + 각 팀 `members`를 현재 참가 중 그 편인 것으로 다시 채우기. 조회 속성 `is_active`·`current_participants`·`current_count`·`is_full`·`available_seats`, 메서드 `team(side)`·`participation_of(user_id)`(현재 참가만). `create(title, creator_id, current_participation, now)` |
| 참고 | 교안 1-2 필수2, 7-1 필수1, 2-1 필수2(트림·조건 검증 아이디어) / `04-interfaces-api.md` §2.3, `03-domain.md` §4.3·INV-01·05·07·12, ADR-010, blueprint `src/rooms/domain/room.py` |
| 유의 — 생성자 | 검증: `last_join_order < 0` → `ValueError`, `deleted_at`·`delete_reason`이 하나만 있으면 `ValueError`(INV-07), 팀이 A·B 하나씩이 아니면 `ValueError`. **팀원 다시 채우기를 빠뜨리면** D가 DB에서 읽은 방의 `Team.members`가 비어 팀 정원 검사가 틀려요(RISK-13) |
| 유의 — 제목 | `RoomTitle(value)`는 이미 다듬은 값만 받고(D가 DB 값으로 바로 만듦), 사용자 입력은 `RoomTitle.of`로 다듬어요. 둘 다 있어야 해요 |
| 유의 — `create` | 순서: `current_participation`이 있으면 `AlreadyParticipatingError` → `RoomTitle.of(title)` → 생성자 참가 `Participation(room_id=None, user_id=creator_id, join_order=1, team=A, joined_at=now)` → `teams=[Team(None, A), Team(None, B)]`, `last_join_order=1`, `host_user_id=creator_id`. 생성자를 A팀에 넣는 건 `__init__`의 다시 채우기가 해 줘요 |

### ⑤ `src/rooms/domain/room.py` 행위 메서드 → **PR② (도메인 완성)**

| 항목 | 내용 |
|---|---|
| 할 일 | `rename`, `join`, `change_team`, `leave`, `start_game` + 내부 `_team_to_join`(A팀에 자리가 있으면 A, 없으면 B), `_ensure_active`(삭제 방 → `RoomDeletedError`), `_soft_delete(reason, now)` |
| 참고 | 교안 1-2 필수2(상태 변경 메서드), 7-1 필수1 / `04-interfaces-api.md` §2.3 주석(거부 순서)·§10 상태 머신·§11 중복 요청, `03-domain.md` §4.3·§5.1·INV-02~09, D-006, D-024, ADR-010·011, blueprint `src/rooms/domain/room.py` |
| 유의 — 거부 순서 | 모든 행위는 **`_ensure_active()` 먼저**, 그다음은 §2.3 주석 순서 그대로(테스트 기대값 고정). `rename`: 삭제 → 방장 아님 → 제목 규칙. `join`: 삭제 → 현재 참가 있음(같은 방이면 그 기록 반환, 다른 방이면 `AlreadyParticipatingError`) → 정원 → 배정. `start_game`: 삭제 → 방장 아님 → 두 팀 중 `is_full`이 아닌 팀 → `InvalidTeamCompositionError` |
| 유의 — 같은 방 재요청 | `join`에서 "같은 방" 판단은 `self.id is not None and current_participation.room_id == self.id`. 기록 추가 없이 반환(D-006, AC-02-7) |
| 유의 — `join` | `last_join_order += 1` → 새 `Participation(room_id=self.id, …, join_order=self.last_join_order)` → `team.add(참가)` → `self.participations.append(참가)`. A팀 우선(D-024, AC-02-9). 나갔다 다시 오면 **새 기록·새 순서**(INV-11, AC-02-8) |
| 유의 — `change_team` | 같은 팀이면 아무것도 안 해요(AC-04-6). **원래 팀을 먼저 변수에 담고** `self.team(target).add(참가)` → `원래팀.remove(참가)`. `add`가 `참가.team`을 바꾸므로 순서를 바꾸면 엉뚱한 팀에서 빼요 |
| 유의 — `leave` | `참가.end(now)` → 소속 팀 `remove` → 남은 사람 0명이면 `_soft_delete(EMPTY)`, 아니고 나간 사람이 방장이면 남은 사람 중 `join_order` 최소에게 위임(INV-05) |
| 유의 — `start_game` | 전원 `end(now)` → 두 팀 `members.clear()` → `_soft_delete(GAME_STARTED)`. 승패·결과 필드 금지(INV-09, GATE-07 `winner\|loser\|game_result`) |
| 유의 — 문서 차이 | `03-domain.md` §4.3의 `leave` 거부 규칙에는 "삭제된 방"이 없지만 `04-interfaces-api.md` §2.3은 "모든 행위 메서드는 삭제된 방이면 `RoomDeletedError` 먼저"예요 → **04를 따라요**(HANDOFF: 설계 문서 우선, blueprint도 같음). 그래서 §11 "나가기 2회 → 400 참가자가 아닙니다"는 방이 남아 있을 때만 맞고, 마지막 1명이 두 번 나가면 "이미 삭제된 방입니다"가 나와요. 또 03의 `Room.soft_delete()`·`create(title, creator, …)`는 후보 이름이고, 확정은 04의 `_soft_delete`·`creator_id`예요 |
| 완료 확인 | 파이썬 셸에서 손으로 시나리오 확인(DB 없음, 시각은 고정 `datetime(…, tzinfo=UTC)`): 생성 → 3명 참가(A·A·B·B 배정) → 4명이면 `RoomFullError` → 방장 나가기 위임 → 2:2 시작 후 `delete_reason == GAME_STARTED`·전원 `left_at` 있음 → 다시 `start_game` → `RoomDeletedError`. GATE-02 첫 명령·GATE-07 `datetime\.now\|random\.` 0줄 |

### ⑥ `src/rooms/presentation/pages.py` → PR③

| 항목 | 내용 |
|---|---|
| 할 일 | `TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"`, `templates = Jinja2Templates(directory=TEMPLATES_DIR)`, `DISSOLVED_NOTICE = "게임이 시작되어 방이 해산되었습니다"`, `page_router = APIRouter(include_in_schema=False)`. 라우트 4개: `GET /`(`room_list_page`), `GET /rooms/{room_id}`(`room_detail_page`), `GET /me/history`(`history_page`), `GET /me/history/{room_id}`(`archived_room_page`) |
| 참고 | 교안 3-2 필수1(`Jinja2Templates`·`TemplateResponse`), 4-1 필수1(`APIRouter` 파일 분리), 3-1 필수1(쿼리 매개변수) / `04-interfaces-api.md` §7 PAGE-03~06·SEQ-11, CONV-03·12, STK-09, D-021, blueprint `src/rooms/presentation/pages.py` |
| 유의 — 컨텍스트 | PAGE 표 그대로: `/` → `cond`(dict: `keyword`·`available_only`·`sort`·`page`, 쿼리 값 그대로)와 `notice`(쿼리 `notice == "dissolved"`이면 `DISSOLVED_NOTICE`, 아니면 `None`) / 상세·보관 → `room_id: int` / 기록 → `page: int`. E의 `list.html`이 `cond.keyword`·`cond.available_only`·`cond.sort`를, A의 `notice.html`이 `notice`를 읽어요 — **이름을 E·A와 맞춰요** |
| 유의 — 인증 없음 | 화면 라우트는 인증하지 않아요(D-021). 회원 데이터는 템플릿 JS가 API로 채워요. `get_current_user`를 붙이지 않아요 |
| 유의 — 경로·문법 | 이 파일은 `src/rooms/presentation/`에 있어서 `parents[2]`라야 `src/templates`예요(CONV-12의 "`Path(__file__).parent` 기준"은 "파일 위치 기준"이라는 뜻). 응답은 `templates.TemplateResponse(request=request, name="rooms/list.html", context={...})` 키워드 방식(교안 3장, blueprint). 옛 `{"request": request}` 방식 금지(STK-09) |
| 유의 — 문서 차이 | 분담표 §3 C에 "화면 라우트 6개(`pages.py`)"라고 돼 있지만, 이 파일은 **PAGE-03~06의 4개**예요. PAGE-01·02(`/signup`·`/login`)는 B의 `auth/presentation/pages.py`예요(스켈레톤 주석·`04` §7·blueprint 모두 4개) |
| 완료 확인 | A ⑥(static 마운트)·⑧(라우터 등록) 뒤 토큰 없이 4개 경로 200. `/?notice=dissolved`에서 안내 문구가 처음부터 보임 |

### ⑦ `src/rooms/application/service.py` → PR④ (E가 import)

| 항목 | 내용 |
|---|---|
| 할 일 | `RoomApplicationService.__init__(db, clock=_utc_now, list_cache=None)` → `self.rooms = RoomRepository(db)`. 메서드 6개: `create_room(user_id, title) -> Room`, `join_room(room_id, user_id) -> Room`, `rename_room(room_id, user_id, title) -> Room`, `change_team(room_id, user_id, team: TeamSide) -> Room`, `leave_room(room_id, user_id) -> LeaveResult`, `start_game(room_id, user_id) -> GameStartResult`. 내부 `_get_room`(없으면 `RoomNotFoundError`), `_commit`(commit 후 `list_cache`가 있으면 `clear()`) |
| 참고 | 교안 7-1 필수3(응용 서비스 — 단, 비관적 락은 빼요), 7-1 필수2(레포지토리 패턴), 5-2 필수2(`AsyncSession`) / `04-interfaces-api.md` §3·§8(트랜잭션 경계)·§9 SEQ-05~09·§11, CONV-02·04·05·06·08, HANDOFF TKT-BE-M3-02, blueprint `src/rooms/application/service.py` |
| 유의 — 흐름 | 모든 메서드: **조회 → 도메인 메서드 → `save` → commit 한 번**. `create_room`·`join_room`은 `find_current_participation(user_id)`를 먼저 읽어 도메인에 넘겨요(한 회원 한 방 판단은 도메인, 03 §4.3). `datetime.now(UTC)`는 `clock`에서만(CONV-06), 시각은 메서드마다 한 번 얻어 넘겨요 |
| 유의 — 반환 | `create_room`은 `save`가 돌려준 방(**id가 채워진** `saved`)을 반환해요 — E의 라우터가 `room.id`로 상세를 다시 조회해요(SEQ-05). `leave_room`은 `leave` **전에** `previous_host`를 기억하고 `LeaveResult(room_deleted=not room.is_active, new_host_user_id=방이 활성이고 방장이 바뀌었으면 새 방장, 아니면 None)`. `start_game`은 `GameStartResult(room_id, dissolved_at=now)` |
| 유의 — 금지 | 서비스에 정원·팀·방장 if-else 금지(금지 패턴 4), `select()`·`session.execute` 금지(GATE-07), ORM 모델 이름 import 금지(GATE-08), 라우터용 `try/except` HTTP 변환 금지(CONV-05). 필수 범위는 `find_by_id`(잠금 없음) — `find_by_id_for_update`는 도전 A(CONV-08, TKT-BE-M6-00) |
| 유의 — 문서 차이 | `04` §3은 생성자를 `(db, clock, list_cache: RoomListCache \| None = None)`로 적었지만 `RoomListCache`는 도전 C 파일(`list_cache.py`, TKT-BE-M6-02)이라 필수 범위에 없어요. blueprint처럼 같은 파일에 `class ListCacheInvalidator(Protocol): def clear(self) -> None: ...`를 두고 `list_cache: ListCacheInvalidator \| None = None`으로 써요(HANDOFF M3-02 "None 허용"). `clock`의 기본값은 §8의 "`datetime.now(UTC)`" — blueprint는 `_utc_now` 함수 |
| 유의 — 의존 | D의 `RoomRepository`(`find_by_id`, `find_current_participation`, `save`)와 `read_models.py`의 `LeaveResult`·`GameStartResult`가 **먼저 머지돼야** import가 돼요. 이 파일이 import 실패하면 E의 `router.py` → A의 `main.py`까지 같이 멈춰요 |
| 완료 확인 | GATE-07 `session\.execute\|select\(` 0줄, GATE-08 0줄. 기능은 ⑩에서 Swagger로 확인 |

### ⑧ `src/templates/rooms/history.html` (SCR-05 내 이용 기록)

| 항목 | 내용 |
|---|---|
| 할 일 | `{% extends "base.html" %}` + `title`·`content`·`scripts` 블록. `section#history[data-page="{{ page }}"]`, 전체 건수 `#history-total`, 빈 안내 `#history-empty`("아직 이용 기록이 없습니다"), 표 `#history-table`(방 제목·입장 시각·퇴장 시각·보관 정보) `tbody#history-rows`, `{% include "partials/pagination.html" %}`. 인라인 스크립트 `loadHistory()`: `apiRequest("GET", "/api/me/room-history?page=" + page)` → 행 그리기 → `renderPagination(..., p => "/me/history?page=" + p)` |
| 참고 | 교안 3-2 필수1(`{% extends %}`·`{% block %}`·`{% include %}`) / `docs/01-pm/07-screens.md` §2(기록 행)·§3 SCR-05, `04-interfaces-api.md` §7 PAGE-05·API-ROOM-10·§5.2 `HistoryItemResponse`, AC-13-1·5, AC-17-2~4, blueprint `src/templates/rooms/history.html` |
| 유의 — 데이터 | 응답 필드는 `room_id`, `room_title`, `joined_at`, `left_at`, `is_current`, `room_deleted`(snake_case, 기록 ID 없음 D-025). 퇴장 칸: `is_current`면 "참가 중", 아니면 `formatTime(left_at)`. `room_deleted`인 행만 `/me/history/{room_id}` [보관 정보] 링크(AC-17-4). 검색·필터·정렬 UI 없음(REQ-055) |
| 유의 — 보안·JS | 사용자 값은 `textContent`로만 넣어요(`innerHTML` 금지, RISK-10). `fetch`·DOM만, 라이브러리·`setInterval` 금지(D-020, ADR-012). 토큰이 없으면 바로 반환 — 로그인 이동은 `base.html`의 `data-require-login`과 B의 `api.js`가 해요 |
| 유의 — 문서 차이 | `05-structure-conventions.md` §1 트리에 `partials/history_row.html`이 있지만 스켈레톤·blueprint에는 없고 행은 JS가 그려요(`04` §7 "목록 행은 JS가 그린다"). 이 파일 안에서 그리고, 조각을 새로 만들지 않아요(A 담당 폴더) |

### ⑨ `src/templates/rooms/archived.html` (SCR-06 보관 정보) → PR⑤(⑧과 함께)

| 항목 | 내용 |
|---|---|
| 할 일 | `section#archived[data-room-id="{{ room_id }}"]`(처음엔 `hidden`), 제목 `#archived-title`, 정원·생성 시각·삭제 시각 표, "본인 입장·퇴장 기록" 표 `tbody#archived-records`. 스크립트 `loadArchived()`: `apiRequest("GET", "/api/me/room-history/" + roomId)` → 성공이면 그리기, 404면 `showNotice("찾을 수 없습니다", "error")`, 그 밖에는 `showNotice(errorMessage(result), "error")` |
| 참고 | 교안 3-2 필수1 / `07-screens.md` §4 SCR-06, `04-interfaces-api.md` §7 PAGE-06·API-ROOM-11·§5.2 `ArchivedRoomResponse`, AC-14-1~3, D-009, blueprint `src/templates/rooms/archived.html` |
| 유의 | 응답 필드: `room_id`, `title`, `capacity`, `created_at`, `deleted_at`, `my_records[{joined_at, left_at}]`. **참가·복구 버튼 없음**(읽기 전용, AC-14-3). 다른 회원 정보 없음(D-009). 404 문구는 서버 `detail`("방을 찾을 수 없습니다")이 아니라 화면 문구 "찾을 수 없습니다"를 써요(PAGE-06·SCR-06) |
| 완료 확인(⑧⑨) | `grep -rnE "setInterval\|polling" src/templates/rooms` 0줄. 화면 동작은 ⑩에서 |

### ⑩ 연결 확인 (C 코드가 다른 파트와 실제로 맞물리는지)

| 확인 | 방법 |
|---|---|
| 변경 API 6개 | E 라우터·A 조립 머지 뒤 Swagger(`/docs`) Authorize → SEQ-05~09 순서로 생성·참가·제목·팀·나가기·시작. 400 문구가 §1.2와 같은지, 시작 뒤 상세가 410인지 |
| 중복 요청 | `04` §11 표 5줄(같은 방 참가 2회 200, 나가기 2회 400, 시작 2회 400 "이미 삭제된 방입니다", 같은 팀 2회 200, 생성 2회 400) |
| 로그 이동 | 나가기·시작 뒤 `GET /api/me/room-history`에 끝난 기록이 보임(D의 `save` + C의 `left_at`이 맞물림) |
| 화면 | `/me/history`·`/me/history/{room_id}`가 시드(A ⑨) 데이터로 그려지고, 삭제 방만 [보관 정보] 링크, 페이지 이동 동작 |
| 게이트 | GATE-02·05·07·08 출력 0줄 |

## 3. 추천 브랜치·PR 단위

| PR | 브랜치 | 담는 것 |
|---|---|---|
| ① | `feat/rooms-domain-skeleton` | ① (예외 완성 + 도메인 이름·시그니처) |
| ② | `feat/rooms-domain` | ②③④⑤ (도메인 완성. 크면 ②③ / ④⑤로 나눠도 돼요) |
| ③ | `feat/rooms-pages` | ⑥ |
| ④ | `feat/rooms-application-service` | ⑦ |
| ⑤ | `feat/rooms-history-archived-pages` | ⑧⑨ |

- 한 PR에 한 가지 작업만 담아요(CONV-13). PR①은 **반나절 안에** 올려야 D·E가 시작할 수 있어요.
- PR④는 D의 `RoomRepository`·`read_models.py` PR보다 **뒤에** 머지해요(import 순서).
- PR 전에 `uv run ruff check src tests`, `uv run ruff format --check src tests`(GATE-05)를 돌려요.

## 4. 팀원과 맞출 것 체크리스트

- [ ] A: PR①(`src/exceptions.py`) 머지 시점 공유받기 — C ①이 바로 뒤따라요
- [ ] D·E: PR① 머지 후 공지 — 생성자 키워드 이름, `room.teams`가 **dict**(`{TeamSide: Team}`)라는 점, `TeamSide`는 `rooms.domain.room`에서도 import 가능
- [ ] D: `RoomRepository` 메서드 이름·반환(`find_by_id -> Room | None`, `find_current_participation -> Participation | None`, `save -> Room`)과 `LeaveResult`·`GameStartResult` 필드 확인. 가능하면 D도 껍데기를 먼저 올려 달라고 요청
- [ ] D: `save`가 참가를 무엇으로 짝짓는지 확인 — blueprint·분담표 D는 (`user_id`, `join_order`), ADR-011 본문은 "(방, 회원)". C는 기존 참가의 `join_order`를 바꾸지 않으면 둘 다 맞아요
- [ ] D: 끝난 참가(`left_at` 있음)를 `room.participations`에 **남겨 둔 채** `save`에 넘긴다는 점(C는 지우지 않음, D가 로그로 옮김)
- [ ] E: 서비스 생성 `RoomApplicationService(db)`(라우터 `get_room_service`, CONV-04), 메서드 6개 이름·인자 순서(`room_id, user_id` 순)·반환 타입
- [ ] E: 화면 컨텍스트 이름 `cond`(`keyword`·`available_only`·`sort`·`page`), `notice`, `room_id`와 `/?notice=dissolved` 값
- [ ] A: 라우터 변수 이름 `rooms.presentation.pages.page_router` 전달(A ⑧)
- [ ] A: 시드가 쓰는 도메인 API(`Room.create`·`join`·`leave`·`start_game`, `current_participants`, `host_user_id`, `participations`) 완성 시점 공유(A ⑨)
- [ ] A: 템플릿 block 이름(`title`·`content`·`scripts`), `partials/pagination.html`의 `#pagination`, 공통 클래스(`card`, `muted`, `table-wrap`, `nowrap`, **`cell-title`**) — `cell-title`은 A 계획표 ⑦의 클래스 목록에 없으니 추가 요청
- [ ] B: `api.js` 함수 이름·반환 모양 — `getAccessToken()`, `apiRequest(method, url) → {ok, status, data}`, `errorMessage(result)`, `showNotice(message, kind)`, `formatTime(iso)`, `renderPagination(nav, page, size, total, makeHref)`

## 5. 자주 틀리는 점 모음

1. `Participation`에 `id`를 만듦 → D-025와 어긋나고 D의 변환이 깨져요.
2. `room.py`가 `TeamSide`를 다시 내보내지 않음 → D의 `read_models.py`·E의 `router.py` import 실패.
3. `Room.__init__`에서 팀원 다시 채우기를 빠뜨림 → DB에서 읽은 방의 팀 정원 검사가 항상 통과해요(RISK-13).
4. `change_team`에서 `add` 뒤에 `self.team(participation.team)`으로 원래 팀을 찾음 → 이미 바뀐 편이라 새 팀에서 빠져요.
5. 거부 순서를 바꿈(예: 삭제 검사를 나중에) → 같은 요청에 다른 문구가 나와 QA 기대값과 달라요(§2.3).
6. 도메인에서 `datetime.now()` 호출 → 금지 패턴 11, GATE-07. 시각은 서비스 `clock`에서 한 번.
7. 예외 문구를 비슷하게 바꿔 씀 → 화면 안내·테스트가 §1.2 문구를 그대로 기대해요.
8. `create_room`이 저장 전 `room`(id 없음)을 반환 → 라우터가 상세를 못 읽어요.
9. 서비스에서 commit을 두 번 하거나 레포지토리에서 commit → §8 트랜잭션 경계 위반.
10. `Team.members = []`를 클래스 기본값으로 둠 → 모든 팀이 같은 리스트를 공유해요(`field(default_factory=list)`).
11. `pages.py`에서 `Path(__file__).parent / "templates"` → `src/rooms/presentation/templates`를 찾아 템플릿이 없어요(`parents[2]`).
12. 기록·보관 화면에서 `innerHTML`로 제목을 넣음 → XSS(RISK-10). `textContent`만 써요.

## 6. 다른 파트와의 선후 관계

### 6.1 C가 먼저 받아야 하는 것

| 파트 | 파일 · 이름 | 기다리는 C 단계 | 기다리지 않는 우회 방법 |
|---|---|---|---|
| A | `src/exceptions.py` — `DomainRuleError`, `NotFoundError`, `GoneError`(`message` 속성) — A ④ / PR① | ① (예외 import) → 그래서 ②~⑤도 실행 확인이 막힘 | A PR①은 반나절 목표. 그 전에는 `04` §1.1 이름대로 로컬 브랜치에서 ①을 써 두고, A 머지 직후 `dev`를 받아 바로 PR |
| D | `src/rooms/infrastructure/repositories.py` — `RoomRepository(session)`, `find_by_id`, `find_current_participation`, `save` | ⑦ (import·머지) | `04` §9 시그니처로 코드를 먼저 써 두고 ⑥⑧⑨를 먼저 진행. D가 껍데기를 먼저 올리면 PR④를 앞당길 수 있어요 |
| D | `src/rooms/application/read_models.py` — `LeaveResult(room_deleted, new_host_user_id)`, `GameStartResult(room_id, dissolved_at)` | ⑦ | 위와 같음 |
| A | `templates/base.html`(block `title`·`content`·`scripts`, `api.js` 로드), `partials/pagination.html`(`#pagination`), `partials/notice.html`(`#notice`, `notice` 변수), `app.css` 공통 클래스 — A ⑦ / PR③ | ⑧⑨ (화면 확인) | 이름만 합의하면 작성 가능. 스켈레톤 `base.html`이 있어 `extends`는 오류 없이 렌더돼요. 모양 확인만 A ⑦ 뒤 |
| A | `main.py` `/static` 마운트(A ⑥)와 `page_router` 등록(A ⑧) | ⑥⑧⑨ (브라우저 확인) | 작성에는 영향 없음. 확인만 A ⑧ 뒤로 미뤄요 |
| B | `static/js/api.js` — `getAccessToken`, `apiRequest`, `errorMessage`, `showNotice`, `formatTime`, `renderPagination` | ⑧⑨ (동작 확인) | §4 이름·반환 모양을 B와 먼저 합의하고 작성. 동작은 B 머지 뒤 확인 |
| E | `templates/rooms/list.html`·`detail.html`(컨텍스트 `cond`·`notice`·`room_id` 사용) | ⑥ (확인) | 스켈레톤 파일이 이미 있어 렌더 오류는 없어요. 컨텍스트 이름만 E와 합의 |
| D + E | API-ROOM-10·11: D `RoomQueryService.list_history`·`get_archived_room` + E `router.py` `/api/me/room-history`, `/api/me/room-history/{room_id}` | ⑧⑨ 데이터 확인 → ⑩ | 화면 틀만 PR⑤로 먼저 올리고, 데이터 확인은 ⑩에서 |
| E | `router.py` API-ROOM-02·04~08 (서비스 호출) | ⑩ (Swagger 확인) | 그 전에는 ⑤ 완료 확인처럼 도메인만 셸에서 확인 |
| A | `seed.py` — A ⑨ | ⑩ (기록·보관 화면에 데이터) | Swagger로 방을 직접 만들고 나가서 기록을 만들어 확인 |

### 6.2 C가 넘겨줘야 하는 것

| 받는 파트 | 무엇 (C 단계) | 그 파트에서 기다리는 작업 | 언제까지 |
|---|---|---|---|
| D | 도메인 껍데기: `Room` 생성자 9개 인자·속성(`teams` dict, `participations`, `title.value`, `CAPACITY`, `host_user_id`, `last_join_order`, `created_at`, `deleted_at`, `delete_reason`), `Team(id, side)`, `Participation` 6필드·`is_current`, `RoomTitle`, `DeleteReason`, `TeamSide` (①) | `repositories.py`의 `RoomRepository._to_domain`·`save`, `models.py`(편 값), `read_models.py`(`TeamSide` import) | **1일차 오전(반나절)** — 분담표 §5-2 |
| D | 예외 `RoomNotFoundError`·`RoomDissolvedError` + `DeleteReason.GAME_STARTED`, `room.is_active` (①) | `queries.py`의 `get_room_detail` 404/410 분기, `get_archived_room` 404, `get_current_room` | 1일차 오전 |
| D | 동작하는 `leave`·`start_game`(끝난 참가에 `left_at`, 목록에 남김)·`create`·`join` (⑤) | `save`의 로그 이동(현재 참가 → `participation_logs`) 실행 확인 | D의 `save` 확인 전 — PR② 머지 |
| E | `TeamSide`(`rooms.domain.room`) (①) | `router.py` 팀 변경(`TeamSide(body.team)`), `schemas.py` | 1일차 오전 |
| E | `RoomApplicationService(db)` + 6개 메서드 (⑦) | `router.py`의 `get_room_service`와 API-ROOM-02·04·05·06·07·08 — import 대상이라 **E 라우터 PR은 C PR④ 뒤에 머지** | E 라우터 PR 전. 이름·인자·반환은 `04` §3으로 지금 확정돼 있어 E는 먼저 작성 가능 |
| E | 화면 컨텍스트 이름 `cond`·`notice`·`room_id`, `notice=dissolved` 처리 (⑥) | `list.html`·`detail.html` 템플릿, `rooms.js`의 해산 이동(`/?notice=dissolved`) | ⑥ PR 전 합의 |
| A | `rooms.presentation.pages.page_router` 이름 (⑥) | A ⑧ `main.py` v2 라우터 등록 | A ⑧ 전 (PR③ 머지) |
| A | 완성된 `Room.create`·`join`·`leave`·`start_game`, `current_participants`, `host_user_id`, `participations` (⑤) | A ⑨ `seed.py`(도메인 메서드로 방 8개, D2 재입장 예시) | A ⑨ 시작 전 — PR② 머지 |
| A | 화면 2개 템플릿 + 라우트 4개 (⑥⑧⑨) | A ⑩ 통합 점검 "화면 6개 토큰 없이 200" | A ⑩ 전 — PR③·PR⑤ 머지 |
