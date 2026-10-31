# B 파트 작업계획표 — 인증 전체

> 기준: `origin/dev`의 `docs/work-assignment.md`(D-026 반영본, B ≈ 670), `docs/01-pm/`·`docs/02-arch/`, 참고 구현 `reference/agent-pipeline-blueprint`
> 교안: [백엔드 아키텍처 & API 설계 실습 모음](https://charmed-watch-60f.notion.site/API-405566040df880fbbe34c039dd0f281d) — 아래 표의 "교안"은 `장-강 / 문제 번호`로 적었어요

---

## 0. 시작 전에 확인할 것

| 확인 | 내용 |
|---|---|
| 최신 `dev` 받기 | `git pull`로 `origin/dev`(D-026 수동 새로고침 반영본)를 받은 뒤 브랜치를 만들어요. `dev`에 직접 커밋하지 않아요(README 브랜치 규칙) |
| 내 파일 실제 위치 | 분담표에는 `templates/auth/…`, `static/js/api.js`로 적혀 있지만 실제 경로는 **`src/templates/auth/login.html`·`signup.html`, `src/static/js/api.js`**예요. `src/auth/` 아래 11개 파일(`__init__.py` 제외)이 모두 B 담당이에요 |
| 이미 채워진 파일 | `src/auth/**/__init__.py`는 A 담당이고 이미 비어 있는 채로 완성돼 있어요. 손대지 않아요 |
| 내 파일만 수정 | `main.py`·`base.html`·`partials/*`·`app.css`는 A 파일이에요. 라우터 등록은 **변수 이름만 A에게 알려 주고** A가 해요(분담표 §4) |
| 교안 수준 규칙 | `docs/02-arch/05-structure-conventions.md` §8(D-020). 인증·보안은 **교안 6장 1강 설계 그대로**(등급 C, ADR-002, D-021). 쿠키·`jti`·만료 행 정리는 쓰지 않아요 |
| 시그니처 고정 | 이름·시그니처는 `docs/02-arch/04-interfaces-api.md`(§1.2·§2.1·§2.2·§3·§4.1·§5.1·§7·SEQ-01~04b)와 `03-db-schema.md` §3.1·§3.2·§5가 정답이에요. 바꿔야 하면 혼자 바꾸지 말고 팀에 먼저 말해요 |
| 최신 결정 영향 | D-025/ADR-011(참가·로그 분리)은 B에 **바뀐 것 없음**(분담표 §6). D-026/ADR-012는 `api.js`에 자동 조회(`setInterval`·반복 `setTimeout`) 유틸을 **두지 않는다**는 뜻이에요 |

## 1. 전체 순서 한눈에 보기

```
[1일차 오전: 이름 먼저 공유 — 다른 파트가 기다리지 않게]
  ① 연결 이름 공유(get_current_user_id, 라우터 변수, 모델 경로, api.js 함수·DOM ID)
  ② auth/domain/exceptions.py → ③ user.py·token_blacklist.py → PR①
     (A PR①의 exceptions.py가 머지되면 바로 import 확인)

[1일차 오후~: A의 config·database 머지 후]
  ④ security.py → ⑤ models.py → ⑥ repositories.py → PR②
     (D의 UserModel import, A의 seed·create_all이 이걸 기다려요)

[2일차: 인증 흐름]
  ⑦ application/service.py → ⑧ presentation/dependencies.py → PR③
     (E의 rooms 라우터 11개가 get_current_user_id를 기다려요)
  ⑨ schemas.py·router.py → PR④ → A에게 router 등록 요청

[A의 base.html·partials 머지 후]
  ⑩ static/js/api.js → PR⑤ (C·E 화면 JS가 이 함수들을 불러요)
  ⑪ pages.py + auth/login.html·signup.html → PR⑥ → A에게 page_router 등록 요청

[마지막]
  ⑫ 통합 점검(AC-08~11·AC-17-1, GATE-02·05·06·07·08)
```

## 2. 단계별 계획

### ① 연결 이름 공유 (코드 없음, 팀 채널) — 1일차 오전

| 항목 | 내용 |
|---|---|
| 할 일 | 다른 파트가 import·호출할 이름을 먼저 확정해 공지해요(분담표 §5-3 "B: `get_current_user` 의존성의 이름과 반환값 먼저 공유") |
| 공유할 것 | **E**: `from auth.presentation.dependencies import get_current_user_id` → `async def get_current_user_id(user: User = Depends(get_current_user)) -> int` / **A**: `auth.presentation.router.router`, `auth.presentation.pages.page_router`, 모델 모듈 `auth.infrastructure.models`(create_all 등록용), 시드용 `User.register(login_id, nickname, hashed_password)`·`UserRepository(session).exists_login_id(login_id)`·`.save(user)`·`PasswordHasher().hash(raw)` / **D**: `from auth.infrastructure.models import UserModel`(닉네임 조회용 `session.get(UserModel, user_id)`) / **C·E**: `api.js` 공개 함수 목록(⑩ 표) |
| 참고 | `work-assignment.md` §4·§5, `04-interfaces-api.md` §3·SEQ-03, `05-structure-conventions.md` §2(기능 간 의존: rooms → `auth.presentation.dependencies`, `RoomQueryRepository` → `auth.infrastructure.models`), blueprint `src/main.py`·`src/seed.py`·`src/rooms/infrastructure/repositories.py`·`src/rooms/presentation/router.py`의 import 줄 |
| 유의 | 반대 방향(`auth` → `rooms`) import는 금지예요(GATE-02 세 번째 명령). DOM ID는 A가 만들고 B의 `api.js`가 직접 만지므로 A와 **같은 표**를 봐요(⑩) |

### ② `src/auth/domain/exceptions.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `DomainRuleError`를 상속한 예외 7개: `InvalidLoginIdError`, `InvalidNicknameError`, `InvalidPasswordError`, `DuplicateLoginIdError`, `DuplicateNicknameError`, `InvalidRefreshTokenError`, `AlreadyLoggedOutError`. 각 `__init__`에서 `super().__init__("<고정 문구>")` |
| 참고 | 교안 1-2 필수2(도메인 클래스 + `ValueError`), 3-1 심화1(ValueError 전역 처리), 7-1 필수1 / `04-interfaces-api.md` §1.2(문구 표), D-015, blueprint `src/auth/domain/exceptions.py` |
| 유의 | `from exceptions import DomainRuleError`만 import해요(`src.` 없이, STK-01). 문구는 §1.2 표와 **글자 하나까지** 같게(테스트가 `detail`을 비교). 401용 `AuthenticationError`는 여기 만들지 않고 A의 `src/exceptions.py`를 그대로 써요(부모가 `Exception`이라 `DomainError` 계층이 아님). 403 예외는 만들지 않아요(D-015) |
| 완료 확인 | `uv run python -c "import sys; sys.path.insert(0,'src'); from auth.domain.exceptions import AlreadyLoggedOutError as E; print(E().message)"` |

### ③ `src/auth/domain/user.py`, `src/auth/domain/token_blacklist.py` → PR①

| 항목 | 내용 |
|---|---|
| 할 일 | `@dataclass class User(id, login_id, nickname, hashed_password, created_at=None)` + `@classmethod register(login_id, nickname, hashed_password) -> User` + `@staticmethod validate_raw_password(raw) -> None`. `@dataclass(frozen=True) class TokenBlacklist(token: str)` + `__post_init__`에서 빈 문자열이면 `ValueError` |
| 참고 | 교안 1-2 필수2(유효성 검사 포함 도메인 모델), 6-1 필수1(유저 모델), 7-1 필수1(순수 도메인 규칙) / `04-interfaces-api.md` §2.1·§2.2, `docs/01-pm/03-domain.md`(INV-13·14), blueprint `src/auth/domain/user.py`·`token_blacklist.py` |
| 유의 — 규칙 | 아이디 `^[a-z0-9]{4,20}$`(대문자 거부, AC-08-2), 닉네임은 **`strip` 후** `^[가-힣A-Za-z0-9]{2,12}$`이고 다듬은 값을 저장, 비밀번호 `len < 8` → `InvalidPasswordError`. 참고 구현은 `re.compile(...)` + `fullmatch`를 써요. `register`는 `id=None`으로 만들어요 |
| 유의 — 격리 | 표준 라이브러리(`dataclasses`·`datetime`·`re`)와 `auth.domain`만 import(GATE-02 첫 명령, 금지 패턴 1). `datetime.now()` 호출 금지(GATE-07). 해시는 도메인이 하지 않고 **해시된 값**을 받아요 |
| 완료 확인 | `uv run ruff check src`, GATE-02 첫 명령 출력 0줄. PR①은 C·D·E와 무관하지만 A의 seed(⑨)가 `User.register`를 써요 |

### ④ `src/auth/infrastructure/security.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `class PasswordHasher`: `hash(raw) -> str`, `verify(raw, hashed) -> bool`(passlib `CryptContext(schemes=["bcrypt"], deprecated="auto")`). 함수 `create_access_token(data: dict) -> str`, `create_refresh_token(data: dict) -> str`, `decode_token(token: str) -> dict`, 상수 `ALGORITHM = "HS256"` |
| 참고 | 교안 6-1 필수2(JWT 발급·만료), 6장 1강 3.3절 / `04-interfaces-api.md` §3 아래 "인증 보조" 문단, ADR-002, D-021, STK-07, CONV-06, blueprint `src/auth/infrastructure/security.py` |
| 유의 | 페이로드는 `data.copy()`에 `exp`(`datetime.now(UTC) + timedelta(...)`)와 `token_type`(`"access"`/`"refresh"`)을 더해 `jwt.encode(..., get_settings().jwt_secret_key, algorithm=ALGORITHM)`. 만료 값은 `get_settings().access_token_expire_minutes`·`refresh_token_expire_days`(A의 `config.py`). `decode_token`은 **예외를 잡지 않고** pyjwt `ExpiredSignatureError`·`InvalidTokenError`를 그대로 올려요(서비스가 바꿈). `datetime.now(UTC)`는 이 파일과 서비스 `clock`에서만 허용(CONV-06). 비밀키 하드코딩 금지(GATE-06). `bcrypt==4.0.1`은 바꾸지 않아요(STK-07) |
| 유의 — 문서 차이 | ADR-002 본문은 교안처럼 `hash_password()`·`verify_password()` 함수 이름을 쓰지만(“`PasswordHasher` 클래스로 감싸도 됨”), 스켈레톤·`04-interfaces-api.md` §3·A의 seed는 **`PasswordHasher().hash`·`.verify`** 를 써요. 이 이름으로 만들어요 |
| 진행 팁 | `PasswordHasher`는 설정이 필요 없어서 A PR① 전에 먼저 써도 돼요. 토큰 함수 3개는 `config.get_settings()`가 머지된 뒤 확인해요 |
| 완료 확인 | 셸에서 `decode_token(create_access_token({"sub": "seed01"}))["token_type"] == "access"`, `PasswordHasher().verify("pw123456", PasswordHasher().hash("pw123456"))` 참 |

### ⑤ `src/auth/infrastructure/models.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `UserModel(Base)` — `__tablename__ = "users"`: `id`(PK), `login_id String(20) unique`, `nickname String(12) unique`, `hashed_password String(255)`, `created_at DateTime(timezone=True) server_default=func.now()`. `TokenBlacklistModel(Base)` — `"token_blacklist"`: `id`(PK), `token String(500) index=True`, `created_at` 같은 방식 |
| 참고 | 교안 5-1 필수1(관계 매핑 모델), 6-1 필수1(유저 모델), 7-1 필수2(SQLAlchemy 2.0 모델) / `03-db-schema.md` §3.1·§3.2, CONV-01, STK-06, blueprint `src/auth/infrastructure/models.py` |
| 유의 | `from database import Base`(A의 `database.py`). 모든 컬럼 `nullable=False`. `token_blacklist`만 단수 테이블 이름이에요(CONV-01 예외). 교안 5장 옵션만 쓰고 CHECK·이름 붙인 제약은 넣지 않아요(D-020). D의 `rooms`·`participations`·`participation_logs`가 `ForeignKey("users.id")`를 걸기 때문에 **이 파일이 없으면 D의 모델이 flush·create_all 때 실패**해요 |
| 완료 확인 | A의 `main.py`에 `import auth.infrastructure.models`가 들어간 뒤 기동 → `\d users`, `\d token_blacklist` 확인. 모델을 바꾸면 개발 DB를 지우고 다시 만들어요(STK-13) |

### ⑥ `src/auth/infrastructure/repositories.py` → PR②

| 항목 | 내용 |
|---|---|
| 할 일 | `UserRepository(session)`: `find_by_id(user_id) -> User \| None`, `find_by_login_id(login_id) -> User \| None`, `exists_login_id(login_id) -> bool`, `exists_nickname(nickname) -> bool`, `save(user) -> User`, `_to_domain(model)`, `_to_model(user)`. `TokenBlacklistRepository(session)`: `exists(token) -> bool`, `save(entry: TokenBlacklist) -> None` |
| 참고 | 교안 7-1 필수2(레포지토리 패턴), 5-2 필수2(AsyncSession CRUD), 5-1(`add`·`flush`·`refresh`·`scalar_one_or_none`) / `03-db-schema.md` §5(표 첫 두 행과 아래 문단), `04-interfaces-api.md` §8, 금지 패턴 3, blueprint `src/auth/infrastructure/repositories.py` |
| 유의 — 경계 | **`flush`만 하고 commit하지 않아요**(서비스가 commit). 밖으로는 도메인 `User`만 돌려주고 `UserModel`은 내보내지 않아요(GATE-08). `exists_*`는 `select(exists().where(...))`(§8 등급 B 허용) + `session.scalar` |
| 유의 — `save` | 새 회원은 `session.add` → `flush` → **`session.refresh(model)`** 로 DB가 채운 `id`·`created_at`을 다시 읽어 `_to_domain`해요. `refresh`를 빠뜨리면 `created_at`이 비어 `UserResponse` 변환이 500이 돼요 |
| 유의 — 문서 차이 | HANDOFF TKT-DB-M3-01은 "중복 아이디·닉네임 `IntegrityError` → `Duplicate*Error`"라고 적었지만, `03-db-schema.md` §5와 SEQ-01은 **"레포지토리는 `IntegrityError`를 바꾸지 않는다(동시 가입 중복은 500, D-018·D-020)"**예요. HANDOFF 머리말대로 설계 문서를 따라 변환하지 않아요 |
| 완료 확인 | GATE-02, GATE-08 출력 0줄. PR② 머지 후 팀 공지 → D(`UserModel`), A(⑧ 모델 import, ⑨ seed) 진행 가능 |

### ⑦ `src/auth/application/service.py`

| 항목 | 내용 |
|---|---|
| 할 일 | `AuthApplicationService(db: AsyncSession)` — 생성자에서 `UserRepository(db)`, `TokenBlacklistRepository(db)`, `PasswordHasher()`를 만들어 둬요. 메서드 5개: `signup(login_id, nickname, password) -> User`, `login(login_id, password) -> dict`, `refresh(refresh_token) -> dict`, `logout(access_token, refresh_token) -> None`, `authenticate(token) -> User` |
| 참고 | 교안 6-1 필수2(발급·블랙리스트·재발급·로그아웃), 7-1 필수3(응용 서비스의 commit) / `04-interfaces-api.md` §3 표 첫 행, §8, SEQ-01·02·03·04·04b, ADR-002, blueprint `src/auth/application/service.py` |
| 유의 — 순서(테스트 고정) | **signup**: `validate_raw_password` → `exists_login_id` → `exists_nickname`(참고 구현은 `nickname.strip()`으로 확인) → `hash` → `User.register` → `save` → **commit**. **login**: 회원 없음과 비밀번호 틀림이 **같은** `AuthenticationError("아이디 또는 비밀번호가 올바르지 않습니다")`(AC-09-2), `sub`는 `login_id`. **refresh**: 블랙리스트 먼저 → "로그아웃 처리되어 사용할 수 없는 토큰입니다" / 해독 실패·`token_type != "refresh"`·`sub` 없음 → "리프레시 토큰이 만료되었습니다. 다시 로그인하세요". **logout**: refresh 해독 실패 → `InvalidRefreshTokenError`(400) → 이미 차단 → `AlreadyLoggedOutError`(400) → access·refresh **두 토큰 모두** 저장 → commit. **authenticate**: 해독 실패 → `token_type == "refresh"` → `sub` 없음 → 블랙리스트 → 회원 없음, 모두 `AuthenticationError("인증 토큰이 올바르지 않거나 로그인이 만료되었습니다")` |
| 유의 — 규칙 | pyjwt 예외는 `except (ExpiredSignatureError, InvalidTokenError) as error: raise ... from error`로만 바꿔요(빈 `except:` 금지, GATE-07). 조회 흐름(login·refresh·authenticate)은 commit하지 않아요. 로그아웃은 참가 상태를 건드리지 않아요(AC-10-3) |
| 완료 확인 | GATE-07, GATE-08 출력 0줄 |

### ⑧ `src/auth/presentation/dependencies.py` → PR③

| 항목 | 내용 |
|---|---|
| 할 일 | `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")`, `async def get_current_user(token = Depends(oauth2_scheme), db = Depends(get_db)) -> User`(→ `AuthApplicationService(db).authenticate(token)`), `async def get_current_user_id(user = Depends(get_current_user)) -> int`(→ `user.id`) |
| 참고 | 교안 6-1 필수2·심화1(권한 판별 의존성), 4-1 필수2·심화1(공통 의존성·`Depends`) / `04-interfaces-api.md` SEQ-03, ADR-002, CONV-09, blueprint `src/auth/presentation/dependencies.py` |
| 유의 | `tokenUrl`은 앞에 `/`를 붙인 `"/api/auth/token"`(Swagger Authorize가 이 주소로 로그인). 헤더가 없으면 FastAPI가 기본 401(`"Not authenticated"`)을 내요. 쿠키는 읽지 않아요(D-021). `from database import get_db`(A) |
| 유의 — 문서 차이 | HANDOFF TKT-BE-M3-04는 rooms 라우터가 먼저 나오도록 `X-Debug-User-Id` 헤더를 읽는 **임시** `get_current_user_id`를 두고 TKT-BE-M4-03에서 지우게 돼 있어요. 5인 분담에서는 ①에서 이름을 먼저 공유하고 이 PR③을 빨리 머지하는 게 기본이에요. E가 먼저 필요하면 임시판을 쓸 수 있지만, 그 경우 **PR③에서 `grep -rn "X-Debug-User-Id" src/` 0줄**을 꼭 확인해요 |
| 완료 확인 | PR③ 머지 후 E에게 공지. (⑨ 이후) 로그아웃한 access 토큰으로 `/api/auth/me` → 401 |

### ⑨ `src/auth/presentation/schemas.py`, `src/auth/presentation/router.py` → PR④

| 항목 | 내용 |
|---|---|
| 할 일 — 스키마 | 공통 부모 `model_config = ConfigDict(from_attributes=True)`. `SignupRequest(login_id max 50, nickname max 50, password max 128)`, `UserResponse(id, login_id, nickname, created_at)`, `TokenResponse(access_token, refresh_token, token_type="bearer")`, `RefreshRequest(refresh_token)`, `AccessTokenResponse(access_token, token_type="bearer")`, `MessageResponse(message)`. 모든 필드에 `Field(..., description=...)` |
| 할 일 — 라우터 | `router = APIRouter(prefix="/api/auth", tags=["auth"])`, 팩토리 `get_auth_service(db = Depends(get_db))`. `POST /signup`, `POST /token`(`OAuth2PasswordRequestForm = Depends()`), `POST /logout`(`RefreshRequest` + `token = Depends(oauth2_scheme)` + `Depends(get_current_user)`), `GET /me`, `POST /refresh`. 응답 문구 `"로그아웃되었습니다"` |
| 참고 | 교안 2-2 필수1(`response_model`), 2-1(Field 제약), 4-1 필수1(APIRouter), 6-1 필수2(`/token`·`/refresh`·`/logout`), 7-1 심화1(표현 계층) / `04-interfaces-api.md` §4.1(summary 문구 5개)·§5.1, CONV-03·04·05, STK-08, blueprint `src/auth/presentation/schemas.py`·`router.py` |
| 유의 | 형식 규칙(길이·문자)은 **스키마가 아니라 도메인**이 검사해 400을 내요. 스키마 `max_length`는 비정상 입력 방어(422)뿐이에요(§5.1 아래 문단). `UserResponse`에 `hashed_password` 금지(GATE-07, 금지 패턴 7). 별칭(camelCase) 없이 snake_case. 라우터에서 `try/except`로 HTTP 변환하지 않아요(CONV-05, 전역 핸들러는 A). 로그인 폼 필드 이름은 `username`이고 값은 아이디(STK-08). 모든 API에 `summary`·`response_model`(CONV-03) |
| 완료 확인 | A가 `app.include_router(auth_router)`를 넣은 뒤 Swagger에 auth 5개, Authorize로 로그인 성공, 잘못된 비밀번호 401 + `WWW-Authenticate: Bearer`, 중복 아이디 400 `{"detail": "이미 사용 중인 아이디입니다"}` |

### ⑩ `src/static/js/api.js` → PR⑤

| 항목 | 내용 |
|---|---|
| 할 일 | 토큰 저장(`localStorage` 키 `access_token`·`refresh_token`), 공통 호출 `apiRequest(method, url, body)` → `{ ok, status, data }`, 401이면 `/api/auth/refresh`로 **한 번** 재발급 후 재시도 → 그래도 401이면 토큰 삭제 후 `/login?expired=1`. 로그인·로그아웃·안내 문구·머리글·페이지 이동 도우미 |
| 공개 함수(다른 사람이 부름) | `apiRequest`, `errorMessage(result)`, `showNotice(message, kind)`(`kind`: `"error"`·`"success"`·없음), `hideNotice()`, `formatTime(isoText)`(→ `"MM-DD HH:mm"`), `renderPagination(nav, page, size, total, makeHref)`, `getAccessToken()`, `loginWithPassword(loginId, password)`, `logout()`. 내부: `saveTokens`, `clearTokens`, `goToLogin(expired)`, `requireLogin()`, `refreshAccessToken()`, `sendOnce`, `initHeader()` |
| 참고 | 교안 3-2 필수1(정적 파일). JS 자체는 교안에 없어요 → `fetch`·`localStorage`·DOM 조작만(§8 FE 규칙) / `04-interfaces-api.md` §7 "정적 파일" 문단, ADR-002 "화면", CONV-09, `07-screens.md` §2, AC-11-3, blueprint `src/static/js/api.js` |
| 유의 — A와 맞출 DOM | `#notice`(`showNotice`·`hideNotice`), `#pagination`(`renderPagination`에 넘기는 `nav`), `#nav-member`·`#nav-guest`·`#nav-nickname`·`#nav-logout`(`initHeader`·로그아웃 버튼), `body[data-require-login="true"]`(→ `requireLogin`). 머리글 두 묶음은 `hidden`으로 시작하고 `api.js`가 하나만 켜요. `DOMContentLoaded`에서 로그아웃 버튼 연결 → 로그인 필요 화면 검사 → `initHeader()` |
| 유의 — 함정 | 로그인(`loginWithPassword`)과 재발급(`refreshAccessToken`)은 `apiRequest`가 아니라 **직접 `fetch`**(로그인 실패 401이 `/login?expired=1`로 튕기거나 재발급이 재귀하지 않게). 로그인은 JSON이 아니라 `URLSearchParams` 폼(`username`, `password`). 사용자 문자열은 `textContent`로만 넣고 `innerHTML` 금지(RISK-10). 통신 실패 문구 "최신 정보를 불러오지 못했습니다". 자동 조회 코드 금지(D-026, `grep -rnE "setInterval\|polling" src/static src/templates` 0줄) |
| 유의 — 문서 차이 | HANDOFF TKT-FE-M5-01은 `api.js`를 `base.html`·`partials`·`app.css`와 한 티켓(FE)에 묶었지만, 분담표에서는 `api.js`만 B예요. 그래서 DOM ID를 A와 따로 맞춰야 해요 |
| 완료 확인 | 토큰 없이 `/`(C·E 화면 완성 전이면 `/login`에서 콘솔로 `requireLogin()`) → `/login` 이동. 개발자 도구에서 `access_token`을 망가뜨린 뒤 API 호출 → 재발급 1회 후 성공. refresh까지 지우면 `/login?expired=1` |

### ⑪ `src/auth/presentation/pages.py` + `src/templates/auth/login.html`·`signup.html` → PR⑥

| 항목 | 내용 |
|---|---|
| 할 일 — 라우트 | `page_router = APIRouter(include_in_schema=False)`, `templates = Jinja2Templates(directory=Path(__file__).resolve().parents[2] / "templates")`. `GET /signup` → `auth/signup.html`(컨텍스트 없음), `GET /login`(쿼리 `expired: int \| None = None`) → `auth/login.html`, `expired == 1`이면 `notice = "로그인이 만료되었습니다. 다시 로그인해 주세요"` |
| 할 일 — 템플릿 | 둘 다 `{% extends "base.html" %}`, `{% block require_login %}false{% endblock %}`, `title`·`content`·`scripts` 블록. 로그인: `#login-form`, `#login_id`(name `username`), `#password`, `#login-button` → `loginWithPassword` 성공 시 `/`. 회원가입: `#signup-form`, `#login_id`, `#nickname`, `#password`, `#signup-button` → `apiRequest("POST", "/api/auth/signup", …)` 성공 시 `/login`. 규칙 안내 `<p class="muted">` |
| 참고 | 교안 3-2 필수1(레이아웃 분리·`{% extends %}`), 3-2 필수2(폼 + GET 화면), 3-1 필수1(Query) / `04-interfaces-api.md` §7 PAGE-01·02, `07-screens.md` §4(SCR-01·02), AC-17-1, CONV-12, STK-09, blueprint `src/auth/presentation/pages.py`·`src/templates/auth/*.html` |
| 유의 | 화면 라우트는 **인증하지 않아요**(D-021). 실패 시 `showNotice(errorMessage(result), "error")`, 비밀번호만 지우고 아이디·닉네임은 유지(AC-17-1), 제출 중 버튼 비활성. 공통 클래스는 A의 `app.css` 것(`card`, `form-field`, `muted`)만 쓰고 인라인 스타일 금지(§6). `notice`는 A의 `partials/notice.html`이 그려요 — B는 컨텍스트에 `notice`만 넘겨요. 자동 이스케이프를 끄지 않아요 |
| 유의 — 문서 차이 | STK-09는 `TemplateResponse(request, "…", context)` 위치 인자 순서를, §8 표(3장)와 참고 구현은 `TemplateResponse(request=request, name=…, context=…)` 키워드 형식을 써요. 둘 다 최신 Starlette에서 같은 동작이니 C(rooms `pages.py`)와 한쪽으로 맞춰요 |
| 완료 확인 | A가 `app.include_router(auth_page_router)`를 넣은 뒤 토큰 없이 `/signup`·`/login` 200, `/login?expired=1`에 만료 안내, 가입 실패 시 사유 표시·아이디 유지 |

### ⑫ 통합 점검 (B 범위)

| 확인 | 방법 |
|---|---|
| 인증 AC | curl/Swagger로 AC-08-1~5(가입 400 사유), AC-09-1·2(같은 401 문구), AC-10-1~3(로그아웃 → 같은 access 401, 같은 refresh 재로그아웃 400 "이미 로그아웃 처리된 토큰입니다"), AC-11-1·2·4 |
| 재발급 | `/api/auth/refresh`에 access 토큰을 넣으면 401 "리프레시 토큰이 만료되었습니다. 다시 로그인하세요", 로그아웃한 refresh는 401 "로그아웃 처리되어 사용할 수 없는 토큰입니다" |
| 구조 | GATE-02(세 명령, 특히 `auth` → `rooms` 0줄), GATE-05, GATE-06(비밀키 하드코딩 0), GATE-07(`hashed_password` 스키마 0, 빈 `except:` 0), GATE-08(`UserModel`·`TokenBlacklistModel`이 application·presentation에 0) |
| 화면 | AC-11-3(토큰 없이 `/` → `/login`), AC-17-1, 머리글 닉네임·로그아웃 동작, 시드 계정 `seed01`로 로그인(A의 seed 머지 후) |

## 3. 추천 브랜치·PR 단위

| PR | 브랜치 | 담는 것 | 머지 후 풀리는 것 |
|---|---|---|---|
| ① | `feat/auth-domain` | ②③ | A ⑨(seed의 `User.register`) |
| ② | `feat/auth-infrastructure` | ④⑤⑥ | D(`UserModel` import·`users` FK), A ⑧(모델 import)·⑨(seed) |
| ③ | `feat/auth-service-dependency` | ⑦⑧ | E(rooms 라우터의 `get_current_user_id`) |
| ④ | `feat/auth-api` | ⑨ | A ⑧(`auth_router` 등록), ⑩·⑪의 실제 동작 확인 |
| ⑤ | `feat/auth-api-js` | ⑩ | C(`history.html`·`archived.html`), E(`rooms.js`) 화면 동작 |
| ⑥ | `feat/auth-pages` | ⑪ | A ⑧(`auth_page_router` 등록), 로그인 화면으로 전체 시연 |

- 한 PR에 한 가지 작업만 담아요(README 브랜치 규칙, CONV-13). 기능 변경과 리팩토링을 섞지 않아요(금지 패턴 10).
- PR 전에 `uv run ruff check src tests`, `uv run ruff format --check src tests`(GATE-05)를 돌려요.
- PR③은 PR②에, PR②는 PR①에 기대요. 앞 PR이 리뷰 중이면 그 브랜치에서 이어 따되, 머지 순서는 ①→②→③→④를 지켜요.

## 4. 팀원과 맞출 것 체크리스트

- [ ] A: PR①(`config.py`·`database.py`·`exceptions.py`) 머지 시점 공유받기 — B ②·④·⑤가 import해요
- [ ] A: DOM ID(`notice`, `pagination`, `nav-member`·`nav-guest`·`nav-nickname`·`nav-logout`, `body[data-require-login]`)와 block 이름(`title`·`require_login`·`content`·`scripts`) 확정
- [ ] A: 공통 CSS 클래스(`card`, `form-field`, `muted`, `notice`+`error`/`success`, `pagination`) 이름 확인
- [ ] A: 라우터 변수(`auth.presentation.router.router`, `auth.presentation.pages.page_router`)와 모델 모듈(`auth.infrastructure.models`) 등록 요청
- [ ] A: seed가 쓰는 `User.register`·`UserRepository.exists_login_id`·`save`·`PasswordHasher().hash` 시그니처 확인
- [ ] D: `UserModel` import 경로와 `ForeignKey("users.id")` 대상 테이블 이름 `users` 확인
- [ ] E: `get_current_user_id`의 import 경로·반환 타입(`int`) 공유, PR③ 머지 공지
- [ ] C·E: `api.js` 공개 함수 이름·인자·반환(`{ ok, status, data }`) 공유. 401·재발급은 `apiRequest`가 처리하므로 화면 JS가 따로 하지 않음을 알림
- [ ] C: 화면 라우트의 `TemplateResponse` 호출 형식(위치 인자 / 키워드) 통일

## 5. 자주 틀리는 점 모음

1. `UserRepository.save`에서 `refresh`를 빠뜨림 → `created_at`이 비어 가입 응답이 500.
2. 로그인 실패 문구를 "아이디 없음"과 "비밀번호 틀림"으로 나눔 → AC-09-2 위반(같은 `detail`이어야 해요).
3. `authenticate`에서 `token_type == "refresh"` 확인을 빠뜨림 → refresh 토큰으로 API가 통과해요.
4. 로그아웃 때 refresh만 블랙리스트에 넣음(교안 그대로) → 로그아웃한 access가 30분 동안 통과(AC-10-2 위반, D-021).
5. `decode_token`에서 예외를 삼키거나 빈 `except:` 사용 → GATE-07 위반, 401 문구가 달라져요.
6. 서비스·레포지토리 어디서든 commit을 두 번 함 → 레포지토리는 `flush`만(§8).
7. 스키마에 아이디·닉네임 정규식을 넣음 → 400이 아니라 422가 나가 AC-08-2~4와 어긋나요.
8. `OAuth2PasswordBearer(tokenUrl="api/auth/token")`처럼 `/`를 빠뜨림 → Swagger Authorize가 엉뚱한 주소로 보내요.
9. `api.js`에서 로그인 요청을 `apiRequest`로 보냄 → 비밀번호가 틀려도 `/login?expired=1`로 튕겨요.
10. 재발급 요청을 `apiRequest`로 보냄 → 401일 때 재발급이 재귀해요.
11. 닉네임·방 제목을 `innerHTML`로 넣음 → `localStorage` 토큰이 XSS에 노출(RISK-10).
12. `auth`에서 `rooms`를 import → GATE-02 위반(의존 방향은 rooms → auth만).
13. 도메인에서 `datetime.now()`나 passlib을 부름 → 도메인 격리 위반(GATE-02·07). 해시는 서비스가 `PasswordHasher`로 해서 넘겨요.

## 6. 다른 파트와의 선후 관계

> A의 단계 번호는 `work-plan-A.md`의 ①~⑩이에요. C·D·E는 **파일·이름**으로 적었어요(HANDOFF 티켓 번호 병기). 파트별 단계 번호로 맞춘 전체 그림은 `team-work-plan.md`와 `team-dependency-diagram.html`을 보세요.

### 6.1 B가 먼저 받아야 하는 것

| 주는 파트 | 파일 · 이름 | 기다리는 B 단계 | 기다리지 않는 우회 방법 |
|---|---|---|---|
| A ④ (PR①) | `src/exceptions.py` · `DomainRuleError`, `AuthenticationError(message)` | ② 도메인 예외, ⑦ 서비스 | §1.1 표대로 import 문을 먼저 써 두고 코드 작성. 실행 확인만 A PR① 머지(반나절 목표) 뒤에 해요 |
| A ② (PR①) | `src/config.py` · `get_settings()`의 `jwt_secret_key`, `access_token_expire_minutes`, `refresh_token_expire_days` | ④ `security.py`의 토큰 함수 3개 | `PasswordHasher`(설정 불필요)를 먼저 끝내고, 토큰 함수는 이름대로 써 둔 뒤 머지 후 확인 |
| A ③ (PR①) | `src/database.py` · `Base`, `get_db` | ⑤ 모델, ⑧ 의존성, ⑨ 라우터 팩토리 | ②③④를 먼저 진행. `Base`·`get_db`는 이름만 쓰고 머지 후 실행 |
| A ⑥ (PR②) | `src/main.py` v1 · 전역 예외 핸들러(400 `DomainRuleError`, 401 `AuthenticationError` + `WWW-Authenticate`, 422 문자열) | ⑨·⑫의 오류 형식 확인 | 핸들러 전에는 상태 코드가 500으로 보여요. 정상 흐름(200)만 먼저 확인하고 오류 형식은 A PR② 뒤 확인 |
| A ⑦ (PR③) | `src/templates/base.html` · block `title`·`require_login`·`content`·`scripts`, DOM ID `#notice`·`#pagination`·`#nav-*`·`body[data-require-login]` / `partials/notice.html` / `app.css` 클래스 | ⑩ `api.js`, ⑪ 로그인·회원가입 템플릿 | ①에서 참고 구현 이름으로 **합의만 먼저** 하고 그 이름으로 작성. 브라우저 확인은 A PR③ 머지 후 |
| A ⑧ (PR④) | `src/main.py` v2 · `include_router(auth_router)`, `include_router(auth_page_router)`, `import auth.infrastructure.models` | ⑨ Swagger 확인, ⑪ 화면 확인, ⑤ 테이블 생성 확인 | 로컬에서만 임시 앱 파일(예: 스크래치 `app_check.py`에 `FastAPI()` + `include_router`)로 확인하고 **커밋하지 않아요**. `main.py`는 A만 수정 |
| C · D · E | — | — | B는 다른 파트 코드를 import하지 않아요(`auth` → `rooms` 금지) |

### 6.2 B가 넘겨줘야 하는 것

| 받는 파트 | 넘길 것 (B 단계) | 그 파트에서 기다리는 작업 | 언제까지 |
|---|---|---|---|
| E | `get_current_user_id` 이름·경로·반환 `int` (① 공유 → ⑧ PR③ 코드) | `src/rooms/presentation/router.py` API 11개 전부의 `Depends(get_current_user_id)` (TKT-BE-M3-04) | 이름은 **1일차 오전**(분담표 §5-3). 코드는 E가 라우터를 실행해 보기 전(2일차)에 PR③ 머지 |
| D | `auth.infrastructure.models.UserModel`, 테이블 `users` (⑤, PR②) | `RoomQueryRepository`의 닉네임 조회 `session.get(UserModel, …)`, `rooms`·`participations`·`participation_logs`의 `ForeignKey("users.id")` 생성·flush (TKT-DB-M3-02) | D가 레포지토리를 DB에 붙여 실행하기 전(1일차 오후~2일차 초). 이름은 ①에서 |
| A | `auth.infrastructure.models` 모듈 (⑤, PR②) | A ⑧ `main.py` v2의 모델 import(`create_all`) | PR② 머지 즉시 공지 |
| A | `User.register` (③ PR①), `UserRepository.exists_login_id`·`save` (⑥ PR②), `PasswordHasher().hash` (④ PR②) | A ⑨ `seed.py`(회원 14명, `seed01` 존재 시 건너뜀) | A ⑨는 C·D가 끝난 뒤라 여유 있지만, PR②를 **2일차 안**에 머지 |
| A | `auth.presentation.router.router` (⑨, PR④) | A ⑧ 라우터 등록 | PR④ 머지 시 |
| A | `auth.presentation.pages.page_router` (⑪, PR⑥) | A ⑧ 라우터 등록, A ⑩ 통합 점검(화면 6개 200) | PR⑥ 머지 시, A ⑩ 전 |
| C | `api.js` 공개 함수 `apiRequest`·`errorMessage`·`formatTime`·`getAccessToken`·`renderPagination`·`showNotice` (① 공유 → ⑩ PR⑤) | `src/templates/rooms/history.html`·`archived.html` 인라인 스크립트(TKT-FE-M5-05) | 이름은 ①에서. 코드는 C가 화면을 브라우저로 확인하기 전 |
| E | `api.js` 공개 함수 `apiRequest`·`errorMessage`·`formatTime`·`getAccessToken`·`hideNotice`·`renderPagination`·`showNotice` (⑩ PR⑤) | `src/static/js/rooms.js`, `list.html`·`detail.html`(TKT-FE-M5-03·04)의 조회·변경·401 처리 | 이름은 ①에서. 코드는 E가 화면을 브라우저로 확인하기 전 |
| A · C · E | 로그인 화면·토큰 발급(⑨ PR④ + ⑪ PR⑥) | 모든 로그인 필요 화면의 브라우저 확인(토큰이 있어야 `data-require-login` 화면이 열려요) | 화면 작업 확인 단계 전. 그 전에는 Swagger로 받은 토큰을 개발자 도구에서 `localStorage.access_token`에 직접 넣어 우회할 수 있어요 |
