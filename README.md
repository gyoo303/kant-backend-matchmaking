# 2vs2 매치메이킹

FastAPI 4계층 구조와 Jinja2 화면으로 만든 2vs2 공개 방 매치메이킹 시연 서비스입니다.

## 1. 주제·Use Case

로그인한 회원에게, 2vs2(4명 고정) 공개 방을 만들거나 찾아 참가하고 방 안에서 팀을 바꾼 뒤 방장이 '게임 시작'을 누르면 결과 판정 없이 방이 해산되는 **매치메이킹 시연 서비스**를 제공한다. 정원·한 방 제한·팀 정원·방장 위임·소프트 삭제 규칙은 도메인 객체가 스스로 검사한다.

- 게임 결과·승패는 다루지 않는다. '게임 시작'은 방을 소프트 삭제(해산)하는 처리다.
- 회원은 한 번에 한 방에만 참가한다. 방은 A팀·B팀 각 2명, 방장이 나가면 가장 먼저 들어온 참가자가 방장이 된다.
- 해산·삭제된 방은 목록에서 사라지고, 참가했던 회원은 "내 기록"에서 보관 정보를 볼 수 있다.

| 회원이 하는 일 | 화면 | API |
|---|---|---|
| 회원가입·로그인·로그아웃 | `/signup`, `/login` | `/api/auth/signup`, `/api/auth/token`, `/api/auth/refresh`, `/api/auth/logout` |
| 공개 방 찾기(검색·빈자리 필터·정렬·페이지), 방 만들기, 참가 | `/` | `GET·POST /api/rooms`, `POST /api/rooms/{id}/participants` |
| 방 현황 보기, 팀 이동, 나가기, 제목 변경·게임 시작(방장) | `/rooms/{id}` | `GET·PATCH /api/rooms/{id}`, `PATCH·DELETE /api/rooms/{id}/participants/me`, `POST /api/rooms/{id}/start` |
| 내 이용 기록, 삭제된 방의 보관 정보 | `/me/history`, `/me/history/{id}` | `GET /api/me/room-history`, `GET /api/me/room-history/{id}` |

자세한 명세: `docs/01-pm/`(요구사항·도메인·수용 기준·화면), `docs/02-arch/`(설계·API·ADR).

## 2. 4계층 디렉토리·컴포넌트 구조

기능 폴더는 `auth`(회원·인증)와 `rooms`(방·참가·이력) 두 개이고, 각 기능은 4계층으로 나뉜다.

| 계층 | 하는 일 | 의존 |
|---|---|---|
| `domain` | 순수 파이썬 도메인 클래스(`Room`·`Participation`·`User`)와 규칙 검사 | 외부 라이브러리 없음 |
| `application` | 유스케이스 흐름: 조회 → 도메인 메서드 → 저장 → `commit` | domain, infrastructure |
| `infrastructure` | ORM 모델, 레포지토리(ORM ↔ 도메인 변환), 비밀번호·JWT(auth) | domain |
| `presentation` | API 라우터·요청/응답 스키마, Jinja2 화면 라우트, 인증 의존성 | application |

