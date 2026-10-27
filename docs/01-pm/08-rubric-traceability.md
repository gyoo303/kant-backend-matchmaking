# 08. 발제 평가표 추적 매트릭스 (P8)

- 입력: 발제 평가표(`kant-rubric.md` §8·§9·§5), `01`~`07` PM 산출물
- 상태: **정의됨**(PM이 충족) / **Architect로 이관**(설계 증빙을 ARCH가 A8에서 채움) / **사람**(코드 밖 산출물)
- "증빙 산출물"의 코드 경로는 발제 구조 기준이며, ARCH가 실제 파일 경로로 갱신한다.

## 1. 요구사항 평가표 (EV)

| ID | 요구사항 | 담당 단계 | 발제 역할 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| EV-01 | 4계층 폴더 구조·단방향 의존성 | ARCH → BE·DB | 환경·형상 관리 | NFR-13 | `src/` 구조, ARCH 구조 문서 | Architect로 이관 (구조는 PM 범위 밖) |
| EV-02 | 순수 도메인 모델 | PM → ARCH → BE | 도메인 | `03-domain.md` §4·§7(INV-01~14), US-04~10, AC-04~10 | `03-domain.md`, `src/<기능>/domain/` | **정의됨** (규칙), 클래스 설계는 Architect로 이관 |
| EV-03 | 비동기 DB·레포지토리, lifespan 시드 | ARCH → DB | 인프라 | US-13, AC-13-1·2, NFR-07 | `database.py`, `models.py`, `repositories.py` | Architect로 이관 (시드 규모는 정의됨) |
| EV-04 | 응용 서비스 흐름·트랜잭션 | ARCH → BE | 응용 | US-04~10 정상 흐름 | `service.py` | Architect로 이관 |
| EV-05 | 스키마 검증·라우터, 예외 → HTTP | PM → ARCH → BE | 표현 | REJ-01~17, 전체 AC, NFR-02·03 | `schemas.py`, `router.py`, `/docs` | **정의됨** (상태 코드·거부 조건), 스키마는 Architect로 이관 |
| EV-06 | OAuth2·JWT 블랙리스트 | PM → ARCH → BE | 인증·보안 | US-01~03, AC-01~03, NFR-05, SCR-02·03·09 | `src/auth/`, 401 시연 | **정의됨** (흐름·AC), 토큰 설계는 Architect로 이관(→ARCH-06) |
| EV-07 | 미들웨어(CORS·로깅) | ARCH → BE | 웹·미들웨어 | NFR-11, NFR-12 | `main.py`, 콘솔 로그 | Architect로 이관 (기준은 정의됨) |
| EV-08 | Jinja2·정적 파일 웹 화면 | PM → ARCH → FE | 웹·미들웨어 | US-18~23, SCR-01~08 (핵심 SCR-01·07·08), NFR-08~10 | `07-screens.md`, `templates/`, `static/` | **정의됨** (화면), 데이터 계약은 Architect로 이관 |
| EV-09 | 예외 방어(400/404), `.gitignore` | PM → ARCH → QA | 표현, 환경·형상 관리 | REJ-06·11~15, AC-04-6·08-5·09-4, NFR-03·17 | 에러 JSON, 저장소 | **정의됨** (거부 시나리오), `.gitignore`는 Architect로 이관 |
| EV-10 | README, 최종 시연·발표 | PM → ARCH → FE / 사람 | 문서화·발표 | `07-screens.md` §6, NFR-01 | README.md, 발표 | **정의됨** (시연 흐름 초안), README 목차는 Architect로 이관, 발표는 사람 |

## 2. 역할별 체크리스트 (RC)

