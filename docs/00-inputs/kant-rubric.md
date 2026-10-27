# [발제] 프로젝트(2) : 백엔드 서비스 API 구현하기 — 요구사항·평가표

> 원본: KANT 노션 발제 문서 「[발제] 프로젝트(2) : 백앤드 서비스 API 구현하기 (1)」 (2026-10-27 추출)
> 레지스트리 ID: IN-KANT. 사람이 관리하는 입력 원본이며 에이전트는 읽기만 한다.

## 1. 프로젝트 개요

- MVC 패턴의 한계인 빈약한 도메인 모델(Anemic Domain Model)과 비대해진 컨트롤러 문제를 해결하기 위해, 도메인 중심 4계층(presentation - application - domain - infrastructure) 아키텍처와 FastAPI 비동기 스택으로 백엔드 서비스 API를 설계·구현하는 팀 프로젝트.
- 외부 기술에 의존하지 않는 순수 도메인 모델(Rich Domain Model), 레포지토리 패턴으로 DB 격리, OAuth2·JWT 블랙리스트 보안, 비동기 동시성 제어, Jinja2 웹 인터페이스, OpenAPI 자동 문서화까지 완성한다.
- 팀: 5인
- 기간: 2026-10-26(월) ~ 2026-11-11(수), 주말·공휴일 제외 13일. 11/11 오후 발표.

### 1.1 필수·선택 범위

| 구분 | 수행 범위 |
|---|---|
| 필수 | 4계층 폴더 분리 및 단방향 의존성 규칙 적용 |
| 필수 | 외부 프레임워크/DB에 의존하지 않는 순수 파이썬 도메인 클래스(풍부한 도메인 모델) 및 핵심 검증 로직 내장 |
| 필수 | PostgreSQL + SQLAlchemy 비동기 ORM(AsyncSession, asyncpg) 연동, 레포지토리 패턴(models.py, repositories.py)으로 도메인 객체 변환·영속화 |
| 필수 | presentation 내 Pydantic 스키마(schemas.py) 입출력 검증, FastAPI 라우터(router.py) 분리, 경로/쿼리 매개변수 처리, 예외 변환(HTTPException 및 전역 핸들러) |
| 필수 | OAuth2 인증 표준 및 JWT 블랙리스트 보안, 미들웨어(CORS, 로깅) |
| 필수 | Jinja2 템플릿과 정적 파일을 활용한 웹 인터페이스(대시보드/목록 화면) |
| 도전 A | 정원/재고 차감 시 DB 커넥션 풀 튜닝 및 비동기 동시성 제어로 경쟁 상태(Race Condition) 방어 |
| 도전 B | BackgroundTasks 기반 비동기 후처리, StreamingResponse 기반 대용량 파일 스트리밍 다운로드 |
| 도전 C | 조회 API 및 토큰 블랙리스트 인메모리 캐싱, 애플리케이션 배포 환경 구성 |

- 도전 실습은 필수 화면·API 구현을 모두 마친 뒤 진행하며, 필수 완료 기준에 포함하지 않는다.

### 1.2 공통 환경

- 사용 프로그램: VS Code, PostgreSQL
- 라이브러리: Python 3.13+, uv, fastapi, uvicorn, sqlalchemy, asyncpg, pydantic, greenlet, jinja2, pyjwt, passlib[bcrypt]
- 실행 명령어: `uv run uvicorn main:app --app-dir src --reload` (프로젝트 루트에서 실행)
- 프로젝트 초기화: `uv init <프로젝트명> --python 3.13`, `uv add fastapi uvicorn sqlalchemy asyncpg pydantic greenlet ...`
- DB 접속 URL 형식: `postgresql+asyncpg://postgres:postgres@localhost:5432/postgres` (로컬 기본 포트 5432)
- `src/` 하위 기능 폴더와 4계층 폴더마다 빈 `__init__.py`를 반드시 생성한다(ModuleNotFoundError 방지).

## 2. 학습 연결 (강의 장별)

