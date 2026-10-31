# 05. 디렉토리 구조 & 코딩 컨벤션 (A6)

- 입력: 발제 §4.2, ADR-001~009, `04-interfaces-api.md`
- 이 트리는 README "4계층 디렉토리 구조도"의 원본이다.

## 1. 디렉토리 트리

```text
kant-ubuntu-books-claude1/
├── pyproject.toml              # 의존성·ruff 설정 (BE)
├── uv.lock
├── .env.example                # 환경변수 이름·용도 (BE, ADR-003)
├── .gitignore
├── README.md                   # (FE)
├── AGENTS.md
├── src/
│   ├── __init__.py
│   ├── main.py                 # 앱 생성, lifespan(create_all·seed), 미들웨어, 전역 예외 핸들러, 라우터·StaticFiles 등록
│   ├── config.py               # Settings(BaseSettings), get_settings()
│   ├── database.py             # engine, AsyncSessionLocal, Base, get_db()
│   ├── exceptions.py           # DomainError, DomainRuleError, NotFoundError, GoneError, AuthenticationError
│   ├── logging_middleware.py   # RequestLoggingMiddleware
│   ├── seed.py                 # seed_initial_data() (DB)
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── domain/        __init__.py, user.py, token_blacklist.py, exceptions.py
│   │   ├── infrastructure/ __init__.py, models.py, repositories.py, security.py
│   │   ├── application/   __init__.py, service.py
│   │   └── presentation/  __init__.py, schemas.py, router.py, dependencies.py, pages.py
│   ├── rooms/
│   │   ├── __init__.py
│   │   ├── domain/        __init__.py, room.py, team.py, participation.py, exceptions.py
│   │   ├── infrastructure/ __init__.py, models.py, repositories.py
│   │   ├── application/   __init__.py, service.py, queries.py, read_models.py, list_cache.py(CH-C)
│   │   └── presentation/  __init__.py, schemas.py, router.py, pages.py
│   ├── templates/
│   │   ├── base.html
│   │   ├── partials/      notice.html, pagination.html, room_row.html, history_row.html
│   │   ├── auth/          signup.html, login.html
│   │   └── rooms/         list.html, detail.html, history.html, archived.html
│   └── static/
│       ├── css/app.css
│       └── js/            api.js, polling.js, rooms.js
├── tests/
│   ├── conftest.py
│   ├── unit/              test_room.py, test_team.py, test_participation.py, test_user.py        # DB 없음
│   ├── integration/       test_auth_api.py, test_rooms_api.py, test_history_api.py, test_errors.py
│   └── concurrency/       test_room_concurrency.py                                 # CH-A
└── docs/
```

- `src/` 아래 모든 패키지 폴더(`auth/`, `rooms/`와 각 4계층 폴더)에 빈 `__init__.py`를 둔다. `templates/`, `static/`은 패키지가 아니다.
- 실행 시 `--app-dir src`이므로 import는 `src.` 없이 쓴다: `from rooms.domain.room import Room`, `from exceptions import DomainRuleError`.
- 시드 데이터는 `src/seed.py` 안의 상수다(별도 파일 없음).

## 2. 의존 방향

```
presentation ──▶ application ──▶ domain
      │                 │
      │                 └──▶ infrastructure ──▶ domain
      └──▶ domain(예외·열거형 참조만)

기능 간: rooms.presentation ──▶ auth.presentation.dependencies (get_current_user_id)
         rooms.infrastructure.repositories(RoomQueryRepository) ──▶ auth.infrastructure.models (UserModel: 닉네임 조회)
         auth ──▶ rooms : 금지
공통:    모든 계층 ──▶ src/exceptions.py, domain 제외 모든 계층 ──▶ config.py, database.py
```

- `domain/`은 표준 라이브러리(`dataclasses`, `datetime`, `enum`, `re`, `typing`)와 `exceptions`, 같은 기능의 `domain`만 import한다.
- 순환 참조 금지. `application/read_models.py`는 `infrastructure`가 반환 타입으로 import한다(infrastructure → application 계약).

## 3. 코딩 컨벤션