```text
kant-ubuntu-books-claude1/
├── pyproject.toml              # 의존성(uv)·ruff·pytest 설정
├── uv.lock
├── .env.example                # 환경변수 이름·용도
├── README.md
├── AGENTS.md                   # 에이전트 작업 규칙·디렉토리 지도
├── src/
│   ├── main.py                 # 앱 생성, lifespan(테이블 생성·시드), 미들웨어, 전역 예외 핸들러, 라우터·정적 파일
│   ├── config.py               # Settings(pydantic-settings), get_settings()
│   ├── database.py             # AsyncEngine, AsyncSessionLocal, Base, get_db()
│   ├── exceptions.py           # 도메인 예외 기반 클래스
│   ├── logging_middleware.py   # 요청 로깅 미들웨어 log_requests
│   ├── seed.py                 # 초기 시드 seed_initial_data()
│   ├── auth/
│   │   ├── domain/         user.py, token_blacklist.py, exceptions.py
│   │   ├── infrastructure/ models.py, repositories.py, security.py
│   │   ├── application/    service.py
│   │   └── presentation/   schemas.py, router.py, dependencies.py, pages.py
│   ├── rooms/
│   │   ├── domain/         room.py, participation.py, exceptions.py
│   │   ├── infrastructure/ models.py, repositories.py
│   │   ├── application/    service.py, queries.py, read_models.py
│   │   └── presentation/   schemas.py, router.py, pages.py
│   ├── templates/
│   │   ├── base.html
│   │   ├── partials/       notice.html, pagination.html
│   │   ├── auth/           signup.html, login.html
│   │   └── rooms/          list.html, detail.html, history.html, archived.html
│   └── static/
│       ├── css/app.css
│       └── js/             api.js, polling.js, rooms.js
├── tests/
│   ├── conftest.py
│   ├── unit/               test_room.py, test_participation.py, test_user.py      # DB 없음
│   └── integration/        test_auth_api.py, test_rooms_api.py, test_history_api.py, test_errors.py
└── docs/                   # 기획(01-pm)·설계(02-arch)·단계별 브리핑·이미지(images)
```

- 패키지 폴더마다 빈 `__init__.py`가 있다(트리에서는 생략).
- `--app-dir src`로 실행하므로 import에 `src.`를 붙이지 않는다: `from rooms.domain.room import Room`.

### 요청 처리 흐름

```
요청 → CORSMiddleware → log_requests(요청 로깅)
     → presentation (router: 입력 검증, Depends(get_db), Depends(get_current_user_id))
     → application (service: 조회 → 도메인 메서드 → save → commit)
         ├→ domain (Room·Participation·User: 규칙 검사, 위반 시 도메인 예외)
         └→ infrastructure (repository: ORM ↔ 도메인 변환)
     → 응답 스키마(response_model) / 예외 → 전역 핸들러 → {"detail": "..."}
```

- 화면은 서버가 Jinja2 틀만 그리고, 내용은 브라우저 JS(`static/js/`)가 API를 불러 채운다. 방 목록·방 상세는 1초마다 다시 조회한다.
- 인증은 access(30분)·refresh(7일) JWT를 `Authorization: Bearer` 헤더로만 보낸다. 로그아웃하면 두 토큰을 블랙리스트에 넣어 다시 쓸 수 없다.
- 오류 응답은 모두 `{"detail": "<사유>"}` 한 형식이다: 규칙 위반 400, 인증 실패 401, 없는 대상 404, 해산된 방 410, 입력 형식 422.

## 3. 로컬 실행 방법

