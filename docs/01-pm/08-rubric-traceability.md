# 08. 발제 평가표 추적 매트릭스 (P8)

- 입력: 발제 평가표(`kant-rubric.md` §8·§9·§5), `01`~`07` PM 산출물
- 상태: **정의됨**(PM이 충족) / **Architect로 이관**(설계 증빙을 ARCH가 채움) / **사람**(코드 밖 산출물)
- "증빙 산출물"의 코드 경로는 발제 구조 기준이며, ARCH가 실제 파일 경로로 갱신한다.

## 1. 요구사항 평가표 (EV)

| ID | 요구사항 | 담당 단계 | 발제 역할 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| EV-01 | 4계층 폴더 구조·단방향 의존성 | ARCH → BE·DB | 환경·형상 관리 | NFR-01 | `src/` 구조, ARCH 구조 문서 | Architect로 이관 (구조는 PM 범위 밖) |
| EV-02 | 순수 도메인 모델 | PM → ARCH → BE | 도메인 | `03-domain.md` §4·§6(INV-01~15), US-01~06, AC-01~06 | `03-domain.md`, `src/<기능>/domain/` | **정의됨** (규칙·메서드 후보), 클래스 설계는 Architect로 이관 |
| EV-03 | 비동기 DB·레포지토리, lifespan 시드 | ARCH → DB | 인프라 | NFR-06 | `database.py`, `models.py`, `repositories.py` | Architect로 이관 (시드 규모는 정의됨) |
| EV-04 | 응용 서비스 흐름·트랜잭션 | ARCH → BE | 응용 | US-01~06 정상 흐름, NFR-05 | `service.py` | Architect로 이관 (업무 단위는 정의됨, ARCH-Q-02) |
| EV-05 | 스키마 검증·라우터, 예외 → HTTP | PM → ARCH → BE | 표현 | REJ-01~32, 전체 AC, NFR-02 | `schemas.py`, `router.py`, `/docs` | **정의됨** (상태 코드·거부 조건), 스키마는 Architect로 이관(ARCH-Q-01) |
| EV-06 | OAuth2·JWT 블랙리스트 | PM → ARCH → BE | 인증·보안 | US-08~11, AC-08~11, NFR-03, SCR-01·02 | `src/auth/`, 401 시연 | **정의됨** (흐름·AC), 토큰 설계는 Architect로 이관(ARCH-Q-05) |
| EV-07 | 미들웨어(CORS·로깅) | ARCH → BE | 웹·미들웨어 | REQ-T15 | `main.py`, 콘솔 로그 | Architect로 이관 |
| EV-08 | Jinja2·정적 파일 웹 화면 | PM → ARCH → FE | 웹·미들웨어 | US-15~17, SCR-01~06 (핵심 SCR-03·04·05, D-012), NFR-08 | `07-screens.md`, `templates/`, `static/` | **정의됨** (화면), 데이터 계약은 Architect로 이관 |
| EV-09 | 예외 방어(400/404), `.gitignore` | PM → ARCH → QA | 표현, 환경·형상 관리 | REJ-07~09·19·27, AC-02-3·02-6·06-5·14-2, NFR-02·09 | 에러 JSON, 저장소 | **정의됨** (거부 시나리오), `.gitignore`는 Architect로 이관 |
| EV-10 | README, 최종 시연·발표 | PM → ARCH → FE / 사람 | 문서화·발표 | `07-screens.md` §5, NFR-01 | README.md, 발표 | **정의됨** (시연 흐름 초안), README는 FE, 발표는 사람 |

## 2. 역할별 체크리스트 (RC)