| 장 | 프로젝트에 적용할 내용 |
|---|---|
| 1장 | uv 환경 설정, FastAPI 앱(`src/main.py`) 구동, HTTP 메서드와 RESTful 라우팅 |
| 2장 | 타입 힌트, Pydantic BaseModel·Field 검증, `response_model`로 민감 정보(비밀번호 해시 등) 노출 방지, Swagger 문서 고도화 |
| 3장 | 경로/쿼리 매개변수, 도메인 예외(ValueError) → HTTP 예외 변환, Jinja2 템플릿·정적 파일 |
| 4장 | 기능 모듈별 APIRouter 분리, 미들웨어, 백그라운드 태스크·스트리밍 |
| 5장 | `src/database.py` 비동기 엔진·AsyncSession, `infrastructure/models.py`, 커넥션 풀·비동기 동시성 제어 |
| 6장 | OAuth2 로그인, 로그아웃 시 토큰 재사용을 막는 JWT 블랙리스트 |
| 7장 | 도메인 중심 4계층 아키텍처, 캐싱·CORS 미들웨어, 배포 |

## 3. Use Case (주제)

팀별로 아래 예시를 참고하거나 자율 선정한다. 선정한 주제에 맞춰 핵심 비즈니스 규칙을 정의한다.

| Use Case | 핵심 도메인 | 핵심 도메인 규칙 |
|---|---|---|
| 대학교 수강 신청·학사 관리 | Course, User, Enrollment, TokenBlacklist | 정원(capacity) 최소 1 검증, 현재 인원(current_students) 범위 검증, `apply_registration` 호출 시 정원 마감 자체 검사 및 인원 증가, 취소 시 인원 차감 |
| 한정판 스니커즈·굿즈 드롭 커머스 | Product, User, Order, TokenBlacklist | 가격·초기 재고(stock) 검증, `deduct_stock` 호출 시 재고 부족 자체 검사 및 품절 전환, 주문 취소 시 재고 복구 |
| 공연·원데이 클래스 티켓 예약 | Performance, User, Reservation, TokenBlacklist | 좌석 정원 및 1인당 최대 예매 매수 제한, `reserve_seats` 호출 시 잔여석 부족 차단 및 예약 확정 |
| 사내 IT 장비 렌탈·회의실 예약 | Asset, User, Booking, TokenBlacklist | 장비 상태(AVAILABLE, RENTED, MAINTENANCE) 전이 검증, `borrow_asset`·`return_asset`으로 상태 변경 및 중복 대여 차단 |

## 4. 필수 구현 범위

### 4.1 4계층 아키텍처 (7장 1강)

`src/<기능폴더>/` 내부에 4개 계층 패키지를 구성한다.

| 계층 | 폴더명 | 역할 | 주요 구성 요소 | 의존성 규칙 |
|---|---|---|---|---|
| 표현 | `presentation` | 요청 수집, 결과를 포맷에 맞게 반환 | `router.py`, `schemas.py` | application, domain만 참조 |
| 응용 | `application` | 비즈니스 흐름 조율, 트랜잭션 제어 | `service.py` 클래스 | domain, infrastructure만 참조 |
| 도메인 | `domain` | 핵심 비즈니스 규칙 보유, 자율 검증 | 순수 파이썬 클래스(예: `course.py`) | 참조하는 외부 계층 없음, 외부 라이브러리 import 금지 |
| 인프라 | `infrastructure` | DB·외부 시스템 통신 | `models.py`, `repositories.py` | domain·application 계층의 계약 구현 |

단방향 의존: 표현 → 응용 → 도메인, 표현 → 응용 → 인프라.

### 4.2 표준 디렉토리 구조