| ID | 문항 요지 | 담당 단계 | 발제 역할 | 연결 US / AC / SCR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| RC-01 | 노션에 도메인 규칙·ERD·API 명세·진행 현황 기록, 공개 | PM·ARCH / 사람 | PM·협업 | `03-domain.md` | 노션 공개 URL | **정의됨** (도메인 규칙 원본) / ERD·API 명세는 Architect로 이관 / 게시·진행 현황은 사람 |
| RC-02 | uv 구성, 모든 폴더 `__init__.py`, 실행 오류 없음 | ARCH → BE | 환경·형상 관리 | NFR-01, NFR-13 | `pyproject.toml`, `uv.lock` | Architect로 이관 |
| RC-03 | 도메인 클래스가 외부 라이브러리 import 0 | ARCH → BE | 도메인 | NFR-13 | `domain/*.py` | Architect로 이관 |
| RC-04 | 생성자·비즈니스 메서드가 규칙 자체 검사 | PM → ARCH → BE | 도메인 | `03-domain.md` §4, INV-01~14, AC-04-2·05-2·08-3 | `domain/*.py` | **정의됨** (규칙), 구현은 Architect로 이관 |
| RC-05 | `database.py` 비동기 세션·`get_db()` | ARCH → DB | 인프라 | — | `database.py` | Architect로 이관 |
| RC-06 | `models.py` 테이블 매핑 | ARCH → DB | 인프라 | `03-domain.md` §3 | `models.py` | Architect로 이관 |
| RC-07 | 레포지토리가 도메인 객체로 변환·`save` | ARCH → DB | 인프라 | — | `repositories.py` | Architect로 이관 |
| RC-08 | lifespan 테이블 생성·초기 데이터 | PM → ARCH → DB | 인프라 | US-13, AC-13-1·2, NFR-07 | `main.py` lifespan | **정의됨** (데이터 구성·규모), 구현은 Architect로 이관 |
| RC-09 | 서비스가 domain·infrastructure만 참조 | ARCH → BE | 응용 | NFR-13 | `service.py` | Architect로 이관 |
| RC-10 | 조회 → 도메인 메서드 → save → commit | ARCH → BE | 응용 | US-04·05·08·10 정상 흐름 | `service.py` | Architect로 이관 |
| RC-11 | 스키마 Field·description | ARCH → BE | 표현 | — | `schemas.py` | Architect로 이관 |
| RC-12 | APIRouter·`Depends(get_db)`·`response_model` | ARCH → BE | 표현 | NFR-04 | `router.py` | Architect로 이관 |
| RC-13 | 목록 검색·필터·페이지네이션 | PM → ARCH → BE | 표현 | US-11·12, AC-12-1~7, NFR-06, SCR-07 | `router.py` | **정의됨** (조건·기본값), 매개변수 설계는 Architect로 이관 |
| RC-14 | ValueError → 400 변환 | PM → ARCH → BE | 표현 | REJ-04·07~09·11~15·17, NFR-02·03 | `router.py`, 전역 핸들러 | **정의됨** (400 대상), 변환 설계는 Architect로 이관 |
| RC-15 | OAuth2 로그인·해싱·Swagger 인가 | PM → ARCH → BE | 인증·보안 | US-01·02, AC-01-1·02-1, SCR-09 | `src/auth/` | **정의됨** (흐름·AC), 구현은 Architect로 이관 |
| RC-16 | 블랙리스트 토큰 401 | PM → ARCH → BE | 인증·보안 | US-03, AC-03-2·03-3, NFR-05 | `src/auth/` | **정의됨** (AC), 구현은 Architect로 이관 |
| RC-17 | CORS·로깅·Jinja2·StaticFiles | PM → ARCH → BE·FE | 웹·미들웨어 | NFR-08~12, SCR-01~08 | `main.py`, `templates/`, `static/` | **정의됨** (기준·화면), 구현은 Architect로 이관 |
| RC-18 | README·PPT·리허설 | ARCH → FE / 사람 | 문서화·발표 | `07-screens.md` §6 | README.md, PPT | Architect로 이관 (README 목차) / PPT·리허설은 사람 |

## 3. 도전 과제 (CH)

D-002: 11일차에 A → B → C → D 순서로 진행, 11일차 종료 시 남은 것은 중단.

| ID | 내용 | 분류 | 담당 단계 | 연결 US / AC / NFR | 증빙 산출물 | 상태 |
|---|---|---|---|---|---|---|
| CH-A | 커넥션 풀·동시성 제어 | Should (1순위) | PM → ARCH → BE·QA | US-24, AC-24-1~3, NFR-14 | 재현 스크립트 결과(적용 전·후) | **정의됨** (AC), 방식은 Architect로 이관(ADR) |
| CH-B | BackgroundTasks·CSV 스트리밍 | Could (2순위) | PM → ARCH → BE | US-25·26, AC-25-1·2·26-1·2, NFR-16 | 후처리 로그, CSV | **정의됨** (AC), 설계는 Architect로 이관 |
| CH-C | 인메모리 캐싱·배포 구성 | Could (3순위) | PM → ARCH → BE | US-27·28, AC-27-1·2·28-1 | 캐시 전후 비교, 실행 구성 | **정의됨** (AC), 방식은 Architect로 이관(ADR) |
| (팀) 도전 D | 연결 끊김 처리 | Could (4순위) | PM → ARCH → BE·FE | US-29·30, AC-29-1·2·30-1, NFR-18 | 타임아웃·복귀 시연 | **정의됨** (AC), 응답 없음 판정은 Architect로 이관(→ARCH-05) |

## 4. 점검

- 빈 행: 0 (EV 10, RC 18, CH 3 + 팀 도전 1)
- PM 직접 충족 항목: RC-01(도메인 규칙), EV-02(규칙 정의), EV-10(시연 흐름 초안) — 모두 **정의됨**
- 사람 몫: 노션 게시·진행 현황(RC-01), PPT·발표·리허설(EV-10, RC-18)
