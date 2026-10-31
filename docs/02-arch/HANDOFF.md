# HANDOFF — 하위 에이전트 티켓 (A8)

- 입력: `01-drivers.md`~`06-quality-gates.md`, ADR-001~005·007~011(Accepted, ADR-006은 ADR-009로 대체, ADR-009의 부분 유니크 인덱스는 ADR-011로 대체), `docs/01-pm/04-scope.md` 마일스톤(D-001)
- **진행 원칙(D-018)**: DB·BE·FE·QA는 필수 티켓(M2~M5, M7)만 차례로 진행한다. M6 도전 티켓("요청 시" 표시)은 필수 완료 뒤 **사용자가 티켓 ID를 지정해 요청할 때만** 착수한다. 선행 점검이 READY여도 요청 없이 시작하지 않는다.
- 모든 티켓 공통으로 먼저 읽는다: `docs/02-arch/05-structure-conventions.md`(CONV·금지 패턴, **§8 교안 수준 규칙**), `docs/02-arch/06-quality-gates.md`
- **교안 수준 규칙(D-020)**: 모든 DB·BE·FE 티켓은 교안 1~6장 수준으로 구현한다. 인증·보안은 교안 6장 1강(ADR-002, D-021). 완료된 M2·M3 티켓 코드는 2026-10-28에 이 규칙으로 고쳤다(아래 표의 완료 티켓 설명은 작성 당시 기준이며, 현재 기준은 `03-db-schema.md`·`04-interfaces-api.md`).

## 1. 티켓

