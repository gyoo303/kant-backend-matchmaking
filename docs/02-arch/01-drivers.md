# 01. 아키텍처 드라이버 (A1)

- 입력: `docs/01-pm/04-scope.md` Architect 요약 블록, `03-domain.md` §6, `06-acceptance-criteria.md` §2, 발제 `kant-rubric.md`
- A0 입력 검증: 미해결 Q 0, `[PENDING]` 결정 0, Must US 전부 AC 보유, 평가표 매트릭스 빈 행 0, 저장소에 `src/` 없음(발제 구조와 충돌하는 파일 없음). 결손 없음.

## 1. →ARCH 질문 배정

| 질문 | 답하는 곳 |
|---|---|
| ARCH-Q-01 권한·규칙 위반 코드 | A4 `04-interfaces-api.md` §에러 모델 |
| ARCH-Q-02 동시성 제약·잠금·트랜잭션 | ADR-009(도전 A), A3 제약, A5 SEQ |
| ARCH-Q-03 참가/이력 테이블·소프트 삭제 필드 | A3 `03-db-schema.md` |
| ARCH-Q-04 해산 vs 접근 불가 응답 계약 | A4 API-ROOM 상세 |
| ARCH-Q-05 JWT 보관·CSRF | ADR-002 |
| ARCH-Q-06 응답 유실 재조회 | A5 §중복 요청 |
| ARCH-Q-07 `%`·`_` 검색 | A4 목록 API |

## 2. 제약 (DRV-C)

| ID | 제약 | 근거 |
|---|---|---|
| DRV-C-01 | 스택: Python 3.13+, uv, FastAPI, uvicorn, SQLAlchemy 비동기 + asyncpg, Pydantic, Jinja2, pyjwt, passlib[bcrypt], PostgreSQL | REQ-T01 |
| DRV-C-02 | 실행 명령 `uv run uvicorn main:app --app-dir src --reload` | REQ-T02 |
| DRV-C-03 | 발제 §4.2 디렉토리·4계층·단방향 의존, 도메인 외부 import 금지 | REQ-T03~T05 |
| DRV-C-04 | 마이그레이션 도구 없이 lifespan에서 테이블 생성·시드 20건 이상 | REQ-T08, NFR-06 |
| DRV-C-05 | 외부 프론트엔드·WebSocket·SSE 금지, 화면 갱신은 1초 폴링 | REQ-088, REQ-128, REQ-129 |
| DRV-C-06 | 일정: M3 4~7일차, M4 8일차, M5 9~10일차(필수 100%), M6 11일차 도전 | D-001 |
| DRV-C-07 | 필수 범위는 순차 요청 기준 무결성만 지킨다. 동시 요청 무결성(잠금·부분 유니크 인덱스)은 도전 A이며, 도전 티켓은 사용자 요청 시에만 착수 | D-018 |
| DRV-C-08 | 게임 결과·승패 데이터 없음 | REQ-001, INV-09 |

## 3. 품질 속성 (DRV-Q) — 우선순위 순

| 순위 | ID | 품질 속성 | PM 기준 | 근거 |
|---|---|---|---|---|
| 1 | DRV-Q-01 | 계층 격리 | NFR-01, EV-01·02 | 발제 평가의 중심(RC-03·09). 깨지면 다른 품질도 증빙 불가 |
| 2 | DRV-Q-02 | 데이터 정합성(정원·한 방·팀 정원·해산 1회·원자성) | NFR-04, NFR-05 | 매치메이킹 규칙 자체가 Use Case. 필수는 순차 요청 기준, 동시 요청은 도전 A(D-018) |
| 3 | DRV-Q-03 | 보안(블랙리스트 401, 해시 비노출, 본인 기록만) | NFR-03 | 발제 시연 항목(EV-06) |
| 4 | DRV-Q-04 | 시연 안정성(일관된 오류 형식, 시드, 폴링 복귀) | NFR-02, NFR-06, NFR-08 | 5분 라이브 시연(EV-10) |
| 5 | DRV-Q-05 | 성능 | NFR-08(1초 폴링) | 시연 규모(최대 수십 명)에서는 정합성보다 후순위 |

## 4. 핵심 리스크 (RISK)

| ID | 리스크 | 가능성 | 영향 | 설계 대응 |
|---|---|---|---|---|
| RISK-01 | 도메인 계층의 외부 import, 계층 역참조·기능 간 순환 참조 | 중 | 높음 | ADR-001, CONV, GATE-02 |
| RISK-02 | SQLAlchemy 모델이 서비스·라우터로 누출 | 중 | 중 | `03-db-schema.md` 매핑 표, GATE-08 |
| RISK-03 | 마지막 자리·같은 팀 동시 요청으로 정원 초과 | 높음 | 높음 | 필수: 도메인 검사(순차 기준). 도전 A: ADR-009 방 행 잠금, SEQ-06~09 |
| RISK-04 | 같은 회원이 서로 다른 방에 동시 참가·생성 → 현재 참가 2건 | 중 | 높음 | 필수: 도메인 검사. 도전 A: ADR-009 부분 유니크 인덱스(`participations.user_id WHERE left_at IS NULL`) |
| RISK-05 | 게임 시작 반복·시작과 퇴장 경합 → 해산 2회, 해산된 방에 참가자 잔존 | 중 | 높음 | 필수: 삭제 상태 검사. 도전 A: ADR-009 방 행 잠금 |
| RISK-06 | 로그아웃 토큰 재사용, 블랙리스트 무한 증가 | 중 | 중 | ADR-002(`jti`, 만료 행 정리), SEQ-03 |
| RISK-07 | 응답에 비밀번호 해시 노출, 다른 회원 이용 기록 노출 | 낮음 | 높음 | 응답 스키마에 해시 필드 없음, 이력 조회는 `user_id`로만 |
| RISK-08 | 예외 시 rollback 누락으로 업무 단위 일부만 저장 | 중 | 높음 | A5 트랜잭션 경계(`get_db`에서 rollback), NFR-05 |
| RISK-09 | JWT 비밀키·DB 비밀번호가 코드·저장소에 들어감 | 중 | 높음 | ADR-003, `.gitignore`, GATE-06 |
| RISK-10 | 쿠키 인증 화면에서 CSRF | 낮음 | 중 | ADR-002(HttpOnly + SameSite=Lax, 변경은 JSON fetch만) |
| RISK-11 | 폴링에서 해산과 접근 불가를 구분 못 해 잘못 안내 | 중 | 중 | API-ROOM-03 응답 계약(410 Gone) |
| RISK-12 | 시드가 재시작마다 중복 주입 | 중 | 낮음 | `03-db-schema.md` §시드 중복 방지 조건 |