| ID | 규칙 |
|---|---|
| CONV-01 | 이름: 도메인 `<Entity>`, ORM `<Entity>Model`, 레포지토리 `<Entity>Repository`·`RoomQueryRepository`, 서비스 `<Feature>ApplicationService`·`RoomQueryService`, 요청 `<Action>Request`, 응답 `<Thing>Response`. 테이블 snake_case 복수형(`token_blacklist`만 예외, `03-db-schema.md`). |
| CONV-02 | 비동기: DB 호출·레포지토리·서비스 메서드는 모두 `async def`, 호출은 `await`. 도메인 메서드는 동기. |
| CONV-03 | 라우터: `router = APIRouter(prefix="/api/auth", tags=["auth"])`, `APIRouter(prefix="/api", tags=["rooms"])`(`/me/*`는 `tags=["me"]`), 화면은 `page_router = APIRouter(include_in_schema=False)`. 모든 API에 `summary`·`response_model`. |
| CONV-04 | 의존성 조립: 라우터 파일 안의 팩토리 `def get_room_service(db=Depends(get_db)) -> RoomApplicationService`로 서비스를 만든다. 서비스는 요청마다 새로 만든다. |
| CONV-05 | 예외: 도메인·서비스는 `exceptions.py` 계층의 예외만 던진다. 라우터는 `try/except`로 HTTP 변환하지 않는다(전역 핸들러가 한다). |
| CONV-06 | 시각: `datetime.now(UTC)`는 서비스의 `clock`과 `security.py`에서만 호출한다. |
| CONV-07 | 로깅: `logging.getLogger(__name__)`. 미들웨어 한 줄 형식 `method=GET path=/api/rooms status=200 duration_ms=12.3 user_id=5`(user_id는 `request.state.user_id`가 있을 때만). 쿼리 문자열·본문·토큰·비밀번호는 남기지 않는다. |
| CONV-08 | (도전 A 적용 후) 방을 바꾸는 서비스 메서드(참가·제목·팀·나가기·게임 시작)는 반드시 `RoomRepository.find_by_id_for_update`로 방을 읽는다(ADR-009). 필수 범위에서는 `find_by_id`를 쓴다. |
| CONV-09 | 인증은 `Authorization: Bearer` 헤더만 쓴다(쿠키 없음, ADR-002·D-021). 화면 JS는 access·refresh 토큰을 `localStorage`에 두고 `api.js`로만 API를 부른다. 상태 변경은 JSON `fetch`로만 보낸다. |
| CONV-10 | CORS: `CORSMiddleware(allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["GET","POST","PATCH","DELETE"], allow_headers=["Authorization","Content-Type"])`. 와일드카드 `*` 금지. |
| CONV-11 | 미들웨어 등록 순서(`main.py`): `RequestLoggingMiddleware` 다음 `CORSMiddleware`를 `add_middleware`(마지막에 추가한 CORS가 가장 바깥). |
| CONV-12 | 템플릿: `Jinja2Templates(directory=<src>/templates)`, 정적 `app.mount("/static", StaticFiles(directory=<src>/static))`. 경로는 `Path(__file__).parent` 기준. 템플릿은 자동 이스케이프를 끄지 않는다. |
| CONV-13 | 커밋: 한 커밋에 한 티켓, 메시지 `feat(<stage>): <요약> (TKT-…)`. |

## 4. 금지 패턴 (구현 에이전트에 그대로 전달)

1. `domain/`에서 fastapi·sqlalchemy·pydantic 등 외부 라이브러리 import
2. `application/`·`domain/`에서 `presentation/` import, 그 밖의 계층 역참조, `auth`에서 `rooms` import
3. 레포지토리 밖으로 SQLAlchemy 모델 반환, 라우터·서비스에서 직접 `select()`·`session.execute()`
4. 서비스·라우터에 비즈니스 규칙 if-else (정원·팀·방장 판단은 도메인 메서드에 위임)
5. 빈 `except`, 예외 삼키기 (예외: CH-B 백그라운드 로그 작업의 `logger.exception`)
6. JWT 비밀키·DB 비밀번호·시드 비밀번호 하드코딩, `.env` 커밋
7. 응답 스키마에 `hashed_password` 포함
8. 사용자 확인 없는 패키지 추가(`02-system-architecture.md` §3 밖)·코어 버전 변경
9. 주석 처리된 옛 코드, 쓰지 않는 파일
10. 기능 변경과 구조 리팩토링을 한 커밋에 섞기
11. 도메인 메서드 안에서 현재 시각·난수·DB·HTTP 직접 호출
12. (도전 A 적용 후) 방 변경 요청에서 `find_by_id`(잠금 없음) 사용 (CONV-08)
13. 게임 결과·승패를 저장하는 테이블·필드·API (INV-09)