| TKT | 담당 | 마일스톤(일차) | 내용 | 읽을 것 | 산출 | 완료 조건 | 선행 |
|---|---|---|---|---|---|---|---|
| TKT-BE-M2-01 | BE | M2 (3) | 프로젝트 골격: 의존성·ruff 설정, 모든 패키지 `__init__.py`, pytest 설정(STK-01·STK-11), `config.py`(Settings: `database_url`, `jwt_secret_key`, `jwt_expire_minutes=60`, `cors_origins`, `cookie_secure=False`, `db_pool_size=10`, `db_max_overflow=10`, `seed_user_password`), `exceptions.py`, `.env.example`, 최소 `main.py`(FastAPI 앱) | `02-system-architecture.md` §3, ADR-003, ADR-005, `04-interfaces-api.md` §1.1 | `pyproject.toml`, `uv.lock`, `.env.example`, `src/__init__.py`·각 패키지 `__init__.py`, `src/config.py`, `src/exceptions.py`, `src/main.py` | GATE-01(`/docs` 200, DB 없이), GATE-03, GATE-05 | — |
| TKT-DB-M2-01 | DB | M2 (3) | `database.py`: `create_async_engine(settings.database_url, pool_size, max_overflow)`, `AsyncSessionLocal = async_sessionmaker(class_=AsyncSession, expire_on_commit=False)`, `Base(DeclarativeBase)`, `get_db()`(예외 시 rollback) | `04-interfaces-api.md` §8, ADR-003 | `src/database.py` | GATE-05, 세션 생성 확인 | TKT-BE-M2-01 |
| TKT-BE-M3-01 | BE | M3 (4) | 도메인 클래스·예외: `User`, `TokenBlacklist`, `Room`, `RoomTitle`, `TeamSide`, `DeleteReason`, `Participation`, 기능별 `exceptions.py`. 읽기 모델 `rooms/application/read_models.py`. `auth/infrastructure/security.py`의 `PasswordHasher`(시드에 필요) | `04-interfaces-api.md` §1·§2·§3(읽기 모델), `docs/01-pm/03-domain.md` §4·§6 | `src/auth/domain/*.py`, `src/rooms/domain/*.py`, `src/rooms/application/read_models.py`, `src/auth/infrastructure/security.py`(PasswordHasher만) | GATE-02, GATE-07(domain 항목), INV-01~12가 메서드에 반영 | TKT-BE-M2-01 |
| TKT-DB-M3-01 | DB | M3 (5) | `UserModel`, `TokenBlacklistModel`, `UserRepository`, `TokenBlacklistRepository` (중복 아이디·닉네임 `IntegrityError` → `Duplicate*Error`) | `03-db-schema.md` §3.1·§3.2·§5 | `src/auth/infrastructure/models.py`, `src/auth/infrastructure/repositories.py` | GATE-02, GATE-08 | TKT-DB-M2-01, TKT-BE-M3-01 |
| TKT-DB-M3-02 | DB | M3 (5~6) | `RoomModel`, `ParticipationModel`(CHECK·UNIQUE·조회 인덱스. 부분 유니크 인덱스 `uq_participations_user_current`는 넣지 않음), `RoomRepository`(`find_by_id`, `find_current_participation`, `save`), `RoomQueryRepository`(목록 ILIKE ESCAPE·집계·정렬·페이지, 상세, 이력, 보관 정보) | `03-db-schema.md` §2~§5, `04-interfaces-api.md` §2·§9(SEQ-05~10), ADR-001, ADR-009 | `src/rooms/infrastructure/models.py`, `src/rooms/infrastructure/repositories.py` | GATE-02, GATE-08, 제약 이름이 문서와 같음 | TKT-DB-M3-01 |
| TKT-DB-M3-03 | DB | M3 (6) | `seed_initial_data()`: 회원 14·활성 방 5·삭제 방 3·참가 20, `seed01` 존재 시 건너뜀 | `03-db-schema.md` §6 | `src/seed.py` | 합계 42건, 재실행 시 0건 추가(NFR-06) | TKT-DB-M3-02 |
| TKT-BE-M3-02 | BE | M3 (6) | `RoomApplicationService`: `create_room`, `join_room`, `rename_room`, `change_team`, `leave_room`, `start_game` (`find_by_id` 조회·commit·`clock` 주입, `list_cache`는 None 허용, 잠금 없음) | `04-interfaces-api.md` §3·§8·§9(SEQ-05~09)·§11, ADR-009 | `src/rooms/application/service.py` | GATE-07, 순차 요청 기준 INV 위반 0 | TKT-DB-M3-02 |
| TKT-BE-M3-03 | BE | M3 (7) | `RoomQueryService`: `list_rooms`, `get_room_detail`(404·410 분기), `get_current_room`, `list_history`, `get_archived_room` | `04-interfaces-api.md` §3·§9(SEQ-10), D-016 | `src/rooms/application/queries.py` | GATE-08 | TKT-DB-M3-02 |
| TKT-BE-M3-04 | BE | M3 (7) | rooms 스키마·라우터 API-ROOM-01~11. 현재 회원은 임시 의존성 `auth/presentation/dependencies.py::get_current_user_id`가 요청 헤더 `X-Debug-User-Id`를 읽음(D-001, M4에서 교체) | `04-interfaces-api.md` §4.2·§4.3·§5.2, CONV-03·04 | `src/rooms/presentation/schemas.py`, `src/rooms/presentation/router.py`, `src/auth/presentation/dependencies.py`(임시) | Swagger에 API 11개, 응답에 입장 순서·해시 없음 | TKT-BE-M3-02, TKT-BE-M3-03 |
| TKT-BE-M3-05 | BE | M3 (7) | `main.py`: lifespan(SEQ-12: `create_all` → `seed_initial_data`), 전역 예외 핸들러(400·404·410·401·422 ADR-004·500), 라우터 등록 | `04-interfaces-api.md` §1·§6·§9(SEQ-12), ADR-004 | `src/main.py` | GATE-01(시드 로그 1회), AC-02-3·06-5 수동 curl 확인 | TKT-BE-M3-04, TKT-DB-M3-03 |
| TKT-QA-M3-01 | QA | M3 (7) | 도메인 단위 테스트(INV·상태 머신), rooms API 통합 테스트 AC-01~07, `conftest.py`(테스트 DB) | `06-quality-gates.md` §2·§3, `docs/01-pm/06-acceptance-criteria.md` US-01~07 | `tests/conftest.py`, `tests/unit/*`, `tests/integration/test_rooms_api.py`, `tests/integration/test_errors.py` | GATE-01~08 통과, AC-01~07 테스트 존재·통과 | TKT-BE-M3-05 |
| TKT-BE-M4-01 | BE | M4 (8) | 교안 6장 1강 3.3절 모양의 `security.py` 토큰 함수(`create_access_token`·`create_refresh_token`·`decode_token`, `sub`·`exp`·`token_type`), `AuthApplicationService(db)`(signup·login·refresh·logout·authenticate), auth 예외 `InvalidRefreshTokenError`·`AlreadyLoggedOutError` | `04-interfaces-api.md` §1.2·§3·§9(SEQ-01~04b), ADR-002, D-021 | `src/auth/infrastructure/security.py`, `src/auth/application/service.py`, `src/auth/domain/exceptions.py` | GATE-06, GATE-07 | TKT-DB-M3-01, TKT-BE-M3-05 |
| TKT-BE-M4-02 | BE | M4 (8) | auth 스키마·라우터 API-AUTH-01~05(로그인은 `OAuth2PasswordRequestForm`, 로그아웃은 Bearer + `RefreshRequest`, 재발급). 쿠키 없음 | `04-interfaces-api.md` §4.1·§5.1, ADR-002 | `src/auth/presentation/schemas.py`, `src/auth/presentation/router.py`, `src/main.py`(등록) | Swagger Authorize로 로그인 성공, 응답에 해시 없음 | TKT-BE-M4-01 |
| TKT-BE-M4-03 | BE | M4 (8) | 인증 의존성을 SEQ-03으로 교체(`oauth2_scheme`, `get_current_user`, `get_current_user_id`), `X-Debug-User-Id` 코드 삭제 | `04-interfaces-api.md` §9(SEQ-03), ADR-002 | `src/auth/presentation/dependencies.py` | `grep -rn "X-Debug-User-Id" src/` 0줄, 로그아웃한 access 토큰 401 | TKT-BE-M4-02 |
| TKT-QA-M4-01 | QA | M4 (8) | 인증 통합 테스트 AC-08~11, NFR-03, 기존 rooms 테스트를 실제 토큰으로 전환 | `06-acceptance-criteria.md` US-08~11·NFR-03 | `tests/integration/test_auth_api.py`, `tests/conftest.py` | GATE-04, AC-08~11 통과 | TKT-BE-M4-03 |
| TKT-BE-M5-01 | BE | M5 (9) | `RequestLoggingMiddleware`(CONV-07), CORS(CONV-10·11), `StaticFiles`·`Jinja2Templates`, 화면 라우터 PAGE-01~06(인증 없음, 템플릿 틀과 URL 값만 넘김, D-021) | `04-interfaces-api.md` §7·§9(SEQ-11), CONV-07~12 | `src/logging_middleware.py`, `src/main.py`, `src/auth/presentation/pages.py`, `src/rooms/presentation/pages.py` | 화면 6개 200(토큰 없이), 콘솔 로그 형식 일치 | TKT-BE-M4-03 |
| TKT-FE-M5-01 | FE | M5 (9) | 공통: `base.html`, `partials/*`, `app.css`(스타일 토큰 값 정의, `05-structure-conventions.md` §6·D-019), `api.js`(Bearer 헤더, 토큰 없으면 `/login`, 401 → 재발급 1회 → 실패 시 `/login?expired=1`), `polling.js`(SEQ-13) | `04-interfaces-api.md` §7·§9(SEQ-13), `docs/01-pm/07-screens.md` §2 | `src/templates/base.html`, `src/templates/partials/*.html`, `src/static/css/app.css`, `src/static/js/api.js`, `src/static/js/polling.js` | 탭 숨김 시 요청 0건, 겹침 요청 0건 | TKT-BE-M5-01 |
| TKT-FE-M5-02 | FE | M5 (9) | SCR-01 회원가입, SCR-02 로그인 | `07-screens.md` §4, `04-interfaces-api.md` PAGE-01·02, API-AUTH-01·02 | `src/templates/auth/signup.html`, `src/templates/auth/login.html` | AC-17-1 | TKT-FE-M5-01 |
| TKT-FE-M5-03 | FE | M5 (10) | SCR-03 공개 방 목록(메인): 생성 폼, 검색·필터·정렬·페이지, 현재 방 링크, 마감 표시, 1초 폴링, 해산 안내 | `07-screens.md` §3 SCR-03, `04-interfaces-api.md` PAGE-03·API-ROOM-01·02·05·09 | `src/templates/rooms/list.html`, `src/static/js/rooms.js` | AC-15-1~7 | TKT-FE-M5-01 |
| TKT-FE-M5-04 | FE | M5 (10) | SCR-04 방 상세(현황 대시보드): 팀 구성, 팀 이동·나가기·제목 변경·게임 시작, 410/404/401 분기 | `07-screens.md` §3 SCR-04, `04-interfaces-api.md` PAGE-04·API-ROOM-03~08 | `src/templates/rooms/detail.html`, `src/static/js/rooms.js` | AC-16-1~7 | TKT-FE-M5-03 |
| TKT-FE-M5-05 | FE | M5 (10) | SCR-05 내 기록(목록), SCR-06 보관 정보 | `07-screens.md` §3 SCR-05·§4, `04-interfaces-api.md` PAGE-05·06 | `src/templates/rooms/history.html`, `src/templates/rooms/archived.html` | AC-17-2~4, AC-14-3 | TKT-FE-M5-01 |
| TKT-QA-M5-01 | QA | M5 (10) | 목록·이력·보관 정보 통합 테스트 AC-12~14, NFR-02·06·07, 화면 수동 점검표 AC-15~17·NFR-08 | `06-acceptance-criteria.md` US-12~17·NFR, `06-quality-gates.md` §2 | `tests/integration/test_history_api.py`, `tests/integration/test_rooms_api.py` | GATE-01~08, 필수 AC 전부 통과 (필수 100%) | TKT-FE-M5-02, TKT-FE-M5-04, TKT-FE-M5-05 |
| TKT-DB-M6-01 | DB | M6 (11, Should, 요청 시) | 도전 A: `RoomRepository.find_by_id_for_update`(방 행 `FOR UPDATE`), `save`의 `IntegrityError`(`participations` PK·`user_id` unique 위반, ADR-011) → `AlreadyParticipatingError` 변환 | ADR-009, ADR-011, `03-db-schema.md` §3.4·§5 | `src/rooms/infrastructure/models.py`, `src/rooms/infrastructure/repositories.py` | GATE-08, 같은 회원 동시 생성이 400 | TKT-QA-M5-01 |
| TKT-BE-M6-00 | BE | M6 (11, Should, 요청 시) | 도전 A: `RoomApplicationService`의 참가·제목·팀·나가기·게임 시작 조회를 `find_by_id_for_update`로 교체 | ADR-009, `04-interfaces-api.md` §9(SEQ-06~09), CONV-08 | `src/rooms/application/service.py` | GATE-09 | TKT-DB-M6-01 |
| TKT-QA-M6-01 | QA | M6 (11, Should, 요청 시) | 도전 A: 동시 요청 재현 테스트 AC-18-1~5 | ADR-009, `06-acceptance-criteria.md` US-18 | `tests/concurrency/test_room_concurrency.py` | AC-18-1~5 통과 | TKT-BE-M6-00 |
| TKT-BE-M6-01 | BE | M6 (11, Could, 요청 시) | 도전 B: 게임 시작 후 `BackgroundTasks` 해산 로그, API-ROOM-12 CSV 스트리밍 | `04-interfaces-api.md` §4.2·§9(SEQ-14) | `src/rooms/presentation/router.py`, `src/rooms/application/queries.py`, `src/rooms/infrastructure/repositories.py`(스트리밍 조회 메서드 추가는 BE가 DB 브리핑에 기록) | AC-19-1·2 | TKT-QA-M6-01 |
| TKT-BE-M6-02 | BE | M6 (11, Could, 요청 시) | 도전 C: `RoomListCache`(TTL 5초, commit 후 clear), 프로덕션 실행 구성(README용 명령) | ADR-007, ADR-008 | `src/rooms/application/list_cache.py`, `src/rooms/application/service.py`, `src/rooms/application/queries.py` | AC-20-1~3 | TKT-BE-M6-01 |
| TKT-QA-M6-02 | QA | M6 (11, Could, 요청 시) | 도전 B·C 검증 AC-19·20 | `06-acceptance-criteria.md` US-19·20 | `tests/integration/test_challenges.py` | AC-19·20 통과 | TKT-BE-M6-02 |
| TKT-FE-M7-01 | FE | M7 (12) | README (§2 목차) | `05-structure-conventions.md` §1, `02-system-architecture.md` §4, ADR-008, `07-screens.md` §5 | `README.md` | 목차 항목 전부, 캡처 5종 | TKT-QA-M5-01 |
| TKT-QA-M7-01 | QA | M7 (12~13) | 최종 통합 점검: GATE 전체, 시연 흐름(`07-screens.md` §5) 리허설 체크, 시드 재기동 확인 | `06-quality-gates.md`, `docs/01-pm/07-screens.md` §5 | — | GATE-01~08, 시연 7단계 통과 | TKT-FE-M7-01 |
| TKT-BE-M8-01 | BE | M8 (14, 튜터 피드백) | 도메인 `Team`(`team.py`: `CAPACITY`, `members`, `add`, `remove`), `Room`이 팀 2개를 갖도록(`__init__(…, teams, participations)`, `team(side)`, `create`가 팀 2개 생성), 참가 배정 A팀 우선(D-024), `change_team`·`leave`·`start_game`이 `Team`을 통해 검사. `application/`·`presentation/`은 바뀌지 않음 | ADR-010, `04-interfaces-api.md` §2.3~§2.5, D-023·D-024, AC-02-1·2·9 | `src/rooms/domain/team.py`, `src/rooms/domain/room.py` | GATE-02·05·07, 도메인이 `Team.add`로 팀 정원 거부 | TKT-QA-M7-01 |
| TKT-DB-M8-01 | DB | M8 (14, 튜터 피드백) | `TeamModel`(`teams`), `ParticipationModel.team` → `team_id` FK·`team` 관계, `RoomModel.teams`. `RoomRepository`(새 방이면 팀 2행, `TeamSide` ↔ `TeamModel` 연결, `selectinload`에 팀 추가), `RoomQueryRepository` 상세 정렬. 시드 결과(팀 16행) 확인. 기존 개발 DB 재생성 방법을 브리핑에 적는다 | ADR-010, `03-db-schema.md` §1·§2·§3.4·§3.5·§5·§6 | `src/rooms/infrastructure/models.py`, `src/rooms/infrastructure/repositories.py`, `src/seed.py` | GATE-01·02·08, 시드 `teams=16` | TKT-BE-M8-01 |
| TKT-QA-M8-01 | QA | M8 (14, 튜터 피드백) | 팀 엔티티·A팀 우선 배정 검증: 단위 테스트(`Team`, `Room` 배정·이동·시작), 통합 테스트 기대값 갱신(AC-02-1·9, 테이블 목록, 시드 건수), 팀 연결 통합 테스트(RISK-13), GATE 전체·시연 리허설 | ADR-010, `06-acceptance-criteria.md` US-02, `06-quality-gates.md` | `tests/unit/test_team.py`, `tests/unit/test_room.py`, `tests/integration/test_rooms_api.py`, `tests/conftest.py` | GATE-01~08, AC-02-1~9 통과 | TKT-DB-M8-01 |
| TKT-BE-M9-01 | BE | M9 (15, D-025) | `Participation`에서 `id` 제거(식별 = `room_id`+`user_id`), `Room.create`·`Room.join`의 생성 호출 수정. 읽기 모델 `HistoryItem`·응답 `HistoryItemResponse`에서 `participation_id` 제거. 그 밖의 도메인 규칙·서비스 흐름은 바뀌지 않음 | ADR-011, `04-interfaces-api.md` §2.3·§2.5·§5, D-025, AC-13-5 | `src/rooms/domain/participation.py`, `src/rooms/domain/room.py`, `src/rooms/application/read_models.py`, `src/rooms/presentation/schemas.py` | GATE-02·05·07 | TKT-QA-M8-01 |
| TKT-DB-M9-01 | DB | M9 (15, D-025) | `ParticipationModel`을 복합 PK(`room_id`+`user_id`)·`user_id` unique·`left_at` 없음으로, `ParticipationLogModel`(`participation_logs`) 추가, `RoomModel.participations`에 `cascade="all, delete-orphan"`. `RoomRepository`(`find_current_participation`, `save`의 짝짓기·로그 이동), `RoomQueryRepository`(현재 인원, `list_history` 합치기, `get_archived_room` 로그만). 시드: 현재 11 + 로그 11(D2 seed12 재입장 예시). 기존 개발 DB 재생성 방법을 브리핑에 적는다 | ADR-011, `03-db-schema.md` §1·§2·§3.3·§3.4·§3.6·§5·§6, STK-04 | `src/rooms/infrastructure/models.py`, `src/rooms/infrastructure/repositories.py`, `src/seed.py` | GATE-01·02·08, 시드 `participations=11 participation_logs=11 total=60` | TKT-BE-M9-01 |
| TKT-QA-M9-01 | QA | M9 (15, D-025) | 현재 참가·이용 로그 분리 검증: 단위 테스트(`Participation` 생성 인자), 통합 테스트(AC-02-8 재입장 → 로그, AC-13-1·3·5 이력 합치기·기록 ID 없음, AC-14-1 보관 정보, 퇴장·해산 후 `participations` 0행·로그 건수(RISK-14), 테이블 목록·시드 건수), GATE 전체·시연 리허설 | ADR-011, `06-acceptance-criteria.md` US-02·05·06·13·14, `06-quality-gates.md` | `tests/unit/test_participation.py`, `tests/unit/test_room.py`, `tests/integration/test_rooms_api.py`, `tests/integration/test_history_api.py`, `tests/conftest.py` | GATE-01~08, AC-02·05·06·13·14 통과 | TKT-DB-M9-01 |

