# 5인 작업 분담표 — 2vs2 매치메이킹 손코딩

> 대상: `dev` 브랜치 스켈레톤(주석만 있는 파일)을 5명이 나눠 구현
> 범위: 실제 동작하는 코드(`src/`, 설정 파일)만. 테스트 작성·코드 검증은 이 표에 넣지 않았어요
> 설계 기준: `reference/agent-pipeline-blueprint` 브랜치의 `docs/01-pm/`, `docs/02-arch/` (팀 엔티티 `Team`, A팀 우선 배정 반영)

---

## 1. 나눈 기준

- **파일 단위로 주인을 정했어요.** 한 파일은 한 사람만 수정해요. 다른 사람 코드는 import해서 쓰기만 해요.
- 작업량은 참고 구현의 줄 수(공백 제외)에 난이도 가중치를 곱해 맞췄어요.
  - 가중치: 백엔드 로직 ×1.5, JS ×1, HTML·CSS ×0.5
  - 다섯 명 모두 약 570~690 사이예요.

## 2. 작업분담표

| 담당 | 역할 | 맡는 파일 | 작업량(가중) | 난이도 |
|---|---|---|---|---|
| **A** | 공통 기반·앱 조립 | `pyproject.toml`, `.env.example`, `src/config.py`, `src/database.py`, `src/exceptions.py`, `src/logging_middleware.py`, `src/main.py`, `src/seed.py`, `templates/base.html`, `templates/partials/*`, `static/css/app.css`, `static/js/polling.js`, 모든 `__init__.py` | ≈ 590 | 중 |
| **B** | 인증 전체 | `src/auth/` 전부(domain·infrastructure·application·presentation), `templates/auth/login.html`·`signup.html`, `static/js/api.js` | ≈ 670 | 중~상 |
| **C** | 방 도메인·변경 서비스 | `src/rooms/domain/`(`room.py`, `team.py`, `participation.py`, `exceptions.py`), `src/rooms/application/service.py`, `src/rooms/presentation/pages.py`, `templates/rooms/history.html`·`archived.html` | ≈ 665 | 상 |
| **D** | 방 DB·조회 | `src/rooms/infrastructure/models.py`·`repositories.py`, `src/rooms/application/queries.py`·`read_models.py` | ≈ 570 | 상 |
| **E** | 방 API·메인/상세 화면 | `src/rooms/presentation/router.py`·`schemas.py`, `templates/rooms/list.html`·`detail.html`, `static/js/rooms.js` | ≈ 690 | 중~상 |

- A와 D는 양이 조금 적어요. 대신 D는 ORM 관계·팀 연결이라 가장 어렵고, A는 앱 전체를 조립해요.

## 3. 담당별 구현 내용

### A — 공통 기반·앱 조립
- 프로젝트 설정
  - 의존성·ruff 설정(`pyproject.toml`), 환경변수 이름(`.env.example`)
  - pydantic-settings로 설정 읽기(`config.py`)
- `database.py`: AsyncEngine, 세션 팩토리, `Base`, 요청당 세션 하나를 주는 `get_db()`
- `exceptions.py`: 도메인 예외 기반 클래스(400·404·410용)
- 요청 로깅 미들웨어: `method/path/status/duration_ms` 한 줄
- `main.py`
  - lifespan: 테이블 생성 → 시드
  - CORS, 전역 예외 핸들러(400·401·404·410·422·500을 `{"detail": "..."}`로)
  - 라우터·정적 파일 등록
- `seed.py`: 회원 14명, 방 8개(팀 16행), 참가 20건. `seed01`이 있으면 건너뜀
- 화면 공통 틀(`base.html`, 안내·페이지 이동 조각), 공통 CSS
- 1초 폴링 유틸(`polling.js`): 요청이 겹치지 않게, 탭이 숨으면 멈춤

### B — 인증 전체
- 도메인: `User`(아이디·닉네임·비밀번호 규칙 검사), `TokenBlacklist`, 인증 예외
- 인프라
  - `UserModel`·`TokenBlacklistModel`과 레포지토리
  - `security.py`: bcrypt 해시, access·refresh JWT 발급·해독