## 5. AGENTS.md
저장소 루트 `AGENTS.md`의 `## 디렉토리 지도`를 이 문서 기준으로 갱신했다.

## 6. 스타일 기준 (UX 단계 미사용, D-019)

- 토큰은 `src/static/css/app.css`의 `:root` CSS 변수로만 정의한다. 템플릿·다른 CSS는 `var(--…)`로만 쓴다(직접 쓴 색·간격·인라인 스타일 금지).
- 아래는 토큰 **이름과 역할**이다. **값은 FE가 TKT-FE-M5-01에서 정하고** 브리핑 "구현 중 자율 결정"에 기록한다(D-019). 본문 글자와 배경의 대비는 4.5:1 이상으로 한다.

| 토큰 | 역할 |
|---|---|
| `--color-bg`, `--color-surface` | 페이지 배경, 카드·표 배경 |
| `--color-text`, `--color-text-muted` | 본문, 보조 문구(생성 시각 등) |
| `--color-border` | 표·입력칸 테두리 |
| `--color-primary`, `--color-on-primary` | 주요 버튼(만들기·참가·게임 시작)과 그 위 글자 |
| `--color-danger`, `--color-success`, `--color-notice` | 거부·오류 안내, 성공 안내, 일반 안내(해산 등) |
| `--color-disabled` | 비활성 버튼(정원 마감 등) |
| `--color-team-a`, `--color-team-b` | A팀·B팀 영역 구분 |
| `--space-1`~`--space-4` | 간격 4단계(작은 값부터) |
| `--radius` | 모서리 둥글기 |
| `--font-body`, `--font-size-sm`, `--font-size-base`, `--font-size-lg` | 글꼴, 글자 크기 3단계 |
| `--focus-ring` | 키보드 포커스 표시 |

- 토큰을 추가해야 하면 FE가 같은 파일에 추가하고 브리핑에 적는다. 역할이 위 표와 겹치는 토큰은 만들지 않는다.

## 7. 스택 주의 (구현자가 흔히 틀리는 점)