- M6 티켓은 사용자가 요청할 때만 착수하고, 11일차가 끝나면 남은 것을 중단한다(D-002, D-018). 요청 순서 기준: 도전 A(TKT-DB-M6-01 → TKT-BE-M6-00 → TKT-QA-M6-01) → 도전 B(TKT-BE-M6-01) → 도전 C(TKT-BE-M6-02) → TKT-QA-M6-02. 사용자가 일부만 요청하면 그 티켓과 선행만 진행한다.
- M7 티켓(TKT-FE-M7-01, TKT-QA-M7-01)은 M6 진행 여부와 상관없이 필수 완료(TKT-QA-M5-01) 뒤에 진행한다.
- M8 티켓(TKT-BE-M8-01 → TKT-DB-M8-01 → TKT-QA-M8-01)은 튜터 피드백 반영(D-023·D-024, ADR-010)이다. 도메인 `Team`이 레포지토리보다 먼저 필요하므로 BE가 먼저다. 기존 DB(`matchmaking` 등)는 지우고 다시 만든다.
- M9 티켓(TKT-BE-M9-01 → TKT-DB-M9-01 → TKT-QA-M9-01)은 현재 참가와 이용 로그 분리(D-025, ADR-011)다. 도메인 `Participation` 시그니처가 레포지토리보다 먼저 필요하므로 BE가 먼저다. 기존 DB는 지우고 다시 만든다.
- 마일스톤별 티켓 수: M2 2 · M3 9 · M4 4 · M5 7 · M6 6(요청 시) · M7 2 · M8 3 · M9 3 = 36