- 서비스: 회원가입(중복 확인), 로그인, 로그아웃(두 토큰을 블랙리스트에), 토큰 재발급
- API·의존성
  - `/api/auth/*` 5개
  - `get_current_user`: 토큰 해독 → 블랙리스트 확인 → 회원 조회
- 화면
  - 로그인·회원가입 화면
  - `api.js`: 토큰 저장, 모든 API 호출 공통 함수, 401이면 재발급 후 한 번 다시 시도

### C — 방 도메인·변경 서비스
- `Room`: 생성(A·B 두 팀 함께), 참가(A팀 우선 배정), 제목 변경, 팀 이동, 나가기(방장 위임·빈 방 삭제), 게임 시작(해산)
- `Team`: 팀 정원 2명 검사(`add`/`remove`)
- `Participation`: 입장·퇴장 기록
- 방 관련 도메인 예외
- `service.py`: 레포지토리로 조회 → 도메인 메서드 → 저장 → commit
  - 생성·참가·제목·팀·나가기·시작 6개 흐름
- 화면 라우트 6개(`pages.py`)
- 내 이용 기록·보관 정보 화면(각 화면의 인라인 스크립트 포함)

### D — 방 DB·조회
- ORM 모델: `RoomModel`·`TeamModel`·`ParticipationModel`과 관계(`relationship`)
- `RoomRepository`
  - ORM ↔ 도메인 변환
  - 새 방이면 팀 2행 생성, 참가를 같은 방의 팀에 연결
  - 현재 참가 조회
- `RoomQueryRepository`·`queries.py`
  - 공개 방 목록(검색·빈자리 필터·정렬·페이지)
  - 방 상세(404·410 구분), 내 현재 방, 이용 기록, 보관 정보
- `read_models.py`: 조회 결과를 담는 읽기 모델 데이터클래스

### E — 방 API·메인/상세 화면
- `router.py`: rooms API 11개. 인증 의존성, 서비스·조회 호출, 응답 변환
- `schemas.py`: 요청·응답 스키마(필드 description, 422 검증)
- 메인(공개 방 목록)·방 상세 화면 템플릿
- `rooms.js`
  - 목록 1초 갱신, 방 만들기·참가
  - 상세의 팀 구성 표시, 팀 이동·나가기·제목 변경·게임 시작 버튼
  - 해산·404·401 처리

## 4. 서로 맞출 곳

같은 파일을 함께 수정하지 않아요. 맞출 것은 아래 연결 지점뿐이에요. 이름과 시그니처는 reference 브랜치의 `docs/02-arch/04-interfaces-api.md`에 확정돼 있어요.

| 연결 지점 | 만드는 사람 → 쓰는 사람 | 맞출 것 |
|---|---|---|
| `main.py` 라우터 등록 | B·C·E → A | 라우터 변수 이름만 알려 주면 A가 등록. 다른 사람은 `main.py`를 수정하지 않아요 |
| 도메인 ↔ 레포지토리 | C → D | `Room(…, teams, participations)` 생성자, `Team(id, side)` (§2.3~2.5) |
| 서비스·조회 ↔ 라우터 | C·D → E | 서비스·조회 메서드 이름과 반환 타입(§3), 읽기 모델 |
| 템플릿 ↔ JS | 템플릿 작성자 ↔ JS 작성자 | 메인·상세 화면은 E가 템플릿과 `rooms.js`를 둘 다 맡아요. `api.js`(B) 함수는 다른 사람이 호출만 해요 |

## 5. 진행 순서

**먼저 끝낼 것** (반나절 안에)
1. **A**: `config.py`, `database.py`, `exceptions.py`
   - 모두 이 파일들을 import해요.
2. **C**: `Room`·`Team`·`Participation`의 생성자와 메서드 이름을 빈 껍데기로 먼저 올리기
   - D(레포지토리)와 E(라우터)가 기다리지 않게 하려는 거예요.
3. **B**: `get_current_user` 의존성의 이름과 반환값 먼저 공유
   - E의 라우터가 모두 이 의존성을 써요.

나머지는 동시에 진행해요. `seed.py`(A)는 C의 도메인과 D의 레포지토리가 끝난 뒤에 마무리해요.