| ID | 대상 | 주의 |
|---|---|---|
| STK-01 | import 경로 | 실행이 `--app-dir src`라서 import는 `src.` 없이 쓴다(`from rooms.domain.room import Room`). pytest도 같게 하려고 `pyproject.toml`에 `[tool.pytest.ini_options] pythonpath = ["src"]`를 둔다. |
| STK-02 | 비동기 lazy loading | AsyncSession에서 관계 속성을 지연 로딩하면 `MissingGreenlet` 오류가 난다(교안 5장 2강). `RoomModel.participations`·`ParticipationModel.room`·`ParticipationLogModel.room`은 쿼리에 `options(selectinload(...))`를 붙여 **미리** 읽는다. 세션에 이미 있는 객체에는 연쇄 `selectinload`가 안 채워질 수 있으므로 다른 기능의 모델(회원 닉네임)은 `session.get`으로 읽는다. |
| STK-03 | `FOR UPDATE`와 조인 (도전 A) | PostgreSQL은 outer join의 nullable 쪽에 `FOR UPDATE`를 걸 수 없다. `find_by_id_for_update`는 `select(RoomModel).where(...).with_for_update()`로 방 행만 잠그고, 참가자는 별도 쿼리로 읽는다. |
| STK-04 | 복합 PK·현재 참가 삭제 (ADR-011) | `participations`는 `room_id`·`user_id` 두 컬럼에 `primary_key=True`를 주고 `user_id`에 `unique=True`를 더한다. `RoomModel.participations`는 `cascade="all, delete-orphan"`이라 목록에서 `remove`하면 flush 때 행이 지워진다(로그 INSERT를 먼저 `session.add`). `create_all`은 이미 있는 테이블을 고치지 않으므로 개발 DB를 지우고 다시 만든다. |
| STK-05 | 제목 검색 | 목록을 읽은 뒤 파이썬에서 `keyword.lower() in title.lower()`로 거른다(교안 2·3장, D-020). `%`·`_`도 일반 글자로 비교된다. |
| STK-06 | 시각 | 컬럼은 `DateTime(timezone=True)`이고 읽으면 UTC aware 값이다. 비교·저장하는 값도 `datetime.now(UTC)`(aware)만 쓴다. naive 값과 섞으면 오류가 난다. |
| STK-07 | bcrypt | passlib 1.7.4는 bcrypt 4.1 이상에서 버전 감지 경고, 5.x에서 오류가 난다. `bcrypt==4.0.1`을 바꾸지 않는다(ADR-002). |
| STK-08 | 로그인 폼 | `OAuth2PasswordRequestForm`은 `python-multipart`가 필요하다. 필드 이름은 `username`이며 값은 아이디다. |
| STK-13 | 스키마 변경과 개발 DB | `create_all`은 이미 있는 테이블을 고치지 않는다. D-020·D-021로 `token_blacklist` 컬럼이 바뀌었으므로 기존 개발 DB는 테이블을 지우고 다시 만든다(제약·인덱스 제거는 남아 있어도 동작에 지장 없음). |
| STK-09 | 템플릿 응답 | 최신 Starlette는 `templates.TemplateResponse(request, "rooms/list.html", context)` 순서다(예전 `{"request": request}` 방식은 쓰지 않는다). `.html` 템플릿은 자동 이스케이프가 켜져 있다. |
| STK-10 | 설정 파일 | pydantic-settings의 `env_file=".env"`는 실행한 작업 디렉토리 기준이다. 서버·테스트는 저장소 루트에서 실행한다. `Settings`는 `extra="ignore"`로 테스트용 변수(`TEST_DATABASE_URL`)를 무시한다. |
| STK-11 | 비동기 테스트 루프 | 엔진·세션 fixture와 테스트가 같은 이벤트 루프를 써야 한다. `[tool.pytest.ini_options]`에 `asyncio_mode = "auto"`, `asyncio_default_fixture_loop_scope = "session"`을 두고, 테스트 모듈은 `pytestmark = pytest.mark.asyncio(loop_scope="session")`을 쓴다. |
| STK-12 | 엔진 정리 | lifespan 종료 시 `await engine.dispose()`. 테스트는 앱 엔진 대신 `TEST_DATABASE_URL` 엔진을 `dependency_overrides`로 주입한다. |

## 8. 교안 수준 규칙 (D-020, DB·BE·FE 공통)

구현 코드는 수강 중인 **KANT 백엔드 교안 1~6장**(1년차 부트캠프 대상)과 그 예제 코드로 이해할 수 있는 수준으로 쓴다. 스킬 문서의 예시·기본값보다 이 절이 우선한다(AGENTS.md 규칙 7·9).

| 등급 | 기준 | 처리 |
|---|---|---|
| A | 교안 범위를 확실히 넘는 코드 | 교안 예제 수준으로 같은 결과가 나오면 교안 방식으로 쓴다. 교안에 나온 개념·기술로 같은 결과가 나오면 그것을 쓴다. 반드시 필요하지 않은 구현(도메인이 이미 검사하는 규칙의 DB CHECK, 이름 붙인 제약, 성능용 복합·조건부 인덱스, 드라이버 예외 속성 파싱 등 중복 방어선)은 넣지 않는다 |
| B | 교안에는 없지만 조금 공부하면 이해할 수 있는 문법 | 써도 된다: `@dataclass`(`frozen`, `__post_init__`), `StrEnum`, `@property`, `typing.Protocol`, `Callable` 주입, `dataclasses.replace`, pydantic-settings `BaseSettings`, 예외 클래스 계층, `RequestValidationError` 핸들러, `select(exists().where(...))` |
| C | 인증·보안 | 교안 6장 1강 설계를 따른다(ADR-002, D-021) |

교안에 나오는 기술(이 목록 안에서 해결되면 A로 보지 않는다):