| ID | 항목 | 담당 단계 | 발제 역할 | 연결 | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| RC-01 | 노션 기록(도메인 규칙·ERD·API 명세·진행 현황, 공개) | PM·ARCH / 사람 | 문서화 | `03-domain.md`, `07-screens.md` | 팀 노션 | **정의됨** (게시 원본), 게시는 사람 |
| RC-02 | uv 구성·`__init__.py` | ARCH → BE | 환경·형상 관리 | NFR-01 | `pyproject.toml`, `uv.lock` | Architect로 이관 |
| RC-03 | domain 외부 import 0 | ARCH → BE | 도메인 | `03-domain.md` §4 | `domain/*.py` | Architect로 이관 |
| RC-04 | 생성자·행위 메서드 자체 검증 | PM → BE | 도메인 | `03-domain.md` §4, INV-01~15 | `domain/*.py` | **정의됨** (검증 규칙) |
| RC-05 | `database.py` 비동기 세션·`get_db()` | ARCH → DB | 인프라 | REQ-T06 | `database.py` | Architect로 이관 |
| RC-06 | `models.py` 매핑 | ARCH → DB | 인프라 | `03-domain.md` §3 | `models.py` | Architect로 이관 (ARCH-Q-03) |
| RC-07 | 레포지토리 도메인 객체 변환·`save` | ARCH → DB | 인프라 | REQ-T07 | `repositories.py` | Architect로 이관 |
| RC-08 | lifespan 테이블 생성·시드 | ARCH → DB | 인프라 | NFR-06, D-014 | `main.py`, 시드 | Architect로 이관 (규모는 정의됨) |
| RC-09 | service의 단방향 참조 | ARCH → BE | 응용 | REQ-T03 | `service.py` | Architect로 이관 |
| RC-10 | 조회 → 도메인 메서드 → save → commit | ARCH → BE | 응용 | US-01~06, NFR-05 | `service.py` | Architect로 이관 |
| RC-11 | 스키마 Field·description | ARCH → BE | 표현 | US-01~14 입력 | `schemas.py` | Architect로 이관 |
| RC-12 | APIRouter·`Depends(get_db)`·`response_model` | ARCH → BE | 표현 | REQ-T11 | `router.py` | Architect로 이관 |
| RC-13 | 검색·필터·페이지네이션 | PM → BE | 표현 | US-12, AC-12-1~8, NFR-07 | 목록 API | **정의됨** (조건·기본값) |
| RC-14 | ValueError → 400 변환 | PM → BE | 표현 | REJ-04~24, NFR-02 | 전역 핸들러 | **정의됨** (거부 조건·코드) |
| RC-15 | OAuth2 로그인·비밀번호 해싱·Swagger 인가 | PM → BE | 인증·보안 | US-08, US-09, AC-08-1, AC-09-1 | `src/auth/` | **정의됨** (흐름·AC) |
| RC-16 | 블랙리스트 401 | PM → BE | 인증·보안 | US-10, AC-10-2 | `src/auth/` | **정의됨** |
| RC-17 | CORS·로깅·Jinja2·StaticFiles | PM·ARCH → BE·FE | 웹·미들웨어 | US-15~17, SCR-01~06 | `main.py`, `templates/` | **정의됨** (화면), 미들웨어는 Architect로 이관 |
| RC-18 | README·PPT·리허설 | FE / 사람 | 문서화·발표 | `07-screens.md` §5 | README.md, PPT | **정의됨** (시연 흐름), PPT·리허설은 사람 |

## 3. 도전 과제 (CH)

| ID | 항목 | 채택 (D-002) | 연결 | 상태 |
|---|---|---|---|---|
| CH-A | 커넥션 풀·동시성 제어 | Should (M6 첫 순서). 무결성 자체는 필수(NFR-04) | US-18, AC-18-1~5 | **정의됨**, 잠금 방식은 Architect로 이관(ARCH-Q-02) |
| CH-B | BackgroundTasks·StreamingResponse CSV | Could (A 다음) | US-19, AC-19-1~2 | **정의됨** |
| CH-C | 인메모리 캐싱·배포 구성 | Could (B 다음, 11일차 종료 시 중단) | US-20, AC-20-1~3 | **정의됨**, 캐시 방식은 Architect로 이관 |
