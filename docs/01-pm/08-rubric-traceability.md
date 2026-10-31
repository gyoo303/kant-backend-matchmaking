# 08. 발제 평가표 추적 매트릭스 (P8)

- 입력: 발제 평가표(발제 문서 §8·§9·§5), `01`~`07` PM 산출물
- 상태: **정의됨**(PM이 충족) / **설계됨(ARCH)**(Architect가 설계 증빙을 채움, A8) / **사람**(코드 밖 산출물)
- "증빙 산출물"의 설계 문서는 `docs/02-arch/` 기준이고, 코드 경로는 `05-structure-conventions.md` §1의 확정 경로다.

## 1. 요구사항 평가표 (EV)

| ID | 요구사항 | 담당 단계 | 발제 역할 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| EV-01 | 4계층 폴더 구조·단방향 의존성 | ARCH → BE·DB | 환경·형상 관리 | NFR-01 | `05-structure-conventions.md` §1·§2, ADR-001, GATE-02·03 / `src/auth/`, `src/rooms/` | **설계됨(ARCH)** |
| EV-02 | 순수 도메인 모델 | PM → ARCH → BE | 도메인 | `03-domain.md` §4·§6(INV-01~15), US-01~06, AC-01~06 | `04-interfaces-api.md` §1·§2 / `src/auth/domain/user.py`, `src/rooms/domain/room.py`, `participation.py` | **정의됨** (규칙), **설계됨(ARCH)** (시그니처) |
| EV-03 | 비동기 DB·레포지토리, lifespan 시드 | ARCH → DB | 인프라 | NFR-06 | `03-db-schema.md` §2~§6(ENT-01~04), SEQ-12 / `src/database.py`, `src/*/infrastructure/models.py`·`repositories.py`, `src/seed.py` | **설계됨(ARCH)** |
| EV-04 | 응용 서비스 흐름·트랜잭션 | ARCH → BE | 응용 | US-01~06 정상 흐름, NFR-05 | `04-interfaces-api.md` §3·§8·§9(SEQ-05~09), ADR-009 / `src/rooms/application/service.py`, `src/auth/application/service.py` | **설계됨(ARCH)** |
| EV-05 | 스키마 검증·라우터, 예외 → HTTP | PM → ARCH → BE | 표현 | REJ-01~32, 전체 AC, NFR-02 | `04-interfaces-api.md` §4(API-AUTH-01~04, API-ROOM-01~12)·§5·§6, ADR-004, D-015 / `schemas.py`, `router.py`, `/docs` | **정의됨** (거부 조건), **설계됨(ARCH)** |
| EV-06 | OAuth2·JWT 블랙리스트 | PM → ARCH → BE | 인증·보안 | US-08~11, AC-08~11, NFR-03, SCR-01·02 | ADR-002, `04-interfaces-api.md` SEQ-01~04, `03-db-schema.md` §3.2 / `src/auth/` | **정의됨** (흐름·AC), **설계됨(ARCH)** |
| EV-07 | 미들웨어(CORS·로깅) | ARCH → BE | 웹·미들웨어 | REQ-T15 | `05-structure-conventions.md` CONV-07·10·11 / `src/main.py`, `src/logging_middleware.py` | **설계됨(ARCH)** |
| EV-08 | Jinja2·정적 파일 웹 화면 | PM → ARCH → FE | 웹·미들웨어 | US-15~17, SCR-01~06 (핵심 SCR-03·04·05, D-012), NFR-08 | `07-screens.md`, `04-interfaces-api.md` §7(PAGE-01~06), SEQ-13(수동 새로고침), ADR-012 / `src/templates/`, `src/static/` | **정의됨** (화면), **설계됨(ARCH)** (데이터 계약) |
| EV-09 | 예외 방어(400/404), `.gitignore` | PM → ARCH → QA | 표현, 환경·형상 관리 | REJ-07~09·19·27, AC-02-3·02-6·06-5·14-2, NFR-02·09 | `04-interfaces-api.md` §6, GATE-06, `.gitignore` | **정의됨** (거부 시나리오), **설계됨(ARCH)** |
| EV-10 | README, 최종 시연·발표 | PM → ARCH → FE / 사람 | 문서화·발표 | `07-screens.md` §5, NFR-01 | `HANDOFF.md` §2(README 목차), GATE-01, TKT-FE-M7-01 / README.md, 발표 | **정의됨** (시연 흐름), **설계됨(ARCH)** (README 목차), 발표는 사람 |

## 2. 역할별 체크리스트 (RC)