준비물: Python 3.13, [uv](https://docs.astral.sh/uv/), PostgreSQL.

1. 저장소 받기

   ```bash
   git clone <저장소 주소>
   cd kant-ubuntu-books-claude1
   ```

2. 의존성 설치

   ```bash
   uv sync
   ```

3. PostgreSQL 실행 후 DB 만들기 (예: DB 이름 `matchmaking`)

   ```bash
   createdb -U postgres matchmaking
   ```

4. 환경변수 설정: `.env.example`을 `.env`로 복사하고 값을 채운다. `.env`는 커밋하지 않는다.

   ```bash
   cp .env.example .env
   ```

   | 이름 | 값 |
   |---|---|
   | `DATABASE_URL` | `postgresql+asyncpg://<user>:<password>@localhost:5432/matchmaking` |
   | `JWT_SECRET_KEY` | 32자 이상의 임의 문자열 |
   | `SEED_USER_PASSWORD` | 시드 회원 공통 비밀번호(8자 이상) |
   | 나머지 | `.env.example` 기본값 그대로 써도 된다 |

5. 서버 실행

   ```bash
   uv run uvicorn main:app --app-dir src --reload
   ```

   처음 실행하면 테이블을 만들고 시드 데이터를 넣는다(로그 `seed inserted: …` 1회). 다시 실행하면 `seed skipped`로 건너뛴다.

6. 브라우저에서 `http://localhost:8000` 접속. API 문서(Swagger UI)는 `http://localhost:8000/docs`.

## 4. 시연 계정

- 아이디 `seed01` ~ `seed14`, 비밀번호는 `.env`의 `SEED_USER_PASSWORD` 값
- 시드에 들어 있는 방

  | 방 | 참가 회원 | 상태 |
  |---|---|---|
  | 2vs2 시연 방 | seed01(방장)~seed04 | 4/4, A·B 각 2명 — 바로 게임 시작 가능 |
  | 한 자리 남음 | seed05(방장)~seed07 | 3/4 |
  | Fun Room | seed08(방장), seed09 | 2/4 |
  | 100% 즐겜 | seed10(방장) | 1/4 |
  | 초보 환영 | seed11(방장) | 1/4 |
  | 어제 한 판, 저녁 매치 | seed01~08 | 게임 시작으로 해산(내 기록 → 보관 정보) |
  | 아무도 없음 | seed12 | 마지막 참가자가 나가 삭제 |

- seed13·seed14는 어느 방에도 없어 새 방 만들기·참가 시연에 쓴다.
- 같은 브라우저의 여러 탭은 로그인 정보를 공유하므로, 여러 회원으로 시연할 때는 다른 브라우저나 시크릿 창을 쓴다.

## 5. 시연 실행 (도전 C)

시연·배포용 실행 명령은 자동 재시작(`--reload`) 없이 아래와 같다(ADR-008). 도전 C(TKT-BE-M6-02, 목록 캐시)는 아직 진행하지 않았다.

```bash
uv run uvicorn main:app --app-dir src --host 0.0.0.0 --port 8000 --workers 1
```

## 6. 캡처

캡처는 PostgreSQL로 실행한 화면에서 찍어 `docs/images/`에 아래 파일 이름으로 넣는다.

| 파일 | 찍을 장면 |
|---|---|
| `docs/images/scr-03-room-list.png` | 공개 방 목록(`/`): 생성 폼, 검색·필터·정렬, 정원 마감 방, 페이지 이동 |
| `docs/images/scr-04-room-detail.png` | 방 상세(`/rooms/{id}`): A팀·B팀 구성, 방장 표시, 게임 시작 버튼 |
| `docs/images/scr-05-history.png` | 내 이용 기록(`/me/history`): 참가 중 기록, [보관 정보] 링크 |
| `docs/images/swagger-ui.png` | Swagger UI(`/docs`) API 목록 |
| `docs/images/api-200.png` | Swagger에서 Authorize 후 정상 요청 200 (예: 방 참가) |
| `docs/images/api-400.png` | 규칙 위반 400 (예: 정원 마감 방 참가 → "정원이 마감되었습니다") |
| `docs/images/api-401-blacklist.png` | 로그아웃한 토큰으로 요청 401 (JWT 블랙리스트 차단) |

### Jinja2 화면

![공개 방 목록](docs/images/scr-03-room-list.png)
![방 상세](docs/images/scr-04-room-detail.png)
![내 이용 기록](docs/images/scr-05-history.png)

### Swagger UI·API 응답

![Swagger UI](docs/images/swagger-ui.png)
![정상 요청 200](docs/images/api-200.png)
![규칙 위반 400](docs/images/api-400.png)
![블랙리스트 토큰 401](docs/images/api-401-blacklist.png)

## 7. 테스트 실행

통합 테스트는 앱 DB와 다른 **테스트 전용 PostgreSQL DB**가 필요하다(테스트가 테이블을 지우고 다시 만든다).

```bash
createdb -U postgres matchmaking_test
TEST_DATABASE_URL=postgresql+asyncpg://<user>:<password>@localhost:5432/matchmaking_test uv run pytest
```

- `TEST_DATABASE_URL`이 없으면 단위 테스트(`tests/unit`)만 돌고 통합 테스트는 건너뛴다.
- 테스트 이름에 수용 기준 번호가 들어 있다(예: `test_ac_02_3_join_full_room_rejected`).
- 린트·포맷 검사: `uv run ruff check src tests`, `uv run ruff format --check src tests`
