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
│   │   ├── domain/        __init__.py, room.py, participation.py, exceptions.py
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
│   ├── unit/              test_room.py, test_participation.py, test_user.py        # DB 없음
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

기능 간: rooms.presentation ──▶ auth.presentation.dependencies (get_current_user_id, get_page_user_id)
         rooms.presentation(pages) ──▶ auth.application.service (get_user: 머리글 닉네임)
         rooms.infrastructure.repositories(RoomQueryRepository) ──▶ auth.infrastructure.models (UserModel 조인)
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
| CONV-09 | 쿠키: `access_token`, `httponly=True`, `samesite="lax"`, `secure=settings.cookie_secure`, `path="/"`. 상태 변경은 JSON `fetch`로만 보낸다(ADR-002). |
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
