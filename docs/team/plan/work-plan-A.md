# A 파트 작업계획표 — 공통 기반·앱 조립

> 기준: `origin/dev`의 `docs/work-assignment.md`(D-026 반영본, A ≈ 545), `docs/01-pm/`·`docs/02-arch/`, 참고 구현 `reference/agent-pipeline-blueprint`
> 교안: [백엔드 아키텍처 & API 설계 실습 모음](https://charmed-watch-60f.notion.site/API-405566040df880fbbe34c039dd0f281d) — 아래 표의 "교안"은 `장-강 / 문제 번호`로 적었어요

---

## 0. 시작 전에 확인할 것

| 확인 | 내용 |
|---|---|
| 최신 `dev` 받기 | 로컬 `dev`가 `origin/dev`보다 3커밋 뒤예요(D-026 폴링 제거). `git pull` 후 작업해요. 최신본에서 `static/js/polling.js`는 **삭제**됐고 A 담당에서 빠졌어요 |
| 이미 채워진 파일 | `pyproject.toml`, `.env.example`, 모든 `__init__.py`는 스켈레톤에 이미 완성돼 있어요. 새로 쓰지 말고 **검증만** 해요 (§2 1단계) |
| 내 파일만 수정 | 한 파일 = 한 주인. `main.py`는 A만 수정해요. B·C·E는 라우터 변수 이름만 알려 줘요 |
| 교안 수준 규칙 | `docs/02-arch/05-structure-conventions.md` §8(D-020). 교안 1~7장으로 이해할 수 있는 코드만 써요 |
| 시그니처 고정 | 이름·시그니처는 `docs/02-arch/04-interfaces-api.md`가 정답이에요. 바꿔야 하면 혼자 바꾸지 말고 팀에 먼저 말해요 |

## 1. 전체 순서 한눈에 보기

```
[1일차 오전: 선행 — 모두가 import함]
  ① 프로젝트 설정 검증 → ② config.py → ③ database.py → ④ exceptions.py → PR①(가장 먼저 머지)

[1일차 오후~: 단독 진행]
  ⑤ logging_middleware.py → ⑥ main.py v1(앱·미들웨어·예외 핸들러·static) → PR②
  ⑦ base.html·partials·app.css (B와 DOM ID 합의 후) → PR③

[B·C·D·E 진행에 맞춰]
  ⑧ main.py v2(모델 import·create_all·라우터 등록) → PR④

[C 도메인 + D RoomRepository.save + B UserRepository 완료 뒤]
  ⑨ seed.py → main.py lifespan에 시드 연결 → PR⑤

[마지막]
  ⑩ 통합 점검(GATE·시드 60건·오류 형식)
```

## 2. 단계별 계획

### ① 프로젝트 설정 검증 — `pyproject.toml`, `.env.example`, `__init__.py`

| 항목 | 내용 |
|---|---|
| 할 일 | 값이 설계와 같은지만 확인하고 내 `.env`를 만들어요. `uv sync --frozen` → `cp .env.example .env` → DB URL·`JWT_SECRET_KEY`·`SEED_USER_PASSWORD`(8자 이상) 채우기 |
| 참고 | 교안 1-1 필수1·심화1(uv, `pyproject.toml`), 7-3 필수1(`.env`·`.gitignore`) / ADR-003, ADR-005, `05-structure-conventions.md` STK-01·07·10·11 |
| 유의 | `bcrypt==4.0.1`을 바꾸지 않아요(STK-07). 패키지 추가·버전 변경은 팀 합의 없이 금지(금지 패턴 8). `.env`는 커밋 금지(GATE-06). ADR-003 본문의 `JWT_EXPIRE_MINUTES`·`COOKIE_SECURE`는 옛 이름이에요 — `.env.example`·HANDOFF의 이름이 맞아요(쿠키 없음, D-021) |
| 완료 확인 | GATE-03 명령 출력 0줄, `uv run ruff check src tests` 오류 0 |

### ② `src/config.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `Settings(BaseSettings)` 필드 8개(`database_url`, `jwt_secret_key`, `access_token_expire_minutes=30`, `refresh_token_expire_days=7`, `cors_origins`, `db_pool_size=10`, `db_max_overflow=10`, `seed_user_password`) + 캐시된 `get_settings()` |
| 참고 | 교안 5-2 필수1 문제1-1(.env 옵션을 동적으로 로드), 7-3 필수1 / ADR-003, HANDOFF TKT-BE-M2-01, blueprint `src/config.py` |
| 유의 | `model_config`에 `env_file=".env"`, `extra="ignore"`(테스트용 `TEST_DATABASE_URL`을 무시, STK-10). `database_url`·`jwt_secret_key`·`seed_user_password`는 **기본값 없이** 둬서 빠지면 기동 실패하게 해요. `cors_origins`는 `list[str]`이고 `.env`에는 JSON 배열로 써요. `.env`는 실행 디렉토리 기준이라 서버·테스트는 저장소 루트에서 실행해요. 도메인은 설정을 import하지 않아요 |

### ③ `src/database.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `engine = create_async_engine(url, pool_size, max_overflow)`, `AsyncSessionLocal = async_sessionmaker(..., class_=AsyncSession, expire_on_commit=False)`, `class Base(DeclarativeBase)`, `async def get_db()` |
| 참고 | 교안 5-1 필수1(DB 연결·모델 기반), 5-2 필수1·2(커넥션 풀·asyncpg·AsyncSession) / `04-interfaces-api.md` §8(트랜잭션 경계), HANDOFF TKT-DB-M2-01, blueprint `src/database.py` |
| 유의 | `get_db()`는 `async with ... as session: try: yield session / except: rollback; raise` — **commit하지 않아요**(서비스가 함). `expire_on_commit=False` 빠뜨리면 commit 뒤 속성 접근에서 오류가 나요. 엔진은 import 시점에 만들어지므로 `.env`가 없으면 import부터 실패해요(정상 동작) |

### ④ `src/exceptions.py` → **PR① 먼저 머지하고 팀에 공지**

| 항목 | 내용 |
|---|---|
| 할 일 | `DomainError(ValueError)` + `message`, 하위 `DomainRuleError`(400)·`NotFoundError`(404)·`GoneError`(410), 별도 `AuthenticationError(Exception)`(401, 기본 문구 "인증이 필요합니다") |
| 참고 | 교안 3-1 심화1(ValueError 전역 처리), 1장 순수 도메인 클래스의 `ValueError` / `04-interfaces-api.md` §1.1·§6, D-015, blueprint `src/exceptions.py` |
| 유의 | **외부 라이브러리 import 금지**(도메인이 import하는 파일, GATE-02). `AuthenticationError`는 `DomainError` 계층이 **아니에요**(표의 부모 그대로). 403용 클래스는 만들지 않아요(D-015). 이 파일 + ②③이 B·C·D 모두의 선행 조건이라 반나절 안에 올리는 게 목표예요 |

### ⑤ `src/logging_middleware.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `async def log_requests(request, call_next)`: `time.perf_counter()`로 처리 시간을 재고 `method=GET path=/api/rooms status=200 duration_ms=12.3` 한 줄 기록 |
| 참고 | 교안 1-1 필수2(로그 기록), 4-1 필수2(처리 시간 전역 미들웨어) / CONV-07, blueprint `src/logging_middleware.py` |
| 유의 | `request.url.path`만 남기고 **쿼리 문자열·본문·토큰·비밀번호는 남기지 않아요**. `logging.getLogger(...)`를 쓰고 `print` 금지. `user_id=`는 `request.state.user_id`가 있을 때만 붙이는 선택 사항(참고 구현은 생략). 처리 시간 헤더(`X-Process-Time`)는 교안 방식 그대로 붙여도 돼요 |

### ⑥ `src/main.py` v1 — 앱 뼈대 (DB·라우터 없이 뜨는 상태) → PR②

| 항목 | 내용 |
|---|---|
| 할 일 | `logging.basicConfig(level=INFO)`, `FastAPI(title, description, version)`, 미들웨어 2개, 전역 예외 핸들러 6개, `/static` 마운트 |
| 참고 | 교안 2-2(문서화·`FastAPI(...)`), 3-1 심화1(`@app.exception_handler` + `JSONResponse`), 4-1 필수2(미들웨어·등록 순서), 7-2 필수1(CORSMiddleware), 3-2(`StaticFiles`) / `04-interfaces-api.md` §1.1·§6, ADR-004, CONV-10·11·12, blueprint `src/main.py` |
| 유의 — 미들웨어 | 순서: `app.middleware("http")(log_requests)` **먼저**, `add_middleware(CORSMiddleware, ...)` **나중**(나중에 추가한 것이 가장 바깥, CONV-11). CORS는 `allow_origins=settings.cors_origins`, 메서드 `GET·POST·PATCH·DELETE`, 헤더 `Authorization·Content-Type`, **`*` 금지**(CONV-10) |
| 유의 — 예외 핸들러 | 응답은 모두 `{"detail": "<문자열>"}`. 400·404는 `exc.message`, **410은 `Cache-Control: no-store` 헤더**(D-026에서 추가), **401은 `WWW-Authenticate: Bearer` 헤더**, 422는 `RequestValidationError`를 `"<loc 마지막>: <msg>; …"` 최대 3개로 이어 붙인 문자열(ADR-004), 500은 `"서버 오류가 발생했습니다"` + 스택은 `logger.exception`으로 로그에만. 부모 4개만 등록하면 기능별 하위 예외는 자동으로 잡혀요 |
| 유의 — static | `StaticFiles(directory=Path(__file__).resolve().parent / "static")`, `name="static"` 필수(템플릿의 `url_for('static', ...)`가 이 이름을 씀). 경로는 `Path(__file__)` 기준(CONV-12) |
| 완료 확인 | `uv run uvicorn main:app --app-dir src` → `/docs` 200, 콘솔에 요청 로그 한 줄. 아직 DB·라우터가 없어도 떠야 해요(GATE-01 M2 기준) |

### ⑦ 화면 공통 틀 — `templates/base.html`, `templates/partials/notice.html`·`pagination.html`, `static/css/app.css` → PR③

| 항목 | 내용 |
|---|---|
| 할 일 | 공통 레이아웃(머리글: 서비스 이름 / 로그인 시 닉네임·[내 기록]·[로그아웃] / 비로그인 시 [로그인]·[회원가입], 본문, 바닥글), 안내 한 줄 영역, 페이지 이동 자리, 스타일 토큰과 공통 클래스 |
| 참고 | 교안 3-2 필수1(레이아웃 분리·CSS·`{% extends %}`·`{% include %}`) / `docs/01-pm/07-screens.md` §2, `05-structure-conventions.md` §6(토큰 이름·역할), CONV-12, blueprint의 같은 4개 파일 |
| 유의 — B와 합의 | B의 `api.js`가 A의 DOM을 직접 만져요. **ID를 먼저 B와 맞춰요**: `#notice`(→ `showNotice`), `#pagination`(→ `renderPagination`), `#nav-member`·`#nav-guest`·`#nav-nickname`·`#nav-logout`(→ `initHeader`), `body[data-require-login]`. `base.html`이 `api.js`를 공통으로 불러와요 |
| 유의 — B·C·E와 합의 | 다른 사람 템플릿이 쓰는 **block 이름**: `title`, `require_login`(로그인·회원가입 화면만 `false`), `content`, `scripts`. 참고 구현 기준 **공통 클래스**: `container`, `card`, `form-row`, `form-field`, `table-wrap`, `muted`, `nowrap`, `secondary`, `button`, `notice`(+`error`/`success`), `pagination`, `cell-title`, `teams`·`team-a`·`team-b`. 이름을 정리해 팀 채널에 공유해요 |
| 유의 — 스타일 | 색·간격·글꼴은 `:root` CSS 변수로만 정의하고 다른 곳은 `var(--…)`만 써요(인라인 스타일 금지). 본문 대비 4.5:1 이상. `notice.html`은 서버가 넘긴 `notice` 값이 있으면 처음부터 보이게, 없으면 `hidden`. 자동 이스케이프는 끄지 않아요. JS 라이브러리·번들러 없음 |
| 유의 — D-026 | 폴링 유틸은 없어요. 공통 틀에 자동 조회 관련 코드를 넣지 않아요 |

### ⑧ `src/main.py` v2 — 앱 조립 (다른 파트가 올라오는 대로) → PR④

| 항목 | 내용 |
|---|---|
| 할 일 | ORM 모델 모듈 import(`auth.infrastructure.models`, `rooms.infrastructure.models`), lifespan(`create_all` → yield → `engine.dispose()`), 라우터 4개 `include_router` |
| 참고 | 교안 2장 `lifespan`(`asynccontextmanager`), 4-1 필수1(`APIRouter`·`include_router`), 5-1(`engine.begin()` + `run_sync(Base.metadata.create_all)`) / `04-interfaces-api.md` SEQ-12, STK-12·13, `work-assignment.md` §4 |
| 유의 | 라우터 변수 이름: `auth.presentation.router.router`, `auth.presentation.pages.page_router`, `rooms.presentation.router.router`, `rooms.presentation.pages.page_router` — B·C·E에게 확인받아요. 모델 모듈을 **import하지 않으면 `create_all`이 테이블을 만들지 않아요**(`# noqa: F401`). 모델이 바뀌면(D-025 등) 개발 DB를 지우고 다시 만들어요(STK-13) |
| 진행 팁 | 아직 안 올라온 파트의 import는 넣지 말고, 머지된 순서대로 한 줄씩 추가해요. `ImportError`로 앱 전체가 멈추지 않게요 |

### ⑨ `src/seed.py` + lifespan 연결 → PR⑤ (가장 마지막)

| 항목 | 내용 |
|---|---|
| 할 일 | `async def seed_initial_data(session, settings)`: 회원 14 → 삭제 방 3 → 활성 방 5. 끝에 건수 로그 한 줄. lifespan에서 `create_all` 다음에 `async with AsyncSessionLocal() as s: await seed_initial_data(s, settings); await s.commit()` |
| 참고 | 교안 7-1 필수1·2(도메인 메서드 + 레포지토리 패턴), 5-1(`add`·`flush`), 6-1(bcrypt 해시 — B의 `PasswordHasher` 사용) / **`docs/02-arch/03-db-schema.md` §6(시드 표가 정답)**, ADR-011, `docs/01-pm/D-025-participations-composite-pk.md`, blueprint `src/seed.py` |
| 선행 | B: `User.register`, `UserRepository.exists_login_id`·`save`, `PasswordHasher().hash` / C: `Room.create`·`join`·`leave`·`start_game`, `room.current_participants`, `room.host_user_id` / D: `RoomRepository.save`(끝난 참가 → `participation_logs` 이동) |
| 유의 — 규칙 | **ORM 모델을 직접 만들지 말고** 도메인 메서드로 방을 만든 뒤 `RoomRepository.save`만 불러요(로그 이동은 D의 `save` 책임). 시드는 commit하지 않고 lifespan이 한 번에 commit(한 트랜잭션). 시작할 때 `seed01`이 있으면 바로 반환(재실행 0건, NFR-06) |
| 유의 — 데이터 | 기준 시각 `base = datetime.now(UTC)`에서 분 단위로 빼 생성 순서를 만들어요(aware 값만, STK-06). 삭제 방을 먼저, 활성 방을 나중에 만들어요(과거 기록이 먼저). `Room.create`·`join`의 `current_participation` 인자에는 `None`을 넘겨요(시드가 이미 비어 있는 회원만 고름). D2 "아무도 없음"은 **2명**: seed12 생성 → seed13 참가 → seed12 퇴장 → seed12 재입장 → seed12 퇴장 → seed13 퇴장(빈 방 삭제). 비밀번호는 `settings.seed_user_password`만 사용(하드코딩 금지, GATE-06) |
| 완료 확인 | 첫 기동 로그: `users=14 rooms=8 teams=16 participations=11 participation_logs=11 total=60`. 재기동 시 `seed skipped`. `seed01`~`seed14`로 로그인 가능 |

### ⑩ 통합 점검 (A가 앱 전체를 조립하므로 마지막 확인 담당)

| 확인 | 방법 |
|---|---|
| 기동 | GATE-01: 오류 0, `/docs` 200, 시드 로그 1회 |
| 구조 | GATE-02·03·05·06·07·08 명령(`docs/02-arch/06-quality-gates.md` §1) 출력 0줄 |
| 오류 형식 | curl로 400·404·410·401·422 응답이 모두 `{"detail": "문자열"}`인지, 410에 `Cache-Control: no-store`, 401에 `WWW-Authenticate: Bearer`가 붙는지 확인 |
| 화면 | 화면 6개가 토큰 없이 200, 공통 머리글·안내 영역이 모든 화면에 보임 |

## 3. 추천 브랜치·PR 단위

| PR | 브랜치 | 담는 것 |
|---|---|---|
| ① | `feat/core-config-db-exceptions` | ②③④ (+① 검증 결과) |
| ② | `feat/app-middleware-handlers` | ⑤⑥ |
| ③ | `feat/common-layout-css` | ⑦ |
| ④ | `feat/app-router-assembly` | ⑧ (파트별로 나눠 여러 번 올려도 돼요) |
| ⑤ | `feat/seed-initial-data` | ⑨ |

- 한 PR에 한 가지 작업만 담아요(README 브랜치 규칙, CONV-13). 기능 변경과 리팩토링을 섞지 않아요.
- PR 전에 `uv run ruff check src tests`, `uv run ruff format --check src tests`(GATE-05)를 돌려요.

## 4. 팀원과 맞출 것 체크리스트

- [ ] PR①(config·database·exceptions) 머지 후 전체 공지 — 모두 이 파일을 import해요
- [ ] B: `api.js`가 쓰는 DOM ID(`notice`, `pagination`, `nav-*`, `data-require-login`) 확정
- [ ] B·C·E: 템플릿 block 이름(`title`·`require_login`·`content`·`scripts`)과 공통 CSS 클래스 목록 공유
- [ ] B·C·E: 라우터 변수 이름(`router`, `page_router`) 확인
- [ ] B·D: ORM 모델 모듈 경로 확인(`create_all` 등록용)
- [ ] C·D·B: 시드에 쓰는 메서드 시그니처(§2 ⑨ "선행")가 `04-interfaces-api.md`와 같은지 확인
- [ ] D: `RoomRepository.save`가 끝난 참가를 로그로 옮기는 동작 완료 시점 공유받기

## 5. 자주 틀리는 점 모음

1. 미들웨어 등록 순서를 반대로 함 → CORS가 안쪽에 들어가요(CONV-11).
2. `get_db()`에서 commit함 → 서비스 commit과 겹쳐요(§8).
3. 모델 모듈 import를 빠뜨려 `create_all`이 빈 DB를 남김.
4. 모델 변경 뒤 기존 DB를 그대로 씀 → 컬럼·PK가 안 바뀌어요(STK-13).
5. 410에 `no-store`를 빠뜨림 → DB 재생성 뒤 같은 방 번호가 "해산"으로 보여요(D-026).
6. `logging.basicConfig`를 안 해서 INFO 로그가 안 보임.
7. 422를 FastAPI 기본(배열)으로 둠 → 화면 JS가 문구를 못 보여 줘요(ADR-004).
8. 시드에서 ORM 모델을 직접 넣음 → 팀 연결·로그 이동 규칙을 우회해요(ADR-011).
9. `StaticFiles` 마운트에 `name="static"`을 빠뜨려 `url_for('static', …)`가 실패.
10. `exceptions.py`에 fastapi 등을 import → 도메인 격리(GATE-02) 위반.
