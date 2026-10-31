# E 파트 작업계획표 — 방 API·메인/상세 화면

> 기준: `origin/dev`의 `docs/work-assignment.md`(D-026 반영본, E ≈ 695), `docs/01-pm/`·`docs/02-arch/`, 참고 구현 `reference/agent-pipeline-blueprint`
> 교안: [백엔드 아키텍처 & API 설계 실습 모음](https://charmed-watch-60f.notion.site/API-405566040df880fbbe34c039dd0f281d) — 아래 표의 "교안"은 `장-강 / 문제 번호`로 적었어요
> 담당 파일(5개): `src/rooms/presentation/router.py`, `src/rooms/presentation/schemas.py`, `src/templates/rooms/list.html`, `src/templates/rooms/detail.html`, `src/static/js/rooms.js`

---

## 0. 시작 전에 확인할 것

| 확인 | 내용 |
|---|---|
| 최신 `dev` 받기 | `git pull` 후 `git log -1`이 `origin/dev`와 같은지 확인해요(작성 시점 `b7fac74`). D-026(폴링 제거)·D-025(`participation_id` 제거)가 반영된 판이에요 |
| 실제 파일 위치 | 분담표 §2에는 `templates/rooms/…`, `static/js/rooms.js`로 적혀 있지만 실제 경로는 **`src/templates/rooms/…`, `src/static/js/rooms.js`**예요 |
| 내 파일만 수정 | 한 파일 = 한 주인. `main.py`(A), `dependencies.py`·`api.js`(B), `pages.py`·`service.py`(C), `queries.py`·`read_models.py`(D)는 import·호출만 해요. 라우터 등록은 A에게 변수 이름만 알려 줘요 |
| 시그니처 고정 | 경로·스키마·필드 이름은 `docs/02-arch/04-interfaces-api.md` §4.2·§5.2가 정답이에요. 화면 JS도 **같은 snake_case 이름**을 써요(별칭 없음) |
| 교안 수준 규칙 | `05-structure-conventions.md` §8(D-020). JS는 교안에 없으므로 `fetch`(= B의 `apiRequest`)·`localStorage`·DOM 조작만, 라이브러리·번들러 없음. **자동 조회(`setInterval`·반복 `setTimeout`) 금지**(D-026, ADR-012) |
| 혼자 먼저 할 수 있는 것 | `schemas.py`는 pydantic만 써서 아무도 기다리지 않아요. 템플릿·`rooms.js`도 이름만 합의하면 쓸 수 있어요. 실제 실행 확인(⑦⑧)만 다른 파트를 기다려요 (§6) |

## 1. 전체 순서 한눈에 보기

```
[1일차: 혼자 — 아무도 기다리지 않음]
  ① schemas.py (요청 3 + 응답 11)
  ② router.py 작성 (API 11개) ─┐
                                 └ A PR①(get_db) + B get_current_user_id 이름 + C·D 껍데기가 머지되면
                                   import 확인 → PR①(schemas + router) → A에게 `router` 알림(A ⑧)

[껍데기를 기다리는 동안·그 뒤: 이름 합의만으로 진행]
  ③ list.html → ④ rooms.js 공통 + 목록(SCR-03) → PR② (초안으로 올려 두기)
  ⑤ detail.html → ⑥ rooms.js 상세(SCR-04)      → PR③ (초안으로 올려 두기)

[C service·D queries/repositories 완성 + A ⑥⑧ 뒤]
  ⑦ API 연결 확인 (Swagger·curl, AC-01~07·12~14 응답 모양)

[A ⑦(base·partials·css)·B api.js·로그인·C pages.py 뒤 (+A ⑨ 시드면 편함)]
  ⑧ 화면 연결 확인 (AC-15·16 수동 점검, NFR-08) → PR②·③ 머지
```

## 2. 단계별 계획

### ① `src/rooms/presentation/schemas.py` — 요청·응답 스키마

| 항목 | 내용 |
|---|---|
| 할 일 | 공통 부모 `_Schema(BaseModel)` + `model_config = ConfigDict(from_attributes=True)`, `TeamValue = Literal["A", "B"]`. 요청 3개: `RoomCreateRequest`·`RoomRenameRequest`(`title: str`, `max_length=100`), `TeamChangeRequest`(`team: TeamValue`). 응답 11개: `RoomSummaryResponse`, `RoomListResponse`, `ParticipantResponse`, `RoomDetailResponse`, `LeaveResponse`, `GameStartResponse`, `CurrentRoomResponse`, `HistoryItemResponse`, `HistoryListResponse`, `MyRecordResponse`, `ArchivedRoomResponse`. 모든 필드에 `Field(..., description="…")` |
| 참고 | 교안 2-1 필수1(중첩 구조 검증), 2-2 필수1(응답 전용 스키마 `response_model`), 7-1 심화1(Pydantic 스키마·표현 계층) / `04-interfaces-api.md` §5(머리말)·§5.2, D-025, AC-01-4·AC-04-4·AC-13-5, blueprint `src/rooms/presentation/schemas.py` |
| 유의 — 필드 | 필드 이름·순서는 §5.2 표 그대로. **`HistoryItemResponse`에 `participation_id` 없음**(D-025, AC-13-5: `room_id`·`room_title`·`joined_at`·`left_at`·`is_current`·`room_deleted`만). `ParticipantResponse`에 입장 순서 없음(REQ-045). null이 될 수 있는 필드(`my_team`, `new_host_user_id`, `left_at`, `CurrentRoomResponse` 두 필드)도 `Field(...)`로 **필수**로 둬서 응답에 `null`이 그대로 나오게 해요 |
| 유의 — 검증 | 제목은 `max_length=100`만 둬요. `min_length`·공백 제거 validator를 넣으면 1~20자 규칙이 422로 바뀌어 도메인 문구(400 "방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다")가 안 나와요(§5.1 아래 문단과 같은 원칙). `extra="forbid"` 금지 — 정원 10을 보내도 무시하고 200이어야 해요(AC-01-4). 팀 `"C"`는 `Literal`이 422로 막아요(AC-04-4) |
| 유의 — 읽기 모델과 맞추기 | 응답은 D의 읽기 모델(frozen dataclass)에서 `model_validate`해요. 필드 이름이 §3 끝 문단대로 §5와 같아야 해요 — D와 이름을 한 번 맞춰요. 읽기 모델의 `team`은 C의 `TeamSide`(StrEnum)인데 `Literal["A","B"]`로 그대로 통과해요 |
| 완료 확인 | `PYTHONPATH=src uv run python -c "from rooms.presentation.schemas import *"` 오류 0. `TeamChangeRequest(team="C")` → `ValidationError`, `RoomCreateRequest.model_validate({"title": "a", "capacity": 10})` → 통과. `uv run ruff check src/rooms/presentation` 오류 0 |

### ② `src/rooms/presentation/router.py` — rooms API 11개 → PR①

| 항목 | 내용 |
|---|---|
| 할 일 | `router = APIRouter(prefix="/api")`, 팩토리 `get_room_service(db=Depends(get_db)) -> RoomApplicationService`·`get_room_query_service(db=Depends(get_db)) -> RoomQueryService`, 엔드포인트 11개(API-ROOM-01~11), 상수 `DISSOLVED_MESSAGE = "게임이 시작되어 방이 해산되었습니다"` |
| 참고 | 교안 4-1 필수1(`APIRouter` 기능별 분리), 3-1 필수1(`Query` 검증·페이지네이션), 4-1 필수2·심화1(공통 의존성·라우터 `Depends`), 6-1 심화1(권한 판별 의존성), 1-2 필수2·심화1(POST·GET·수정·검색 정렬), 7-1 심화1(표현 계층) / `04-interfaces-api.md` §3·§4.2·§4.3·§6·SEQ-05~10, CONV-03·04·05, TKT-BE-M3-04, blueprint `src/rooms/presentation/router.py` |
| 유의 — 경로·이름 | 01 `GET /rooms`(`list_rooms`), 02 `POST /rooms`(`create_room`), 03 `GET /rooms/{room_id}`(`get_room`), 04 `PATCH /rooms/{room_id}`(`rename_room`), 05 `POST /rooms/{room_id}/participants`(`join_room`), 06 `PATCH /rooms/{room_id}/participants/me`(`change_team`), 07 `DELETE /rooms/{room_id}/participants/me`(`leave_room`), 08 `POST /rooms/{room_id}/start`(`start_game`), 09 `GET /me/room`, 10 `GET /me/room-history`, 11 `GET /me/room-history/{room_id}`. `summary`는 §4.2 문구 그대로(11번은 "삭제된 방 보관 정보"), 모두 `response_model` 지정 |
| 유의 — tags | 01~08은 `tags=["rooms"]`, 09~11은 `tags=["me"]`를 **엔드포인트마다** 붙여요. CONV-03처럼 `APIRouter(..., tags=["rooms"])`로 두면 `/me/*`가 두 태그에 모두 보여요(문서 불일치, §5 참고) |
| 유의 — 01 목록 쿼리 | `keyword: str \| None = Query(None, max_length=50)`, `available_only: bool = False`, `sort: Literal["newest","oldest"] = "newest"`, `page: int = Query(1, ge=1)`, `size: int = Query(10, ge=1, le=50)` → 범위 밖은 422(AC-12-6). keyword는 `strip()` 후 빈 문자열이면 `None`으로 바꿔 `RoomListCondition(...)`에 담아요(SEQ-10, AC-12-3). 목록도 로그인 필요라 `_: int = Depends(get_current_user_id)`를 붙여요(§4.3) |
| 유의 — 변경 응답 | 02·04·05·06은 서비스 호출 뒤 `queries.get_room_detail(room_id, user_id)`로 `RoomDetailResponse`를 만들어요(SEQ-05~07). 02는 서비스가 돌려준 `room.id`를 써요. 06은 `TeamSide(body.team)`으로 바꿔 넘겨요. 07은 `LeaveResponse.model_validate(LeaveResult)`, 08은 `GameStartResponse(room_id=…, dissolved_at=…, message=DISSOLVED_MESSAGE)`. 09는 `None`이면 `CurrentRoomResponse(room_id=None, title=None)` |
| 유의 — 금지 | 라우터에서 `try/except`로 HTTP 변환 금지(CONV-05, 전역 핸들러가 함). 방장·참가자·정원 판단 if문 금지(금지 패턴 4, 도메인이 400을 냄). `select()`·`session.execute`·ORM 모델 import 금지(GATE-07·08). 서비스·조회 객체는 요청마다 팩토리로 새로 만들어요(CONV-04) |
| 유의 — 범위 | API-ROOM-12(CSV, 도전 B)는 사용자 요청 시에만 추가해요. 추가한다면 `/me/room-history.csv`를 `{room_id}`보다 **먼저** 등록해요(§4.2) |
| 유의 — 문서 불일치 | (1) `04-interfaces-api.md` §3은 생성자를 `RoomApplicationService(db, clock, list_cache=None)`로 적어 `clock`이 필수처럼 보이지만, CONV-04 팩토리와 blueprint는 `RoomApplicationService(db)`만 넘겨요(blueprint는 `clock` 기본값 `_utc_now`) → C에게 기본값을 확인받아요. `RoomQueryService`도 §3은 `(db, list_cache=None)`, blueprint는 `(db)` — `db`만 넘기면 둘 다 맞아요. (2) HANDOFF TKT-BE-M3-04는 산출물에 `dependencies.py`(임시 `X-Debug-User-Id`)를 넣었지만, 5인 분담에서 이 파일은 B 몫이에요 — E는 고치지 않아요. (3) 스켈레톤 주석의 11번 이름은 "보관 정보"지만 summary는 §4.2의 "삭제된 방 보관 정보"를 따라요 |
| 선행 | import만 되면 PR을 올릴 수 있어요: A `database.get_db`(A ③), B `auth.presentation.dependencies.get_current_user_id`, C `rooms.application.service.RoomApplicationService`·`rooms.domain.room.TeamSide`, D `rooms.application.queries.RoomQueryService`·`rooms.application.read_models.RoomListCondition` — 각자 **이름·시그니처만 있는 껍데기**면 충분해요(분담표 §5) |
| 완료 확인 | `uv run ruff check src tests`·`uv run ruff format --check src tests` 오류 0. GATE-07 세 번째 명령(`session\.execute\|select\(` in presentation)·GATE-08 출력 0줄. A ⑧ 등록 뒤 `/docs`에 rooms 8개 + me 3개 = **11개**, 응답 스키마에 입장 순서·해시·`participation_id` 없음 |

### ③ `src/templates/rooms/list.html` — SCR-03 공개 방 목록(메인) 틀

| 항목 | 내용 |
|---|---|
| 할 일 | `{% extends "base.html" %}`, `title`·`content`·`scripts` 블록. [새로고침] 버튼, 현재 참가 방 링크(숨김), 방 만들기 폼(제목 1칸 + "2vs2 · 4명 고정"), 검색·빈자리 필터·정렬 GET 폼, 전체 건수·빈 목록 문구·표(`tbody`는 JS가 채움), `{% include "partials/pagination.html" %}`, 마지막에 `rooms.js` + `DOMContentLoaded`에서 `initRoomListPage` 호출 |
| 참고 | 교안 3-2 필수1(레이아웃 분리·`{% extends %}`·`{% include %}`), 3-2 필수2(Form GET 화면), 3-2 심화1(조건부 속성 — `checked`·`selected`) / `07-screens.md` §2·§3 SCR-03, `04-interfaces-api.md` §7 PAGE-03, AC-15-1~4, CONV-12, blueprint `src/templates/rooms/list.html` |
| 유의 — DOM ID (rooms.js와 짝) | `refresh-button`(§7에서 이름 고정), `current-room`·`current-room-link`, `create-form`·`create-room-title`·`create-button`, 검색 폼 `keyword`·`available_only`(`value="true"`)·`sort`(`newest`/`oldest`), `room-list`(`data-keyword`·`data-available-only`·`data-sort`·`data-page`), `room-total`, `room-empty`("조건에 맞는 방이 없습니다. 새 방을 만들어 보세요"), `room-rows` |
| 유의 — C와 합의 | 서버 컨텍스트는 C의 `pages.py`가 넘기는 **`cond`(`keyword`·`available_only`·`sort`·`page`)와 `notice`**뿐이에요(PAGE-03). 검색 폼은 `method="get" action="/"`이고 `page` 칸을 두지 않아 조건을 바꾸면 1페이지로 가요(AC-15-4). `notice`(해산 안내)는 A의 `base.html`이 `partials/notice.html`로 이미 보여 주므로 list.html에서 다시 그리지 않아요 |
| 유의 — A와 합의 | 블록 이름 `title`·`content`·`scripts`(`require_login`은 기본 `true` 그대로 둠). 클래스는 A의 `app.css`에 있는 것만: `form-row`, `card`, `muted`, `nowrap`, `table-wrap`, `secondary`, 그리고 JS가 쓰는 `cell-title`(A 계획표 ⑦ 공통 클래스 목록에 빠져 있어요 — A에게 추가 요청). 인라인 스타일 금지 |
| 유의 — 보안·접근성 | 자동 이스케이프를 끄지 않아요(`|safe` 금지). `label for`·`th scope="col"`·`aria-labelledby`를 붙여요. 회원 데이터는 서버가 넣지 않고 JS가 API로 채워요(D-021) |
| 유의 — 문서 불일치 | `05-structure-conventions.md` §1 트리에는 `partials/room_row.html`이 있지만 스켈레톤에는 없고, §7 PAGE는 "목록 행은 JS가 그린다"예요 → 행 조각 템플릿은 만들지 않고 `renderRoomRows`(④)가 그려요. `07-screens.md` 와이어프레임은 현재 방 링크가 안내 영역 위에 있지만, 안내 영역은 `base.html`이 `content` 블록보다 먼저 넣으므로 blueprint처럼 안내 아래에 와요(배치 차이일 뿐) |
| 완료 확인 | 작성만으로는 화면이 안 보여요(스켈레톤 `base.html`이 주석뿐). A ⑦·C `pages.py`가 올라오면 ⑧에서 `/`가 토큰 없이 200인지 확인 |

### ④ `src/static/js/rooms.js` — 공통 도우미 + 목록(SCR-03) → PR②

| 항목 | 내용 |
|---|---|
| 할 일 | 공통: `FAILED_TO_LOAD = "최신 정보를 불러오지 못했습니다"`, `showLoadError`·`clearLoadError`·`showError`(조회 실패 안내 표시 여부 `showingLoadError`), `setupRefreshButton(load)`(조회 중 버튼 `disabled`). 목록: `readListCondition`, `listQuery(cond, page)`, `renderRoomRows`, `renderRoomPage`, `renderCurrentRoom`, `joinRoom`, `createRoom`, `loadRoomList(cond)`, `initRoomListPage` |
| 참고 | 교안 범위 밖(JS) — §8 규칙대로 `fetch`·DOM만 / `04-interfaces-api.md` §7 PAGE-03·SEQ-13, `07-screens.md` §2 갱신 규칙·SCR-03, ADR-012, AC-15-1~7, CONV-09, blueprint `src/static/js/rooms.js` 앞부분 |
| 유의 — 조회 시점 | `loadRoomList`는 **화면 진입 1회 + [새로고침] 클릭** 때만: `GET /api/rooms?…` 다음 `GET /api/me/room`을 차례로 불러요(SEQ-13). 검색·페이지 변경은 URL 이동이라 진입으로 처리돼요. 타이머 금지 — NFR-08 점검 명령 `grep -rnE "setInterval\|polling" src/static src/templates`가 0줄이어야 하니 **주석에도 영어 "polling"을 쓰지 않아요** |
| 유의 — B의 `api.js` 사용 | 직접 `fetch`하지 않고 B의 함수만 불러요(CONV-09): `apiRequest(method, url, body)` → `{ ok, status, data }`(통신 실패는 `status 0`), `errorMessage(result)`, `showNotice(message, kind)`·`hideNotice()`, `formatTime(iso)`, `renderPagination(nav, page, size, total, makeHref)`, `getAccessToken()`. 토큰이 없으면 `initRoomListPage`는 바로 끝내요(이동은 `api.js`가 함) |
| 유의 — 동작 | 쿼리 이름은 화면 주소와 API가 같아요(`keyword`, `available_only=true`, `sort`, `page`). 페이지 링크는 `"/?" + listQuery(cond, page)`(AC-15-4). 정원 마감이면 "정원 마감" + [참가] `disabled`(AC-15-3). 참가 성공 → `/rooms/{id}`, 생성 성공 → `/rooms/${result.data.id}`, 실패 → `showError(errorMessage(result))`로 사유만 보이고 화면은 그대로(AC-15-7). 현재 방이 `room_id: null`이면 링크를 숨겨요(AC-15-2) |
| 유의 — 안전 | 방 제목·닉네임은 `textContent`로만 넣어요(`innerHTML` 금지, XSS). 응답 필드는 snake_case(`current_count`, `is_full`, `created_at`) 그대로 |
| 완료 확인 | 이름 합의만으로 작성 가능. PR②는 초안으로 올리고, 실제 확인은 ⑧에서 해요. 올리기 전 위 grep 0줄 |

### ⑤ `src/templates/rooms/detail.html` — SCR-04 방 상세 틀

| 항목 | 내용 |
|---|---|
| 할 일 | [새로고침] 버튼, `<section id="room" data-room-id="{{ room_id }}" hidden>` 안에 제목·인원, 방장용 제목 변경 폼, A팀·B팀 칸, 참가자용 [팀 이동]·[나가기], 방장용 [게임 시작], 비참가자용 [참가]. 끝에 `rooms.js` + `initRoomDetailPage` |
| 참고 | 교안 3-2 필수1·심화1 / `07-screens.md` §3 SCR-04, `04-interfaces-api.md` §7 PAGE-04, AC-16-1·2, blueprint `src/templates/rooms/detail.html` |
| 유의 — DOM ID | `refresh-button`, `room`(`data-room-id`), `room-title`, `room-count`, `rename-box`·`rename-form`·`rename-title`·`rename-button`, `team-a-count`·`team-a-members`·`team-b-count`·`team-b-members`, `member-actions`·`move-button`·`leave-button`, `host-actions`·`start-button`, `guest-actions`·`join-button` |
| 유의 — 숨김 | 버튼 묶음은 처음에 모두 `hidden`, JS가 응답의 `my_team`·`am_i_host`로 켜요(AC-16-2). `.form-row`의 `display: flex`가 `hidden` 속성을 덮으므로 **`hidden`은 바깥 `div`에** 둬요 |
| 유의 — C·A와 합의 | 서버 컨텍스트는 C가 넘기는 `room_id: int` 하나뿐(PAGE-04). 클래스 `teams`·`team-a`·`team-b`·`card`·`secondary`·`muted`는 A의 `app.css`에 있어야 해요 |
| 완료 확인 | ⑧에서 `/rooms/1`이 토큰 없이 200 |

### ⑥ `src/static/js/rooms.js` — 상세(SCR-04) → PR③

| 항목 | 내용 |
|---|---|
| 할 일 | `TEAM_SIZE = 2`, 상태 `lastDetail`·`detailBusy`·`refreshDetail`. `detailRoomId`, `teamMembers`, `renderTeam`, `updateDetailButtons`, `renderDetail`, `handleDetailError`, `loadRoomDetail`, `showChangeFailure`, `sendDetailChange(method, url, body)`, `renameRoom`, `moveTeam`, `joinFromDetail`, `leaveRoom`, `startGame`, `initRoomDetailPage` |
| 참고 | `04-interfaces-api.md` SEQ-13·§7 PAGE-04·§4.2 API-ROOM-03~08, `07-screens.md` SCR-04, ADR-012, AC-16-1~7, blueprint `src/static/js/rooms.js` 뒷부분 |
| 유의 — 조회 시점 | `loadRoomDetail`(`GET /api/rooms/{id}`)은 **진입 1회, [새로고침], 변경 요청 실패 직후 1회**만(SEQ-13). 변경 성공은 응답(`RoomDetailResponse`)으로 바로 다시 그리고 추가 조회하지 않아요 |
| 유의 — 오류 분기 | 410 → `location.href = "/?notice=dissolved"`(AC-16-4), 404 → `#room` 숨김 + "방을 찾을 수 없습니다"(AC-16-7, 해산 안내와 다르게), 401 → 아무것도 안 함(`api.js`가 `/login?expired=1`로 보냄, AC-16-6), 통신 실패(`status 0`) → 마지막 화면 유지 + "최신 정보를 불러오지 못했습니다"(AC-16-5). **5xx는 문서와 blueprint가 달라요** — SEQ-13은 5xx도 "최신 정보를 불러오지 못했습니다"인데 blueprint는 `errorMessage`로 "서버 오류가 발생했습니다"를 보여요. 설계 문서를 따르려면 `status === 0 \|\| status >= 500`을 조회 실패로 묶어요(팀에 공유) |
| 유의 — 변경 거부 | 실패하면 `showError(detail)` → `refreshDetail()` 1회. 해산된 방에 보낸 변경은 **400**("이미 삭제된 방입니다")이고, 이어진 조회가 410이라 목록으로 가요(ADR-012). `showError`가 `showingLoadError`를 내려야 이어진 조회 성공이 거부 사유를 지우지 않아요 |
| 유의 — 버튼 | 보내는 동안 `detailBusy`로 모든 버튼 `disabled`(조회가 다시 그려도 풀리지 않게). [게임 시작]은 방장에게만 보이고 A·B 각 2명일 때만 활성(최종 판단은 서버). [참가]는 비참가자 + 빈자리일 때만. 팀 칸에는 닉네임, 방장은 `★닉네임 (방장)`, 남은 자리 "(빈자리)", 입장 순서는 표시하지 않아요(REQ-045). 제목 변경 성공 시 입력칸만 비워요 |
| 유의 — 이동 | 나가기 성공 → `/`(사용자 확인 ②), 게임 시작 성공 → `/?notice=dissolved`(AC-16-3) |
| 완료 확인 | PR③ 초안. ⑧에서 확인. ④와 같은 grep 0줄 |

### ⑦ API 연결 확인 (Swagger·curl)

| 항목 | 내용 |
|---|---|
| 할 일 | 실제 서비스·조회·DB가 붙은 상태로 API 11개를 순서대로 불러 응답 모양을 확인하고, 다르면 E 파일만 고쳐 PR을 올려요 |
| 참고 | 교안 2-2 필수2(공통 에러 스키마) / `04-interfaces-api.md` §4.2(에러 예시)·§4.3·§6·§11, AC-01~07·AC-12-1~8·AC-13-5·AC-14-1·2, `06-quality-gates.md` §1 |
| 선행 | C `RoomApplicationService` 완성, D `RoomQueryService`·`RoomRepository`·`RoomQueryRepository` 완성, A ⑥(전역 예외 핸들러) + A ⑧(라우터 등록·`create_all`), B 인증(Swagger Authorize용 `/api/auth/token`·`get_current_user_id` 본 구현) |
| 우회 | B 인증이 늦으면 **커밋하지 않는 로컬 임시 앱**에서 `app.dependency_overrides[get_current_user_id] = lambda: 1`로 확인하고 지워요(금지 패턴 9). 단, A ⑥ 핸들러가 없으면 400·404·410이 500으로 보여요 |
| 확인 목록 | 성공은 모두 200(D-013). 오류는 `{"detail": "문자열"}`: 01 `size=51`·`page=0`·`sort=x` → 422, 03 해산 방 → 410 + `Cache-Control: no-store`(A 핸들러), 없는 방 → 404, 06 `team="C"` → 422, 08 두 번째 → 400 "이미 삭제된 방입니다"(§11), 09 미참가 → `{"room_id": null, "title": null}`, 10 항목에 `participation_id` 없음, 11 남의 방 → 404, 토큰 없이 → 401 |
| 완료 확인 | 위 목록 전부 기대대로. GATE-05·07·08 출력 0줄 |

### ⑧ 화면 연결 확인 (브라우저 수동 점검) → PR②·③ 머지

| 항목 | 내용 |
|---|---|
| 할 일 | 브라우저 2~4개(다른 계정)로 SCR-03·04를 조작해 AC-15·16과 NFR-08을 확인해요 |
| 참고 | `06-quality-gates.md` §2 마지막 문단(화면은 수동 점검), `07-screens.md` §5 시연 흐름 1·2·5, AC-15-1~7, AC-16-1~7, ADR-012 |
| 선행 | A ⑦(`base.html`·`partials`·`app.css`), A ⑧, B `api.js`·로그인 화면, C `pages.py`(`/`·`/rooms/{room_id}`), (편하려면) A ⑨ 시드 — 없으면 화면에서 방을 직접 만들어요 |
| 확인 목록 | 토큰 없이 `/` → `/login`. 목록 진입 1회 조회 후 **10초 무조작 시 요청 0건**(개발자 도구 Network, NFR-08). 다른 계정이 만든 방이 [새로고침] 뒤 보임(AC-15-6). 검색어 바꾸면 1페이지, 페이지 이동 시 조건 유지(AC-15-4). 상세에서 다른 사람 참가가 [새로고침] 뒤 반영(AC-16-1). 방장만 제목 변경·게임 시작(AC-16-2). 방장 게임 시작 → 목록 + 해산 안내, 다른 참가자는 [새로고침] 또는 버튼 클릭 때 목록 + 해산 안내(AC-16-3·4). 서버를 끄고 [새로고침] → 마지막 정보 유지 + 실패 안내(AC-16-5). 없는 방 번호 → "방을 찾을 수 없습니다"(AC-16-7) |
| 완료 확인 | 위 목록 통과, `grep -rnE "setInterval\|polling" src/static src/templates` 0줄 → PR②·③ 머지 |

## 3. 추천 브랜치·PR 단위

| PR | 브랜치 | 담는 것 |
|---|---|---|
| ① | `feat/rooms-api-router-schemas` | ①② (TKT-BE-M3-04) — 머지되면 바로 A에게 `rooms.presentation.router.router` 알림 |
| ② | `feat/rooms-list-screen` | ③④ (TKT-FE-M5-03) — ⑧ 목록 확인 뒤 머지 |
| ③ | `feat/rooms-detail-screen` | ⑤⑥ (TKT-FE-M5-04) — PR② 머지 뒤(같은 `rooms.js`), ⑧ 상세 확인 뒤 머지 |
| (필요 시) | `fix/rooms-api-…` | ⑦⑧에서 찾은 E 파일 수정 |

- 한 PR에 한 가지 작업만 담아요(CONV-13). PR②·③은 둘 다 `rooms.js`를 고치므로 동시에 열면 충돌해요 — ②를 먼저 머지하고 ③을 그 위에서 이어 가요.
- PR 전에 `uv run ruff check src tests`, `uv run ruff format --check src tests`(GATE-05)를 돌려요.

## 4. 팀원과 맞출 것 체크리스트

- [ ] A: 라우터 변수 이름 `router`(prefix `/api`, `rooms.presentation.router`) 공유 → A ⑧ 등록
- [ ] A: `base.html` 블록 이름(`title`·`require_login`·`content`·`scripts`), `#notice`·`#pagination` 위치, 공통 클래스 목록에 **`cell-title` 추가** 요청
- [ ] A: 410 응답에 `Cache-Control: no-store`가 붙는지(A ⑥) — 없으면 DB 재생성 뒤 상세가 "해산"으로 보여요
- [ ] B: `get_current_user_id(user=Depends(get_current_user)) -> int` 이름·반환형을 먼저 받기(분담표 §5-3)
- [ ] B: `api.js` 함수 이름·반환 모양(`apiRequest` → `{ ok, status, data }`, 통신 실패 `status 0`) 확정
- [ ] C: `RoomApplicationService(db)`가 **`db` 하나로 만들어지는지**(`clock` 기본값 필요 — §3 표는 `clock`이 필수처럼 보여요), 메서드 6개 반환형(`Room`·`LeaveResult`·`GameStartResult`), `TeamSide` import 위치(`rooms.domain.room`)
- [ ] C: 화면 컨텍스트 이름 — `/` → `cond`(`keyword`·`available_only`·`sort`·`page`)·`notice`, `/rooms/{room_id}` → `room_id`
- [ ] C: `history.html`·`archived.html`이 쓸 API-ROOM-10·11 응답 필드 이름 공유(§5.2)
- [ ] D: `RoomQueryService(db)` 메서드 5개 이름·인자, `RoomListCondition` 필드, 읽기 모델 필드가 §5.2 응답 필드와 같은 이름인지
- [ ] 팀: 상세 조회 5xx 안내 문구를 SEQ-13(통신 실패와 같은 문구)대로 할지 결정

## 5. 자주 틀리는 점 모음

1. `HistoryItemResponse`에 `participation_id`를 넣음 → D-025·AC-13-5 위반, 읽기 모델에도 없어 `model_validate`가 실패해요.
2. 제목에 `min_length`·strip validator를 넣음 → 400 도메인 문구 대신 422가 나가요.
3. 요청 스키마에 `extra="forbid"` → 정원 10을 보낸 요청이 422(AC-01-4는 200).
4. 라우터 전체에 `tags=["rooms"]` → `/me/*`가 Swagger에서 두 곳에 보여요.
5. 목록 API에 인증 의존성을 빠뜨림 → 비로그인도 200(§4.3은 401).
6. `keyword`를 strip하지 않거나 빈 문자열을 그대로 넘김 → `"  fun "` 검색 실패(AC-12-3).
7. 라우터에서 `try/except`로 `HTTPException`을 만듦 → 전역 핸들러와 겹치고 CONV-05 위반.
8. 변경 API 응답을 서비스가 준 `Room`으로 바로 만듦 → `RoomDetailResponse`에 필요한 닉네임·`my_team`·`am_i_host`가 없어요. 반드시 `get_room_detail`로 다시 읽어요.
9. JS에서 `innerHTML`로 방 제목·닉네임을 넣음 → XSS.
10. `setInterval`·반복 `setTimeout` 사용, 또는 주석에 "polling"을 씀 → NFR-08 점검 grep에 걸려요.
11. 변경 성공 뒤 상세를 또 조회함 / 변경 실패 뒤 다시 조회하지 않음 → SEQ-13과 달라요(해산된 방에서 목록으로 못 가요).
12. `hidden`을 `.form-row` 요소에 직접 붙임 → CSS `display`가 이겨서 숨겨지지 않아요.
13. 410과 404를 같은 문구로 처리 → AC-16-7 위반.
14. `fetch`를 직접 씀 → 토큰 헤더·401 재발급을 빠뜨려요(CONV-09). 항상 `apiRequest`.

## 6. 다른 파트와의 선후 관계

### 6.1 E가 먼저 받아야 하는 것

| 파트 | 파일 | 이름 | 기다리는 E 단계 | 기다리지 않는 우회 방법 |
|---|---|---|---|---|
| A | `src/database.py` | `get_db` | ② import(PR① 올리기), ⑦ | A PR①(A ②③④, 반나절 목표)이 가장 먼저 머지돼요. 그 전에는 코드 작성 + ruff만 |
| A | `src/main.py` v1 | 전역 예외 핸들러 6개(410 `Cache-Control: no-store` 포함), `/static` 마운트(`name="static"`) | ⑦(오류 응답 모양), ⑧(`url_for('static', …)`) | ⑦은 핸들러 없이도 성공 응답은 확인 가능(오류는 500으로 보임). A ⑥ |
| A | `src/main.py` v2 | `include_router(rooms_router)`, `create_all` | ⑦, ⑧ | 커밋하지 않는 로컬 임시 앱에서 `include_router` 후 확인. A ⑧ |
| A | `templates/base.html`, `partials/notice.html`·`pagination.html`, `static/css/app.css` | 블록 `title`·`content`·`scripts`, `#notice`, `#pagination`, 클래스 `form-row`·`card`·`muted`·`nowrap`·`table-wrap`·`secondary`·`teams`·`team-a`·`team-b`·`cell-title` | ③⑤ 작성(이름 합의만 필요), ⑧ 확인 | 이름을 먼저 받아 작성, 화면 확인만 A ⑦ 뒤로 |
| A | `src/seed.py` | 시드 방·회원(`seed01`~`seed14`) | ⑧(편의) | 화면·Swagger로 방·회원을 직접 만들어요. A ⑨ |
| B | `src/auth/presentation/dependencies.py` | `get_current_user_id(user=Depends(get_current_user)) -> int` | ② import, ⑦ | 이름·반환형 먼저 공유(분담표 §5-3), 함수 껍데기 먼저 머지 요청. ⑦은 `dependency_overrides`로 우회. **E는 이 파일을 고치지 않아요**(HANDOFF의 `X-Debug-User-Id` 임시 코드는 B 몫) |
| B | `src/auth/presentation/router.py`·`templates/auth/login.html` | `/api/auth/token`, 로그인 화면 | ⑦(Swagger Authorize), ⑧(브라우저 로그인) | ⑦은 override, ⑧은 대안 없음 |
| B | `src/static/js/api.js` | `apiRequest`, `errorMessage`, `showNotice`, `hideNotice`, `formatTime`, `renderPagination`, `getAccessToken` | ④⑥ 작성(이름·반환 모양만), ⑧ 실행 | 이름·반환 모양을 먼저 받아 작성. 실행 확인만 ⑧ |
| C | `src/rooms/application/service.py` | `RoomApplicationService(db)` + `create_room`·`join_room`·`rename_room`·`change_team`·`leave_room`·`start_game` | ② import, ⑦ 변경 API(02·04~08) | 메서드 이름만 있는 껍데기 먼저 머지 요청(분담표 §5-2와 같은 취지) |
| C | `src/rooms/domain/room.py`(`participation.py`) | `TeamSide`(`A`/`B`) | ② import(06 팀 변경) | C 도메인 껍데기(분담표 §5-2) |
| C | `src/rooms/presentation/pages.py` | `page_router`, `/` → `rooms/list.html`(`cond`·`notice`), `/rooms/{room_id}` → `rooms/detail.html`(`room_id`) | ③⑤ 작성(이름 합의), ⑧ 렌더 | 컨텍스트 이름만 먼저 합의 |
| D | `src/rooms/application/queries.py` | `RoomQueryService(db)` + `list_rooms`·`get_room_detail`·`get_current_room`·`list_history`·`get_archived_room` | ② import, ⑦ 조회 API(01·03·09~11)와 변경 API 응답 | 껍데기 먼저 머지 요청 |
| D | `src/rooms/application/read_models.py` | `RoomListCondition(keyword, available_only, sort, page, size)`, 읽기 모델 필드 이름 | ① 필드 이름 맞추기(import는 안 함), ② import | §3·§5.2 표 이름으로 먼저 작성 |
| D | `src/rooms/infrastructure/models.py`·`repositories.py` | 실제 DB 동작(팀 연결·로그 이동) | ⑦, ⑧ | 없음 — ⑦⑧은 D 완료 뒤 |

### 6.2 E가 넘겨줘야 하는 것

| 받는 파트 | 무엇 | 그 파트에서 기다리는 작업 | 언제까지 |
|---|---|---|---|
| A | `rooms.presentation.router.router`(import 오류 없는 상태) | A ⑧ main.py v2 라우터 등록 | 이름은 1일차에 공유, 코드는 E ② PR① 머지 직후 |
| A | API 11개의 실제 동작(400·404·410·422) | A ⑩ 통합 점검(오류 형식 curl, 410 `no-store`) | E ⑦ 완료 |
| A | E 템플릿·JS가 쓰는 클래스 목록(`cell-title` 포함) | A ⑦ `app.css` | E ③ 시작 전(A ⑦과 같은 시기) |
| A | 화면 2개(`/`, `/rooms/{id}`) 템플릿 | A ⑩ "화면 6개 200" 확인 | E ⑧ 완료(PR②·③ 머지) |
| C | 템플릿 컨텍스트 이름(`cond`의 4개 키, `notice`, `room_id`) — 양방향 합의 | C `pages.py`(`/`·`/rooms/{room_id}` 라우트) | E ③ 시작 전 |
| C | API-ROOM-10·11 동작 + `HistoryListResponse`·`HistoryItemResponse`·`ArchivedRoomResponse`·`MyRecordResponse` 필드 이름 | C `history.html`·`archived.html` 인라인 스크립트(작성은 이름만, 실행 확인은 API 필요) | 필드 이름은 E ① 직후, 동작은 E ② 머지 + ⑦ |
| C | API-ROOM-02·04~08 엔드포인트 | C 서비스 동작을 Swagger로 확인할 때(선택) | E ② 머지 |
| D | API-ROOM-01·03·09~11 엔드포인트 | D 조회 결과를 Swagger로 확인할 때(선택) | E ② 머지 |
| B | (코드 의존 없음) ⑧에서 확인한 `api.js` 동작 결과(토큰 없음 → `/login`, 401 → 재발급 → `/login?expired=1`) | B `api.js` 검증 | E ⑧ |

- 가장 많이 막는 지점은 **E ②(PR①)**예요. A ⑧과 C의 기록 화면 확인이 이 PR을 기다려요. 그래서 ①② 를 1일차에 끝내고, 껍데기가 머지되는 즉시 PR①을 올려요.
- E가 가장 오래 기다리는 지점은 **⑦**(C·D 완성 + A ⑥⑧)이고, 그동안 ③~⑥을 진행해요.