| 장 | 기술·개념 |
|---|---|
| 1장 | uv(`init`·`add`·`run`), uvicorn 옵션, `logging.basicConfig`·`getLogger`, `async def` 엔드포인트, HTTP 메서드(GET·POST·PUT·DELETE), `Body`, `HTTPException`·`status`, 순수 도메인 클래스(생성자 검증 + `ValueError`, 상태 변경 메서드, `to_dict`), 쿼리 문자열 필터·정렬(파이썬 리스트) |
| 2장 | 타입 힌트·`typing`(`List`·`Optional`·`Dict`·`Union`·`Literal`·`Generic`·`TypeVar`), Pydantic `BaseModel`·`Field`(`min_length`·`max_length`·`gt`·`ge`·`le`·`description`), `field_validator`·`model_validator`, 중첩 모델, `model_dump(exclude_unset=True)`, `response_model`, 제네릭 응답 모델, `FastAPI(title, description, version)`, `lifespan`(`asynccontextmanager`) |
| 3장 | `Path`·`Query`(`alias`, 제약), `Annotated`, `HTTPException(headers=...)`, 커스텀 예외 + `@app.exception_handler` + `JSONResponse`, 목록 `offset`·`limit` 슬라이싱, `Jinja2Templates`·`TemplateResponse(request=, name=, context=)`, `{% extends %}`·`{% block %}`·`{% include %}`·`{% macro %}`·필터, `StaticFiles`·`url_for`, `Form` |
| 4장 | `APIRouter(prefix, tags, dependencies)`·`include_router`, `Depends`·`Header` 의존성, `@app.middleware("http")`(전처리·`call_next`·후처리, 처리 시간 헤더), `add_middleware`·등록 순서, `TrustedHostMiddleware`, `UploadFile`·`File`, `BackgroundTasks.add_task`, `StreamingResponse`(async 제너레이터), `aiofiles` |
| 5장 | docker-compose PostgreSQL, `create_async_engine`(`pool_size`·`max_overflow`·`pool_timeout`·`pool_recycle`·`pool_pre_ping`), `async_sessionmaker(expire_on_commit=False)`, `DeclarativeBase`, `get_db`(yield·rollback·close), `Mapped`·`mapped_column`(`primary_key`·`nullable`·`unique`·`index`·`server_default`·`String`·`Integer`·`Boolean`), `ForeignKey(ondelete=)`, `relationship(back_populates, cascade, uselist, secondary)`, `select().where().offset().limit()`, `db.get`, `scalars().all()`·`scalar_one_or_none()`, `add`·`flush`·`commit`·`refresh`·`delete`, `joinedload`·`selectinload`(N+1), `with_for_update()`, `engine.begin()`+`run_sync(create_all)`, `engine.dispose()`, `from_attributes` |
| 6장 | 인증·인가, bcrypt(passlib `CryptContext`, `bcrypt==4.0.1`), JWT(pyjwt `encode`·`decode`, `ExpiredSignatureError`·`InvalidTokenError`), access·refresh 토큰과 `token_type`, `OAuth2PasswordBearer`·`OAuth2PasswordRequestForm`, `get_current_user` 의존성, `WWW-Authenticate` 헤더, 블랙리스트 로그아웃·`/refresh` |
| 7장(발제) | 도메인 중심 4계층(presentation·application·domain·infrastructure), 레포지토리(ORM ↔ 도메인 변환), 서비스의 commit, CORS·캐싱 미들웨어, 배포 — 교안 링크에는 아직 없지만 발제(`kant-rubric.md` §2·§4)가 요구하므로 A로 보지 않는다 |

- FE(Jinja2·JS): 교안 3장 템플릿 문법을 쓴다. JS는 교안에 없으므로 `fetch`·`localStorage`·`setInterval`·DOM 조작 정도로 단순하게 쓰고 외부 라이브러리·번들러는 쓰지 않는다.
- 판단이 애매하면 교안 방식으로 쓰고 브리핑 "구현 중 자율 결정"에 적는다. 교안 방식으로 같은 결과를 낼 수 없으면 추측하지 말고 사용자에게 확인한다(AGENTS.md 규칙 7).