```
<project-name>/
├── pyproject.toml
├── uv.lock
└── src/
    ├── main.py          # 앱 엔트리, lifespan(테이블 생성/초기 시드 주입), 라우터·미들웨어 조립
    ├── database.py      # AsyncEngine, AsyncSessionLocal, DeclarativeBase(Base), get_db()
    ├── templates/       # Jinja2 HTML 템플릿
    ├── static/          # CSS, 이미지 등 정적 파일
    ├── auth/            # 인증·인가 모듈 (OAuth2 & JWT 블랙리스트), 4계층 구조
    │   ├── __init__.py
    │   ├── domain/ infrastructure/ application/ presentation/
    └── <핵심도메인폴더>/  # 예: registration/, commerce/, reservation/
        ├── __init__.py
        ├── domain/          __init__.py, <entity>.py        # 순수 파이썬 도메인 클래스
        ├── infrastructure/  __init__.py, models.py, repositories.py
        ├── application/     __init__.py, service.py
        └── presentation/    __init__.py, schemas.py, router.py
```

### 4.3 비동기 DB 연동·레포지토리 (5장 1강, 7장 1강)

- `src/database.py`: `create_async_engine`, `async_sessionmaker(class_=AsyncSession, expire_on_commit=False)`, `DeclarativeBase`를 상속한 `Base`, `async def get_db()` 제너레이터.
- `infrastructure/models.py`: `Mapped`, `mapped_column`으로 테이블 모델(예: `CourseModel`) 정의.
- `infrastructure/repositories.py`: AsyncSession을 주입받아 조회한 SQLAlchemy 모델을 그대로 반환하지 않고 순수 도메인 객체로 조립·변환해 반환(`find_by_id`, `find_all` 등)하고, 도메인 변경 사항을 저장(`save`)한다.
- `src/main.py` lifespan에서 테이블 생성 및 초기 시드 데이터 20건 이상 자동 주입.

### 4.4 응용 서비스

- `application/service.py`의 서비스 클래스(예: `CourseApplicationService`)는 비즈니스 조건문을 직접 판별하지 않는다.
- 흐름: 레포지토리 조회 → 도메인 행위 메서드 실행 → `await self.repository.save(...)` → `await self.db.commit()`.

### 4.5 표현 계층 검증·예외·웹 인터페이스 (1~4장)

- `presentation/schemas.py`: `Field(..., description=...)`, `from_attributes = True`를 포함한 요청/응답 모델.
- `presentation/router.py`: `APIRouter`, `Depends(get_db)`로 서비스 호출, `response_model`로 응답 직렬화. 목록 API에 검색·필터링·정렬·페이지네이션(경로/쿼리 매개변수).
- 도메인 규칙 위반(ValueError 등)을 `HTTPException(status_code=400, detail=str(err))` 또는 전역 예외 핸들러로 변환. 비정상 접근 시 일관된 에러 JSON.
- `Jinja2Templates`, `StaticFiles`로 등록된 리소스 목록과 정원/재고 현황을 보여 주는 웹 페이지(메인/목록/현황 대시보드).
- Swagger UI(summary, description, 응답 모델) 문서 정교화.

### 4.6 OAuth2·JWT 블랙리스트 (6장 1강)

- `src/auth/` 모듈(4계층): 회원가입, 비밀번호 해싱, OAuth2 표준 로그인(JWT 발급).
- 로그아웃 시 토큰을 블랙리스트에 등록하고, 해당 토큰으로 재요청하면 401 Unauthorized로 즉시 차단.
- Swagger UI의 Authorize로 인가 테스트가 가능해야 한다.

### 4.7 미들웨어

- `src/main.py`에 `CORSMiddleware`, 요청/응답 로깅·처리 시간 측정 커스텀 미들웨어.

### 4.8 제외 범위

| 제외 | 대체 |
|---|---|
| 외부 프론트엔드 프레임워크(React, Next.js 등) | FastAPI 내장 Jinja2 페이지와 Swagger UI(`/docs`) |
| 실제 외부 결제(PG), 상용 메일/SMS 발송 | 도메인 상태 변경 및 BackgroundTasks 로그 출력 |

## 5. 도전 실습 (선택)