### 공통 "하지 말 것"
- 사용자 요청 없이 M6 도전 티켓을 착수하거나, 필수 티켓에 도전 범위(잠금·`IntegrityError` 400 변환·캐시·CSV·백그라운드 로그)를 미리 넣지 않는다(D-018). `participations`의 PK·unique는 필수 스키마다(ADR-011).
- 스키마·API·도메인 시그니처를 임의로 바꾸지 않는다. 바꿔야 하면 멈추고 Architect에 질문한다.
- 담당 구역 밖 파일을 쓰지 않는다. 예외는 표의 "산출" 열에 적힌 파일뿐이다.
- 게임 결과·승패 관련 코드를 만들지 않는다(INV-09, GATE-07).

## 2. README 목차 (TKT-FE-M7-01, EV-10·RC-18)

1. 주제·Use Case 소개 (`docs/01-pm/03-domain.md` §1 한 문장 정의, 게임 결과 없음)
2. 4계층 디렉토리·컴포넌트 구조도 (트리 텍스트: `05-structure-conventions.md` §1, 요청 흐름: `02-system-architecture.md` §4)
3. 로컬 실행 방법: `git clone` → `uv sync` → PostgreSQL 실행·DB 생성 → `.env.example`을 `.env`로 복사해 값 설정 → `uv run uvicorn main:app --app-dir src --reload` → `http://localhost:8000`
4. 시연 계정: `seed01`~`seed14`, 비밀번호는 `.env`의 `SEED_USER_PASSWORD` 값
5. 시연 실행(도전 C 채택 시): `uv run uvicorn main:app --app-dir src --host 0.0.0.0 --port 8000 --workers 1`
6. 캡처: Jinja2 화면(SCR-03·04·05), Swagger UI, 200 정상, 400 규칙 차단, JWT 블랙리스트 401
7. 테스트 실행: `TEST_DATABASE_URL` 설정 후 `uv run pytest`