| ID | 항목 | 담당 단계 | 발제 역할 | 연결 | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| RC-01 | 노션 기록(도메인 규칙·ERD·API 명세·진행 현황, 공개) | PM·ARCH / 사람 | 문서화 | `03-domain.md`, `07-screens.md` | 원본: `docs/01-pm/03-domain.md`, `docs/02-arch/03-db-schema.md` §2(ERD), `04-interfaces-api.md` §4(API 명세) / 팀 노션 | **정의됨**·**설계됨(ARCH)** (게시 원본), 게시는 사람 |
| RC-02 | uv 구성·`__init__.py` | ARCH → BE | 환경·형상 관리 | NFR-01 | `02-system-architecture.md` §3, GATE-03, TKT-BE-M2-01 / `pyproject.toml`, `uv.lock` | **설계됨(ARCH)** |
| RC-03 | domain 외부 import 0 | ARCH → BE | 도메인 | `03-domain.md` §4 | `05-structure-conventions.md` §2·§4-1, GATE-02 / `src/*/domain/*.py` | **설계됨(ARCH)** |
| RC-04 | 생성자·행위 메서드 자체 검증 | PM → BE | 도메인 | `03-domain.md` §4, INV-01~15 | `04-interfaces-api.md` §2 / `domain/*.py` | **정의됨** |
| RC-05 | `database.py` 비동기 세션·`get_db()` | ARCH → DB | 인프라 | REQ-T06 | `04-interfaces-api.md` §8, TKT-DB-M2-01 / `src/database.py` | **설계됨(ARCH)** |
| RC-06 | `models.py` 매핑 | ARCH → DB | 인프라 | `03-domain.md` §3 | `03-db-schema.md` §3·§4 / `src/*/infrastructure/models.py` | **설계됨(ARCH)** |
| RC-07 | 레포지토리 도메인 객체 변환·`save` | ARCH → DB | 인프라 | REQ-T07 | `03-db-schema.md` §5, GATE-08 / `src/*/infrastructure/repositories.py` | **설계됨(ARCH)** |
| RC-08 | lifespan 테이블 생성·시드 | ARCH → DB | 인프라 | NFR-06, D-014 | `03-db-schema.md` §6, SEQ-12 / `src/main.py`, `src/seed.py` | **설계됨(ARCH)** |
| RC-09 | service의 단방향 참조 | ARCH → BE | 응용 | REQ-T03 | `05-structure-conventions.md` §2, GATE-02 / `service.py` | **설계됨(ARCH)** |
| RC-10 | 조회 → 도메인 메서드 → save → commit | ARCH → BE | 응용 | US-01~06, NFR-05 | `04-interfaces-api.md` §8·SEQ-05~09 / `service.py` | **설계됨(ARCH)** |
| RC-11 | 스키마 Field·description | ARCH → BE | 표현 | US-01~14 입력 | `04-interfaces-api.md` §5 / `schemas.py` | **설계됨(ARCH)** |
| RC-12 | APIRouter·`Depends(get_db)`·`response_model` | ARCH → BE | 표현 | REQ-T11 | CONV-03·04, `04-interfaces-api.md` §4 / `router.py` | **설계됨(ARCH)** |
| RC-13 | 검색·필터·페이지네이션 | PM → BE | 표현 | US-12, AC-12-1~8, NFR-07 | API-ROOM-01, SEQ-10 / 목록 API | **정의됨** |
| RC-14 | ValueError → 400 변환 | PM → BE | 표현 | REJ-04~24, NFR-02 | `04-interfaces-api.md` §1·§6 / 전역 핸들러 | **정의됨** |
| RC-15 | OAuth2 로그인·비밀번호 해싱·Swagger 인가 | PM → BE | 인증·보안 | US-08, US-09, AC-08-1, AC-09-1 | API-AUTH-02, ADR-002 / `src/auth/` | **정의됨** |
| RC-16 | 블랙리스트 401 | PM → BE | 인증·보안 | US-10, AC-10-2 | SEQ-03·04 / `src/auth/` | **정의됨** |
| RC-17 | CORS·로깅·Jinja2·StaticFiles | PM·ARCH → BE·FE | 웹·미들웨어 | US-15~17, SCR-01~06 | CONV-07~12, PAGE-01~06 / `src/main.py`, `src/templates/` | **정의됨** (화면), **설계됨(ARCH)** |
| RC-18 | README·PPT·리허설 | FE / 사람 | 문서화·발표 | `07-screens.md` §5 | `HANDOFF.md` §2, TKT-QA-M7-01 / README.md, PPT | **정의됨**·**설계됨(ARCH)**, PPT·리허설은 사람 |

## 3. 도전 과제 (CH)

| ID | 항목 | 채택 (D-002, D-018) | 연결 | 상태 |
|---|---|---|---|---|
| CH-A | 커넥션 풀·동시성 제어 | Should (M6 첫 순서, 요청 시 착수). 동시 요청 무결성 구현 전체(D-018) | US-18, AC-18-1~5, ADR-009, TKT-DB-M6-01, TKT-BE-M6-00, TKT-QA-M6-01 | **정의됨**, **설계됨(ARCH)** |
| CH-B | BackgroundTasks·StreamingResponse CSV | Could (A 다음) | US-19, AC-19-1~2, SEQ-14, API-ROOM-12, TKT-BE-M6-01 | **정의됨**, **설계됨(ARCH)** |
| CH-C | 인메모리 캐싱·배포 구성 | Could (B 다음, 11일차 종료 시 중단) | US-20, AC-20-1~3, ADR-007, ADR-008, TKT-BE-M6-02 | **정의됨**, **설계됨(ARCH)** |