- **A. 커넥션 풀·비동기 동시성 제어 (5장 2강)**: 정원이 2명 남은 자원에 수천 명이 동시에 신청하는 상황을 비동기 동시 요청 스크립트로 재현. `src/database.py` 엔진에 커넥션 풀 옵션을 설정하고, 레포지토리 조회 시 비관적 락(`select(...).with_for_update()`) 등으로 정원/재고 초과를 막는다.
- **B. 백그라운드 태스크·스트리밍 (4장 2강)**: 신청·주문 완료 시 `BackgroundTasks`로 완료 로그/알림 내역을 비동기 기록. `StreamingResponse`로 전체 목록이나 신청자 내역을 CSV 스트림 다운로드.
- **C. 캐싱·배포 (7장 2·3강)**: 조회 빈도가 높은 목록/상세 API 또는 JWT 블랙리스트 조회에 인메모리 캐시 적용, 상태 변경(신청/취소 등) 시 캐시 갱신·무효화. 환경변수 분리 및 프로덕션 실행 구성.

## 6. 진행 일정

- Part 1 (10/26 ~ 11/4, 1~8일차, 오후): 기획, 4계층 구축, 핵심 도메인 API, OAuth2/JWT 블랙리스트
- Part 2 (11/5 ~ 11/11, 9~13일차, 풀타임): 고급 기능, Jinja2, 도전 실습, 문서화, 발표

| 일차 | 주요 작업 | 중간 결과 |
|---|---|---|
| 1 (10/26) | Use Case·콘셉트 확정, 팀 노션·역할 분담·Git 규칙, 핵심 도메인 규칙 도출 | 노션 링크, 기획 배경·도메인 규칙 정의서 |
| 2 (10/27) | ERD 설계, RESTful API 명세(Method, URI, 입출력), Jinja2 화면 와이어프레임 | 노션 내 ERD·API 명세표, 와이어프레임 |
| 3 (10/28) | `uv init`, 패키지 설치, 4계층 폴더·`__init__.py`, GitHub 초기 커밋·브랜치 전략 | `pyproject.toml`, `uv.lock`, 서버 기동 확인 |
| 4 (10/29) | 도메인 계층: 순수 도메인 클래스, 생성자 검증, 상태 변경 메서드 | fastapi·sqlalchemy import 없는 `domain/*.py`, 규칙 위반 시 ValueError |
| 5 (10/30) | `src/database.py`, `infrastructure/models.py` | 로컬 PostgreSQL 연동, 테이블 모델 |
| 6 (11/2) | `repositories.py`(도메인 객체 변환·저장), lifespan 테이블 생성·시드 20건+ | 시드 주입 로그 |
| 7 (11/3) | `service.py` 조율, `schemas.py`·`router.py`, ValueError → 400 | Swagger/curl로 200 정상, 400 차단 확인 |
| 8 (11/4) | `src/auth/`, 비밀번호 해싱, OAuth2 로그인, JWT 블랙리스트 로그아웃 | 회원가입 → 로그인 → Authorize, 로그아웃 후 동일 토큰 401 |
| 9 (11/5) | 목록 API 검색·필터·정렬·페이지네이션, 전역 예외 핸들러, CORS·로깅 미들웨어 | 쿼리 조합별 응답, 일관된 에러 JSON, 콘솔 로그 |
| 10 (11/6) | Jinja2·StaticFiles 메인/목록/대시보드, 통합 점검, Swagger 문서 정교화 | 실제 DB 데이터가 바인딩된 화면, 필수 요구사항 1~8 완료 |
| 11 (11/9) | 도전 A·B·C | 동시성 테스트 결과, CSV 스트리밍, 캐싱 전후 비교 |
| 12 (11/10) | 통합 테스트, 버그 점검, README, PPT | `.gitignore` 점검된 저장소, README, PPT/PDF |
| 13 (11/11) | 시드 점검, 리허설, 최종 발표 | 산출물·발표 완수 |

## 7. 주요 산출물