## 3. 평가표 추적 갱신 결과

`docs/01-pm/08-rubric-traceability.md`의 "Architect로 이관" 행에 설계 증빙(ADR/ENT/API/PAGE/CONV/GATE·파일 경로)을 채웠다. 빈 행 0.

## 4. 구현 계약 체크리스트 결과 (architect-agent A8-1)

| IC | 항목 | 위치 |
|---|---|---|
| IC-01 | 단계별 쓰는 경로, 공통 파일 담당 | `05-structure-conventions.md` §1(파일마다 담당 단계 표시), 이 문서 §1 "산출" 열 |
| IC-02 | 테스트 작성 담당·위치 | `06-quality-gates.md` §2(테스트 작성 담당), 각 TKT-QA "산출" |
| IC-03 | 스택·버전, 디렉토리, import 규칙 | `02-system-architecture.md` §3, `05-structure-conventions.md` §1, STK-01 |
| IC-04 | 의존 방향, 금지 패턴 | `05-structure-conventions.md` §2·§4 |
| IC-05 | 명명 규칙 | CONV-01, `03-db-schema.md` §3, `06-quality-gates.md` §3 |
| IC-06 | 에러 모델, 응답 필드 표기 | `04-interfaces-api.md` §1·§5(snake_case)·§6 |
| IC-07 | 트랜잭션 확정 위치, 세션 수명, 저장소 모델 경계 | `04-interfaces-api.md` §8, `03-db-schema.md` §5, GATE-08 |
| IC-08 | 스키마 반영 방식, 기존 DB 처리 | `03-db-schema.md` 머리말(create_all), STK-04, TKT-DB-M9-01 |
| IC-09 | 인증·권한 확인 위치·비밀값·비노출 필드 | ADR-002, ADR-003, `04-interfaces-api.md` §4.3·§6, CONV-07·09 |
| IC-10 | 화면 기술, 데이터 계약, 스타일 기준, 상태 변경 방식 | `04-interfaces-api.md` §7(PAGE), `05-structure-conventions.md` §6, CONV-09·12, D-019 |
| IC-11 | 실행·검증 명령, 테스트 DB | `06-quality-gates.md` §1·§2, STK-10~12 |
| IC-12 | 스택 주의 | `05-structure-conventions.md` §7 (STK-01~12) |
| IC-13 | 시드 계획 | `03-db-schema.md` §6 |
| IC-14 | 필수/도전 구분, 임시 코드 | 이 문서 머리말·§1(요청 시), TKT-BE-M3-04 → TKT-BE-M4-03 |
| IC-15 | 문서 티켓 목차 | 이 문서 §2 |

빈 칸 0.

## 5. 남은 리스크

| RISK | 남은 이유 | 대응 |
|---|---|---|
| RISK-03~05 | 필수 범위에는 동시 요청 보호가 없음(D-018). 도전 A 적용 후에도 잠금을 빠뜨린 구현이 생길 수 있음 | 시연은 순차 조작, 도전 A 요청 시 TKT-DB-M6-01·TKT-BE-M6-00·TKT-QA-M6-01, GATE-09 |
| RISK-10 | `localStorage` 토큰의 XSS 노출 | 헤더 전용(ADR-002·D-021), 템플릿 자동 이스케이프 유지(CONV-12) |
| RISK-11 | 폴링 해산 신호(410)를 화면이 잘못 처리 | AC-16-4 수동 점검 |
| REQ-039 | 돌아오지 않는 사용자가 자리·방장 역할을 계속 차지 | PM이 알려진 제약으로 수용(D-004) |
