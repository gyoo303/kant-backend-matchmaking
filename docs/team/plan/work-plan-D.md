# D 파트 작업계획표 — 방 DB·조회

> 기준: `origin/dev`(b7fac74)의 `docs/work-assignment.md`(D-025·D-026 반영본, D ≈ 640), `docs/01-pm/`·`docs/02-arch/`, 참고 구현 `reference/agent-pipeline-blueprint`
> 교안: [백엔드 아키텍처 & API 설계 실습 모음](https://charmed-watch-60f.notion.site/API-405566040df880fbbe34c039dd0f281d) — 아래 표의 "교안"은 `장-강 / 문제 번호`로 적었어요
> 담당 파일(이 4개만 수정해요): `src/rooms/infrastructure/models.py`, `src/rooms/infrastructure/repositories.py`, `src/rooms/application/read_models.py`, `src/rooms/application/queries.py`

---

## 0. 시작 전에 확인할 것

| 확인 | 내용 |
|---|---|
| 최신 `dev` 받기 | 로컬 `dev`가 `origin/dev`(b7fac74)와 같은지 `git pull`로 확인해요. 스켈레톤의 D 파일 4개에는 만들 **이름만 주석**으로 있어요 |
| 내 파일만 수정 | 한 파일 = 한 주인. `seed.py`·`main.py`(A), `service.py`·도메인(C), `router.py`·`schemas.py`(E), `auth/infrastructure/models.py`(B)는 **import만** 해요 |
| 내 위치(계층) | `models.py`·`repositories.py`는 infrastructure, `read_models.py`·`queries.py`는 application이에요. infrastructure가 application의 `read_models`를 반환 타입으로 import하는 것은 허용된 예외예요(`05-structure-conventions.md` §2) |
| 기능 간 참조 | `rooms` → `auth`는 **`RoomQueryRepository`의 `UserModel`(닉네임 조회) 한 곳만** 허용돼요(ADR-001). `auth`는 `rooms`를 import하지 않아요 |
| 교안 수준 규칙 | `05-structure-conventions.md` §8(D-020). `mapped_column` 옵션·`relationship`·`select().where().options(selectinload()).order_by()`까지만 써요. 집계 서브쿼리·`ILIKE ESCAPE`·이름 붙인 제약·복합 인덱스·CHECK는 쓰지 않아요 |
| 시그니처 고정 | 이름·시그니처는 `03-db-schema.md` §5와 `04-interfaces-api.md` §2·§3이 정답이에요. 문서끼리 어긋난 곳은 §2 각 단계 "유의"에 적었어요. 바꿔야 하면 혼자 바꾸지 말고 팀에 먼저 말해요 |
| 도전 범위 금지 | `find_by_id_for_update`, `IntegrityError` → `AlreadyParticipatingError` 변환, CSV 스트리밍 조회, `list_cache`는 **요청 시에만**(TKT-DB-M6-01·TKT-BE-M6-01·02, D-018). 필수 범위에서 같은 회원 동시 참가는 500이 맞아요 |
| 개발 DB | 모델(PK·컬럼)을 바꾸면 `create_all`이 고쳐 주지 않아요. 개발 DB를 지우고 다시 만들어요(STK-04, STK-13) |
| 티켓 대응 | `models.py`·`repositories.py` = HANDOFF TKT-DB-M3-02, `queries.py` = TKT-BE-M3-03, `read_models.py` = TKT-BE-M3-01의 읽기 모델 부분이에요(파트 분담은 `work-assignment.md`가 기준) |

## 1. 전체 순서 한눈에 보기

```
[1일차 오전: 선행 — C·E가 import함]
  ① read_models.py (C의 TeamSide 머지 직후) → PR①

[1일차 오후: 선행 — A가 import함]
  ② models.py (A의 database.py 머지 후, B의 UserModel과 같이 확인) → PR②

[2일차: 우선순위 최고 — A 시드·C 서비스가 기다림]
  ③ RoomRepository 변환 + find_by_id·find_current_participation
  ④ RoomRepository.save (새 방·팀 2행·참가 짝짓기·로그 이동) → PR③ (머지 후 A·C에 공지)

[2~3일차: E 라우터가 기다림]
  ⑤ RoomQueryRepository.list_active_rooms·get_room_detail (B의 UserModel 필요)
  ⑥ RoomQueryRepository.list_history·get_archived_room → PR④
  ⑦ queries.py RoomQueryService 5개 (C의 예외 필요) → PR⑤ (머지 후 E에 공지)

[마지막]
  ⑧ 통합 점검 (GATE-02·05·08, 시드 60건, 404/410, 이력 정렬)
```

## 2. 단계별 계획

### ① `src/rooms/application/read_models.py` — 읽기 모델 12개 → PR①

| 항목 | 내용 |
|---|---|
| 할 일 | 모두 `@dataclass(frozen=True)`: `RoomListCondition(keyword, available_only, sort: Literal["newest","oldest"], page, size)`, `RoomSummary(id, title, current_count, capacity, is_full, created_at)`, `ParticipantView(user_id, nickname, team, is_host)`, `RoomDetail(id, title, capacity, current_count, is_full, host_user_id, participants, my_team, am_i_host, created_at)`, `CurrentRoom(room_id, title)`, `HistoryItem(room_id, room_title, joined_at, left_at, is_current, room_deleted)`, `MyRecord(joined_at, left_at)`, `ArchivedRoom(room_id, title, capacity, created_at, deleted_at, my_records)`, `RoomPage`·`HistoryPage(items, total, page, size)`, `LeaveResult(room_deleted, new_host_user_id)`, `GameStartResult(room_id, dissolved_at)` |
| 참고 | 교안 2-1 필수1(타입 힌트·`Literal`·중첩 구조), 2-2 필수1(응답 전용 모양을 따로 둠), §8 B등급(`@dataclass(frozen)`) / `04-interfaces-api.md` §3 끝 "읽기 모델" 문단·§5.2(필드 이름 = 응답 스키마 필드 이름), D-025, AC-13-5, blueprint `src/rooms/application/read_models.py` |
| 유의 | **필드 이름이 E의 `schemas.py`와 1:1**이에요(`model_validate`로 바로 바뀜). 이름을 바꾸면 E 응답이 깨져요. `HistoryItem`에 `participation_id`를 **넣지 않아요**(D-025, AC-13-5). `ParticipantView`에 입장 순서를 넣지 않아요(REQ-045). `team`·`my_team` 타입은 C의 `TeamSide`(원 위치 `rooms.domain.participation`, `room.py`가 다시 내보냄 — 04 §2.3). sqlalchemy·ORM을 import하지 않아요(GATE-08). 문서 불일치: `04` §3의 읽기 모델 나열에 `MyRecord`가 빠져 있지만 `ArchivedRoom.my_records`에 필요하고 스켈레톤에도 있어요 → 만들어요 |
| 완료 확인 | `uv run ruff check src`·`ruff format --check src` 오류 0, E와 필드 이름 대조 끝 |

### ② `src/rooms/infrastructure/models.py` — ORM 모델 4개 → PR②

| 항목 | 내용 |
|---|---|
| 할 일 | `RoomModel`(rooms: `id`, `title String(20)`, `capacity default=4`, `host_user_id FK users.id`, `last_join_order default=0`, `created_at`, `deleted_at`·`delete_reason String(20)` nullable) / `TeamModel`(teams: `id`, `room_id FK`, `side String(1)`) / `ParticipationModel`(participations: `room_id`+`user_id` **복합 PK**, `user_id unique=True`, `join_order`, `team_id FK teams.id`, `joined_at`) / `ParticipationLogModel`(participation_logs: `id` PK, `room_id`, `user_id`, `join_order`, `team_id`, `joined_at`, `left_at` 모두 NOT NULL) + `relationship` |
| 참고 | 교안 5-1 필수1(DB 연결·관계 매핑 모델), 5-2 필수1(비동기 엔진 기반 모델), 7-1 필수2(SQLAlchemy 2.0 모델) / **`03-db-schema.md` §2 ERD·§3.3~§3.6(컬럼 표가 정답)**, ADR-010, ADR-011, D-025 §5, STK-04·06·13, HANDOFF TKT-DB-M3-02, blueprint `src/rooms/infrastructure/models.py` |
| 유의 — 관계 | `RoomModel.participations = relationship(back_populates="room", cascade="all, delete-orphan")`(목록에서 `remove`하면 flush 때 행이 지워짐), `RoomModel.teams`(cascade 없음, 방이 삭제돼도 팀 행은 남음), `TeamModel.room`·`TeamModel.participations`, `ParticipationModel.room`·`.team`, `ParticipationLogModel.room`·`.team`은 **역방향 없이** `relationship()`만 |
| 유의 — 컬럼 | 시각은 모두 `DateTime(timezone=True)`(STK-06). `participations`에 `left_at`·자체 `id`를 두지 않아요(ADR-011). 퇴장 사유·결과 컬럼 없음(INV-09, GATE-07). `ADR-009` 결과 칸의 `uq_participations_room_join_order`·부분 유니크 인덱스는 옛 설계라 **만들지 않아요**(ADR-011이 대체) |
| 유의 — 선행 | `Base`는 A의 `database.py`에서 import해요. FK `"users.id"`는 문자열이라 **파일 작성·import는 B 없이 돼요**. 다만 `create_all`·flush 때 `users` 테이블이 메타데이터에 있어야 하므로 실제 테이블 생성 확인은 B의 `UserModel`이 올라온 뒤에 해요 |
| 완료 확인 | `PYTHONPATH=src uv run python -c "import auth.infrastructure.models, rooms.infrastructure.models; from database import Base; print(sorted(Base.metadata.tables))"` → 6개 테이블(DB 연결 없이 확인, `.env` 필요). A의 main v2 이후 `psql`에서 `\d participations`로 PK 2컬럼·`user_id` unique 확인 |

### ③ `RoomRepository` — 변환 + `find_by_id`·`find_current_participation`

| 항목 | 내용 |
|---|---|
| 할 일 | 생성자 `(session: AsyncSession)`. `_find_model(room_id)`: `select(RoomModel).where(...).options(selectinload(RoomModel.teams), selectinload(RoomModel.participations).selectinload(ParticipationModel.team))`. `_to_domain(model) -> Room`: `RoomTitle(model.title)`, `DeleteReason(...)`, `teams=[Team(id, TeamSide(side))]`, 현재 참가는 `join_order` 순으로 `_participation_to_domain`. `find_by_id(room_id) -> Room \| None`. `find_current_participation(user_id) -> Participation \| None`(`participations`에서 `user_id`로 1건, `.team` selectinload) |
| 참고 | 교안 7-1 필수2(레포지토리 패턴, ORM ↔ 도메인 변환), 5-2 필수2(AsyncSession 조회·하위 목록 로딩), 5-1 심화1(`joinedload`/`selectinload`, N+1) / `03-db-schema.md` §5 표 `RoomRepository` 행, `04-interfaces-api.md` §2.3~§2.5(생성자 시그니처), STK-02, ADR-010, blueprint `repositories.py`의 `RoomRepository` 앞부분 |
| 유의 | **ORM 객체를 레포지토리 밖으로 내보내지 않아요**(금지 패턴 3, GATE-08). 관계 속성은 반드시 `selectinload`로 미리 읽어요 — 안 하면 `MissingGreenlet`(STK-02). `Participation`에 `id`가 없어요(`room_id, user_id, join_order, team, joined_at` — `left_at`은 DB에 없으니 넘기지 않음). 팀원 목록은 `Room` 생성자가 현재 참가로 다시 채우니 `Team(id, side)`만 넘겨요(04 §2.3). `room.title`은 값 객체라 `RoomTitle(...)`로 감싸요. commit 금지(flush만) |
| 선행 | C: `Room.__init__`(9개 인자), `RoomTitle`, `DeleteReason`, `Team(id, side)`, `Participation`, `TeamSide` — 빈 껍데기라도 시그니처가 있으면 작성 가능 |

### ④ `RoomRepository.save` — 새 방·팀·참가 짝짓기·로그 이동 → PR③ (**A 시드·C 서비스가 기다림**)

| 항목 | 내용 |
|---|---|
| 할 일 | `save(room: Room) -> Room`: (1) `room.id is None`이면 `TeamModel` A·B 두 행과 함께 `RoomModel(participations=[], teams=…)`을 `add`, 아니면 `_find_model`. (2) 방 필드 복사(`title.value`, `Room.CAPACITY`, `host_user_id`, `last_join_order`, `created_at`, `deleted_at`, `delete_reason.value`). (3) 저장된 현재 참가를 **(`user_id`, `join_order`)** 로 짝지어: 참가 중 + 행 없음 → `ParticipationModel` append / 참가 중 + 행 있음 → `team`만 갱신 / 끝남(`left_at` 있음) → `ParticipationLogModel` `add` 후, 행이 있으면 `model.participations.remove(행)`. (4) `flush` 후 `_to_domain(model)` 반환 |
| 참고 | 교안 7-1 필수2(레포지토리 `save`), 7-1 필수3(commit은 응용 서비스), 5-1·5-2 필수2(`add`·`flush`), 5-1 필수1(`relationship`·`cascade`) / `03-db-schema.md` §3.4·§3.6·§5, `04-interfaces-api.md` §8·SEQ-05·08·09, ADR-011, STK-04, RISK-13·14, blueprint `RoomRepository.save` |
| 유의 — 팀 연결 | 참가·로그의 팀은 **같은 방의 `TeamModel` 객체**로 연결해요(`team=team_models[participation.team]`, `team_id` 숫자를 직접 넣지 않음 — 새 방은 아직 id가 없음, RISK-13). 로그도 `room=model`로 연결해요 |
| 유의 — 순서 | 로그를 먼저 `session.add`하고 그다음 `remove`해요(STK-04). 한 요청 = 한 트랜잭션이라 이력이 사라지거나 두 번 남지 않아요(ADR-011) |
| 유의 — 문서 불일치 ① | 짝짓기 기준: `03-db-schema.md` §5·`04` §2.3 끝 문단·ADR-011은 "`user_id`로(방, 회원으로) 짝지음"인데, `work-assignment.md` §3 D와 blueprint는 **(`user_id`, `join_order`)** 예요. 시드 D2는 seed12의 끝난 기록 2건(입장 순서 1·3)이 **한 번의 `save`** 에 들어오므로 `user_id`만으로 짝지으면 덮어써져요 → (`user_id`, `join_order`)로 구현하고 팀에 공유해요 |
| 유의 — 문서 불일치 ② | `03-db-schema.md` §5는 끝난 참가를 "행이 있고 `left_at` 있음"만 적었어요. 하지만 A의 시드는 삭제 방 3개를 **처음 저장하기 전에** 해산·퇴장까지 끝내요(blueprint `seed.py`). 즉 "새 방 + 행 없음 + 끝남"도 와요 → 행이 없어도 로그는 INSERT해야 해요 |
| 유의 — 하지 말 것 | `IntegrityError`를 잡아 바꾸지 않아요(필수 범위 500, D-018 — 변환은 도전 A). commit하지 않아요. 로그를 UPDATE·DELETE하지 않아요(INV-10) |
| 완료 확인 | A의 시드를 돌려(A ⑨ 또는 임시로 같은 흐름) 로그가 `users=14 rooms=8 teams=16 participations=11 participation_logs=11 total=60`, DB에서 seed12의 D2 로그 2행(입장 순서 1·3), 모든 `participations.team_id`·`participation_logs.team_id`가 같은 방 팀을 가리킴 |

### ⑤ `RoomQueryRepository.list_active_rooms`·`get_room_detail`

| 항목 | 내용 |
|---|---|
| 할 일 | `list_active_rooms(cond) -> tuple[list[RoomSummary], int]`: `select(RoomModel).where(RoomModel.deleted_at.is_(None)).options(selectinload(RoomModel.participations)).order_by(...)`(newest = `created_at desc, id desc`, oldest = `created_at asc, id asc`) → 파이썬에서 현재 인원 `len(participations)`, `keyword.lower() in title.lower()`, `available_only`(인원 < 정원) → `total = len`, `items[(page-1)*size : page*size]`. `get_room_detail(room_id) -> RoomDetail \| None`: 활성 방만, 참가자는 (팀, 입장 순서) 정렬, 닉네임은 `await session.get(UserModel, user_id)`, `my_team=None`·`am_i_host=False`로 두고 서비스가 채움 |
| 참고 | 교안 3-1 필수1(Query 검증·페이지네이션), 1-2 심화1(검색·정렬 GET), 5-2 필수2(하위 목록 로딩) / `03-db-schema.md` §5 아래 "조회 방식"·"상세의 닉네임" 문단, `04-interfaces-api.md` SEQ-10·§5.2(`RoomDetailResponse`: A팀 먼저, 팀 안 입장 순서), STK-02·05, AC-07-1·AC-12-1~8, ADR-001, blueprint `RoomQueryRepository` 앞부분 |
| 유의 | 집계 서브쿼리·`ILIKE`·DB `offset/limit` 대신 **파이썬 필터·슬라이싱**(D-020, STK-05 — `%`·`_`도 일반 글자, AC-12-4). keyword strip·빈 문자열 → None은 **E의 라우터**가 해요(SEQ-10). 현재 인원에 `left_at` 거르기 없음(컬럼 자체가 없음). 페이지 범위를 넘어도 빈 목록 + total 유지(AC-12-7). 문서 불일치: ADR-001은 닉네임을 "`UserModel`을 조인"이라 적었지만 `03-db-schema.md` §5·STK-02는 **`session.get`** — 뒤쪽(최신)을 따라요 |
| 선행 | B: `auth.infrastructure.models.UserModel`(`nickname`) |

### ⑥ `RoomQueryRepository.list_history`·`get_archived_room` → PR④

| 항목 | 내용 |
|---|---|
| 할 일 | `list_history(user_id, page, size) -> tuple[list[HistoryItem], int]`: 현재 참가(`participations`, 0~1건) + 로그(`participation_logs`, `joined_at desc, id desc`)를 각각 `.room` selectinload로 읽어 `HistoryItem`으로 바꾼 뒤 합쳐 `joined_at` 최신순 정렬(파이썬 정렬은 안정 정렬이라 로그끼리 id 순서 유지) → 슬라이싱. `get_archived_room(room_id, user_id) -> ArchivedRoom \| None`: 방이 없거나 **활성**이면 None, 로그만 `joined_at, id` 순으로 읽어 `MyRecord` 목록, 비면 None |
| 참고 | 교안 3-1 필수1(페이지 자르기), 1-2 심화1(정렬), 5-2 필수2 / `03-db-schema.md` §5 표 `RoomQueryRepository` 행, `04-interfaces-api.md` §5.2 `HistoryListResponse`·`ArchivedRoomResponse`, D-007·D-009, INV-15, AC-13-1~5·AC-14-1·2, ADR-011, blueprint `list_history`·`get_archived_room`·`_history_item` |
| 유의 | 본인 기록만(`user_id` 조건, INV-15·AC-13-2). 현재 참가 항목은 `left_at=None`·`is_current=True`, `room_deleted`는 `room.deleted_at is not None`. 같은 방 재입장은 **로그 행이 따로**라 항목 2건(AC-13-3). 보관 정보는 다른 회원 정보를 넣지 않아요(D-009, AC-14-1). `ParticipationModel.room`·`ParticipationLogModel.room`은 selectinload 필수(STK-02) |

### ⑦ `src/rooms/application/queries.py` — `RoomQueryService` → PR⑤ (**E 라우터가 기다림**)

| 항목 | 내용 |
|---|---|
| 할 일 | 생성자 `(db: AsyncSession)` 안에서 `RoomQueryRepository(db)`·`RoomRepository(db)` 생성. `list_rooms(cond) -> RoomPage`, `get_room_detail(room_id, viewer_id) -> RoomDetail`(None이면: `find_by_id`로 다시 보고 `delete_reason == GAME_STARTED` → `RoomDissolvedError`(410), 그 밖 → `RoomNotFoundError`(404); 있으면 `dataclasses.replace`로 `my_team`·`am_i_host` 채움), `get_current_room(user_id) -> CurrentRoom \| None`, `list_history(user_id, page, size) -> HistoryPage`, `get_archived_room(room_id, user_id) -> ArchivedRoom`(None → `RoomNotFoundError`) |
| 참고 | 교안 7-1 필수3(응용 서비스), 3-1 심화1(도메인 예외 → 전역 처리기), 3-1 필수2(응답 코드 구분) / `04-interfaces-api.md` §3 `RoomQueryService` 행·§6(404/410)·§8(조회는 commit 없음)·SEQ-10, D-016, AC-07-2~5·AC-14-2, §8 B등급(`dataclasses.replace`), HANDOFF TKT-BE-M3-03, blueprint `src/rooms/application/queries.py` |
| 유의 | **commit 없음**. `select()`·`session.execute()`를 여기서 쓰지 않아요(GATE-07). ORM 모델·`infrastructure.models`를 import하지 않아요(GATE-08 — 레포지토리만 import). `HTTPException`을 쓰지 않고 C의 도메인 예외만 던져요(CONV-05, `Cache-Control: no-store`는 A의 핸들러 담당). EMPTY 삭제 방 상세는 404예요(410 아님) |
| 유의 — 문서 불일치 | `04` §3은 생성자를 `(db, list_cache=None)`로 적었지만 `list_cache`는 도전 C(TKT-BE-M6-02, 요청 시)이고 blueprint는 `(db)`예요. HANDOFF는 필수 티켓에 도전 범위를 미리 넣지 말라고 해요 → `(db)`로 만들고, E의 팩토리 `RoomQueryService(db)`는 어느 쪽이든 동작한다고 E와 확인해요 |
| 선행 | C: `rooms.domain.exceptions`의 `RoomNotFoundError`·`RoomDissolvedError`, `DeleteReason`, `Room.is_active`, `room.title.value` |

### ⑧ 통합 점검 (D 담당 범위)

| 확인 | 방법 |
|---|---|
| 계층 | GATE-02 세 명령, GATE-07의 `session\.execute\|select\(` 명령, GATE-08 명령 출력 0줄(`06-quality-gates.md` §1) |
| 린트 | GATE-05: `uv run ruff check src tests`, `uv run ruff format --check src tests` |
| 스키마 | `psql`에서 6개 테이블, `participations` PK(`room_id`,`user_id`)·`user_id` unique, `left_at` 없음 — `03-db-schema.md` §3과 같음(TKT-DB-M3-02 완료 조건) |
| 시드 | 첫 기동 시드 로그 60건, 재기동 시 `seed skipped`(A와 함께, NFR-06) |
| API | E 라우터 연결 뒤 curl/Swagger: 목록 검색 `" fun "`·`"%"`(AC-12-3·4), 오래된순(AC-12-5), 상세 R1·해산 D1 → 410·D2 → 404(AC-07-4·5), seed12 이력에 D2 2건(AC-13-3), `participation_id` 없음(AC-13-5) |

## 3. 추천 브랜치·PR 단위

| PR | 브랜치 | 담는 것 |
|---|---|---|
| ① | `feat/rooms-read-models` | ① |
| ② | `feat/rooms-orm-models` | ② |
| ③ | `feat/rooms-repository-save` | ③④ |
| ④ | `feat/rooms-query-repository` | ⑤⑥ |
| ⑤ | `feat/rooms-query-service` | ⑦ |

- 한 PR에 한 가지 작업만 담아요(README 브랜치 규칙, CONV-13). ①②는 기다리는 선행(C의 `TeamSide`, A의 `Base`)이 달라서 따로 올려요 — 먼저 풀리는 쪽부터 머지해요.
- `repositories.py` 한 파일을 PR③·④가 나눠 써요. PR③ 머지 뒤 PR④ 브랜치를 새로 따서 충돌을 피해요.
- PR 전에 `uv run ruff check src tests`, `uv run ruff format --check src tests`(GATE-05)를 돌려요.

## 4. 팀원과 맞출 것 체크리스트

- [ ] C: `TeamSide`(+ `rooms/domain/exceptions.py`)를 가장 먼저 올려 달라고 요청 — ①이 import해요
- [ ] C: `Room.__init__`·`Team(id, side)`·`Participation(room_id, user_id, join_order, team, joined_at, left_at=None)`·`RoomTitle`·`DeleteReason` 시그니처가 `04` §2.3~2.5와 같은지 확인
- [ ] C: `save`의 짝짓기 기준이 (`user_id`, `join_order`)이고, "새 방 + 끝난 참가"도 로그로 들어간다는 점 공유(§2 ④ 유의)
- [ ] C: `service.py`가 쓰는 `LeaveResult`·`GameStartResult` 필드 이름 확인(PR① 머지 후 공지)
- [ ] A: `database.Base` 머지 시점 공유받기 / PR② 머지 후 `main.py` v2에 `import rooms.infrastructure.models  # noqa: F401` 요청
- [ ] A: PR③(`save`) 머지 후 시드 작업 시작 가능하다고 공지, 시드 결과 60건을 함께 확인
- [ ] B: `UserModel` 클래스 이름·모듈 경로(`auth.infrastructure.models.UserModel`)·`nickname` 필드 확인
- [ ] E: 읽기 모델 필드 이름 = 응답 스키마 필드 이름(§5.2), `RoomListCondition` 생성은 E 라우터가 함(keyword strip 포함)
- [ ] E: `RoomQueryService(db)` 생성자, 5개 메서드 이름·반환 타입 공유(PR⑤ 머지 후 공지)
- [ ] 전체: 모델 변경 뒤 개발 DB 재생성 안내(STK-13)

## 5. 자주 틀리는 점 모음

1. 관계 속성을 `selectinload` 없이 읽음 → `MissingGreenlet`(STK-02).
2. `save`에서 참가를 `user_id`만으로 짝지음 → 재입장 기록이 덮여 시드 D2 로그가 1건만 남아요.
3. 행이 없는 끝난 참가(새 방에서 바로 해산·퇴장)를 건너뜀 → 시드 삭제 방 로그 11건이 비어요.
4. `team_id`에 숫자를 직접 넣음 → 새 방은 팀 id가 아직 없고, 다른 방 팀을 가리킬 위험(RISK-13). `team=` 객체로 연결해요.
5. `remove`를 먼저 하고 로그 `add`를 나중에 함 / 로그를 UPDATE함 → 이력 손실·INV-10 위반(STK-04).
6. 레포지토리에서 commit함 → 서비스 commit과 겹치고 한 트랜잭션이 깨져요(§8).
7. ORM 객체를 서비스·라우터로 돌려줌, `queries.py`에서 `select()` 사용 → GATE-07·08 실패.
8. `participations`에 `left_at`·`id`를 남김, 또는 모델을 바꾸고 기존 DB를 그대로 씀 → PK·컬럼이 안 바뀌어요(STK-13).
9. 목록 검색을 `ILIKE`·`offset/limit`로 씀 → 교안 수준 밖(D-020), `%` 검색이 달라져요(AC-12-4).
10. 상세에서 EMPTY 삭제 방도 410으로 보냄 → 404여야 해요(D-016, AC-07-5).
11. `HistoryItem`에 `participation_id`를 남김 → D-025·AC-13-5 위반.
12. 시각을 naive로 비교·저장 → aware UTC만(STK-06).

## 6. 다른 파트와의 선후 관계

### 6.1 D가 먼저 받아야 하는 것

| 파트 | 파일·이름 | 기다리는 D 단계 | 기다리지 않는 우회 방법 |
|---|---|---|---|
| A | `src/database.py`의 `Base` (A ③, PR①) | ② `models.py` (import 시점) | 시그니처가 확정돼 있어(`class Base(DeclarativeBase)`) 코드는 먼저 써 두고, A PR① 머지 후 import 확인·PR 올리기 |
| A | `src/config.py`·`database.py`(A ②③) — 세션·`.env` | ②의 import 확인, ③~⑦ 실제 DB 동작 확인 | 코드 작성은 문서 시그니처로 진행. 실행 확인만 A PR① 뒤로 |
| A | `src/exceptions.py`(A ④) — C의 도메인 예외 부모 | ①⑦(간접: C의 `participation.py`·`exceptions.py`가 import) | A PR①이 반나절 목표라 대기 짧음 |
| A | `main.py` v2의 `create_all`(A ⑧), `seed.py`(A ⑨) | ④·⑧의 실제 DB 확인(시드 60건) | ②의 메타데이터 확인 명령으로 테이블 정의 먼저 검증. `save`는 blueprint `seed.py`와 같은 흐름의 임시 스크립트로 확인(커밋하지 않음) |
| B | `auth.infrastructure.models.UserModel`(`users` 테이블, `nickname`) | ② 테이블 생성 확인(FK `users.id`), ⑤ `get_room_detail` 닉네임 | ② 코드는 문자열 FK라 먼저 작성 가능. ⑤는 `list_active_rooms`를 먼저 하고 `get_room_detail`을 뒤로 |
| C | `rooms.domain.participation.TeamSide` (+ 그 파일이 import하는 `rooms.domain.exceptions`) | ① `read_models.py` | `work-assignment.md` §5-2 "C가 빈 껍데기 먼저"에 `TeamSide`를 꼭 넣어 달라고 요청. 늦어지면 ① 코드는 써 두고 import만 머지 직전에 확인 |
| C | `Room.__init__`·`RoomTitle`·`DeleteReason`·`Team`·`Participation`(시그니처 + `is_current`) | ③ 변환·조회, ④ `save` | 빈 껍데기(생성자·속성만)로 ③④ 코드 작성 가능. **동작 확인**(시드 60건)은 C의 `create`·`join`·`leave`·`start_game` 완성 뒤 |
| C | `RoomNotFoundError`·`RoomDissolvedError`, `Room.is_active` | ⑦ `queries.py` | 예외는 클래스 이름만 있으면 됨 — C의 껍데기에 포함 요청 |

### 6.2 D가 넘겨줘야 하는 것

| 받는 파트 | D가 넘기는 것 (D 단계) | 그 파트의 어느 작업이 기다리는지 | 언제까지 |
|---|---|---|---|
| C | `LeaveResult`·`GameStartResult` (① PR①) | `service.py`의 `leave_room`·`start_game` 반환 | 1일차 오전 — C가 `service.py`를 시작하기 전 |
| E | `RoomListCondition`과 모든 읽기 모델 필드 이름 (① PR①) | `schemas.py`(응답 스키마 필드), `router.py`의 `list_rooms`(조건 생성) | 1일차 — E가 스키마를 쓰기 전 |
| A | `rooms.infrastructure.models` 모듈 (② PR②) | `main.py` v2의 모델 import·`create_all` (A ⑧) | 1일차 오후~2일차 오전 |
| C | `RoomRepository.find_by_id`·`find_current_participation`·`save` (③④ PR③) | `service.py` 6개 흐름(SEQ-05~09)의 실제 실행 | 2일차 — **C의 `service.py`는 `work-assignment.md` §4에 D 의존이 빠져 있으니 미리 알림** |
| A | `RoomRepository.save`(끝난 참가 → 로그 이동, 새 방 + 끝난 참가 포함) (④ PR③) | `seed.py` 전체와 lifespan 시드 연결 (A ⑨, PR⑤) | 2일차 — A ⑨가 가장 마지막 단계라 D가 늦으면 A 마무리가 밀려요 |
| E | `RoomQueryService` 5개 메서드 (⑦ PR⑤, ⑤⑥ 포함) | `router.py` API-ROOM-01·03·09·10·11 조회 + 변경 API(02·04~06)의 상세 응답(`get_room_detail`로 응답, SEQ-05) | 3일차 — E가 라우터를 붙여 실행하기 전 |
| E·C(화면) | 이력·보관 정보 조회 (⑥⑦) | C의 `history.html`·`archived.html`, E의 `rooms.js`가 부르는 API-ROOM-10·11 (E 라우터 경유) | E 라우터와 같은 시점 |

- A는 `work-plan-A.md` 번호(③ database, ⑧ main v2, ⑨ seed)를 썼고, B·C·E는 파일·이름으로 적었어요. 파트별 단계 번호로 맞춘 전체 그림은 `team-work-plan.md`와 `team-dependency-diagram.html`을 보세요.
- 정리하면 D의 임계 경로는 **C의 `TeamSide`·도메인 껍데기 → D ①③④ → A ⑨ 시드**, 그리고 **D ⑤⑥⑦ → E 라우터**예요.