1. **GitHub 저장소**: `uv sync` 후 `uv run uvicorn main:app --app-dir src --reload`가 오류 없이 실행되는 소스. `.gitignore`로 `.venv`, `__pycache__`, `.env` 등 배제, `pyproject.toml`·`uv.lock`·`src/` 관리.
2. **README.md**: 주제·Use Case 소개, 4계층 디렉토리·컴포넌트 구조도(트리 텍스트), 로컬 실행 방법(git clone → uv sync → PostgreSQL 실행·환경변수 설정 → 실행 명령), 캡처(Jinja2 화면, Swagger UI, 200 정상·400 규칙 차단, JWT 블랙리스트 차단).
3. **팀 노션**: 화면/API 기획, 도메인 규칙, 와이어프레임, 회의록, 13일간 일자별 진행 현황·업무 분담표. 웹 공개(Public Share) URL 제출.
4. **발표 자료(PPT/PDF, 7~10장)**: 표지(서비스명, 5인 팀원·역할), 기획 배경·Use Case, 4계층 구조도와 요청 처리 흐름, 라이브 시연 안내, 트러블슈팅, 팀원별 소감.

### 7.1 발표·시연 (팀당 10분)

- PPT 약 5분 + 라이브 시연 약 5분, 이후 질의응답.
- 시연 순서: Jinja2 메인/목록 화면 → Swagger UI 또는 curl로 정상 신청 200 OK, 정원 마감·규칙 위반 400 Bad Request → JWT 블랙리스트 차단(401).

## 8. 요구사항 평가표

| No | 요구사항 | 수행할 작업 | 증빙·확인 | 평가 관점 |
|---|---|---|---|---|
| 1 | 4계층 폴더 구조·단방향 의존성 | `src/<기능>/` 하위 4계층 폴더와 `__init__.py`, 단방향 의존 | `src/` 디렉토리 구조 | 역할이 격리되고 역방향·순환 참조가 없는가 |
| 2 | 순수 도메인 모델 | 외부 라이브러리 import 없는 클래스, 검증·상태 변경 메서드 내장 | `domain/` 소스 | 도메인 객체가 정원/재고 초과 등 규칙을 스스로 검증하는가 |
| 3 | 비동기 DB·레포지토리 격리 | `database.py` AsyncSession, `repositories.py`에서 모델 → 도메인 객체 변환·저장 | `database.py`, `models.py`, `repositories.py`, lifespan 시드 | ORM 모델이 서비스·라우터에 노출되지 않는가 |
| 4 | 응용 서비스 흐름·트랜잭션 | 조회 → 도메인 메서드 → `save()` → `db.commit()` | `service.py` | 검증 로직이 도메인에 위임되고 서비스는 흐름·트랜잭션만 조율하는가 |
| 5 | 스키마 검증·라우터 | BaseModel·Field 스키마, 경로/쿼리 매개변수, `response_model` | `schemas.py`, `router.py`, `/docs` | 입출력 검증·자동 문서화가 동작하고 ValueError가 적절한 HTTP 코드로 변환되는가 |
| 6 | OAuth2·JWT 블랙리스트 | 로그인(JWT 발급), 비밀번호 해싱, 로그아웃 시 블랙리스트 등록 | 로그인/로그아웃, 블랙리스트 토큰 401 시연 | 표준 OAuth2 흐름을 따르고 로그아웃 토큰이 즉시 차단되는가 |
| 7 | 미들웨어(CORS·로깅) | `CORSMiddleware`, 요청/응답 로깅(처리 시간) | `src/main.py`, 콘솔 로그 | 공통 관심사가 미들웨어에서 일관되게 처리되는가 |
| 8 | Jinja2·정적 파일 웹 화면 | 템플릿·`static/` 연동, 현황·목록 화면 | 화면 캡처·시연 | 실제 DB 데이터가 깨짐 없이 바인딩되는가 |
| 9 | 예외 방어·저장소 관리 | 정원 초과·미존재 ID 등 예외 방어, `.gitignore` | 400/404 에러 JSON, 저장소 점검 | 비정상 접근에 크래시가 없고 불필요한 파일이 없는가 |
| 10 | 기술 문서화·최종 발표 | README(실행 방법·화면 구조), 11/11 시연·발표 | README.md, 현장 발표 | 제3자가 문서만 보고 실행할 수 있고 문제 해결 과정을 설명하는가 |

## 9. 역할별 수행 체크리스트

| No | 역할 | 평가 문항 |
|---|---|---|
| 1 | 공통 / PM | 노션에 Use Case 핵심 도메인 규칙, ERD, API 명세서, 13일 진행 현황이 기록되고 웹에 공개되었는가 |
| 2 | 공통 / 환경·형상 관리 | uv로 `pyproject.toml`·`uv.lock`이 구성되고 모든 계층 폴더에 `__init__.py`가 있어 ModuleNotFoundError 없이 실행되는가 |
| 3 | 도메인 | `domain/` 클래스가 FastAPI·SQLAlchemy 등을 전혀 import하지 않는가 |
| 4 | 도메인 | 생성자와 비즈니스 메서드(예: `apply_registration`) 안에서 정원/재고 초과 등을 스스로 검사하는가 |
| 5 | 인프라 | `database.py`에 `create_async_engine`, `async_sessionmaker`, `AsyncSession`, `DeclarativeBase`, `get_db()`가 안전하게 구현되었는가 |
| 6 | 인프라 | `models.py`의 테이블 모델(`Mapped`, `mapped_column`)이 물리 테이블과 정확히 매핑되는가 |
| 7 | 인프라 | `repositories.py`가 Model을 그대로 반환하지 않고 도메인 객체로 변환해 반환(`find_by_id` 등)·저장(`save`)하는가 |
| 8 | 인프라 | `main.py` lifespan에서 테이블 생성 확인과 초기 데이터 주입이 되는가 |
| 9 | 응용 | `service.py`가 domain·infrastructure만 참조하고 presentation을 역참조하지 않는가 |
| 10 | 응용 | 조회 → 도메인 메서드 → `save` → `await self.db.commit()` 흐름이 정확한가 |
| 11 | 표현 | `schemas.py`에 BaseModel·Field로 검증 규격과 description이 명확한가 |
| 12 | 표현 | `router.py`가 APIRouter·`Depends(get_db)`로 서비스를 호출하고 `response_model`로 반환하는가 |
| 13 | 표현 | 목록 API에 검색·필터링·페이지네이션이 구현되었는가 |
| 14 | 표현 | 도메인 ValueError를 `HTTPException(400)` 또는 전역 핸들러로 변환하는가 |
| 15 | 인증·보안 | OAuth2 로그인(JWT 발급)과 비밀번호 해싱이 구현되어 Swagger에서 인가 테스트가 가능한가 |
| 16 | 인증·보안 | 로그아웃 시 JWT가 블랙리스트에 등록되고 재접근 시 401로 차단되는가 |
| 17 | 웹·미들웨어 | CORSMiddleware, 로깅, Jinja2Templates·StaticFiles 웹 화면이 오류 없이 동작하는가 |
| 18 | 문서화·발표 | README(4계층 구조도, 실행 명령어, 캡처)와 PPT를 마치고 11/11 10분 시연 리허설을 완수했는가 |

## 10. 주의사항

- 새 폴더를 만들 때마다 빈 `__init__.py`를 함께 만든다.
- 소스는 `src/` 아래에 두므로 프로젝트 루트에서 `uv run uvicorn main:app --app-dir src --reload`로 실행한다.
- `domain/` 파일에서 fastapi·sqlalchemy를 import하지 않는다. 정원 초과 등 핵심 검증은 컨트롤러·서비스의 if-else가 아니라 도메인 메서드 안에 둔다.
- SQLAlchemy 객체(예: `CourseModel`)를 서비스·라우터로 넘기지 않고 레포지토리에서 도메인 객체(예: `Course`)로 변환해 반환한다.
