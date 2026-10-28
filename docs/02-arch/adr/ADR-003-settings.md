# ADR-003: 설정·환경변수 관리
- 상태: Accepted (user, 2026-10-28)
- 관련 계층: [인프라]
- 근거: RISK-09, NFR-09, REQ-111, CH-C

## 맥락
DB URL·JWT 비밀키를 코드에 두지 않아야 한다. 실행 명령이 `uv run uvicorn main:app --app-dir src --reload`로 고정이라 `--env-file` 같은 플래그를 붙일 수 없다. `.env`를 읽는 방법이 필요하다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. `os.environ`만 사용(`src/config.py`의 dataclass) | 의존성 0 | `.env`를 자동으로 읽지 못해 실행 전 셸에 export 필요, 고정 실행 명령과 어긋남 | 중 — 실행 안내가 OS마다 달라짐 | 위험(NFR-01 재현성) | 낮음 |
| B. `pydantic-settings`(`src/config.py`의 `Settings(BaseSettings)`, `.env` 자동 로드, 필수값 누락 시 기동 실패) | 고정 실행 명령 그대로 `.env` 사용, 타입 검증 | 의존성 1개 추가 | 낮음 | 충족 | 낮음 |

## 계층 관점 설명
[인프라] `src/config.py`에 `get_settings()`(캐시) 하나만 두고 `database.py`·`auth` 인프라·`main.py`만 읽는다. 도메인은 설정을 모른다. `.env.example` 항목: `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_EXPIRE_MINUTES`(기본 60), `CORS_ORIGINS`(기본 `http://localhost:8000`), `COOKIE_SECURE`(기본 false), `DB_POOL_SIZE`(기본 10), `DB_MAX_OVERFLOW`(기본 10), `SEED_USER_PASSWORD`(시드 회원 비밀번호, 필수). 테스트 전용 `TEST_DATABASE_URL`은 `.env.example`에 주석으로 이름만 적고, `Settings`는 읽지 않는다(`extra="ignore"`, STK-10).

## 결정 / 추천
결정: B — 고정 실행 명령 그대로 `.env`를 읽고, 비밀키 누락을 기동 시점에 잡는다.

## 결과
- 좋아지는 점: 비밀값이 코드에 없음, CH-C 환경변수 분리를 그대로 충족
- 감수할 점: 의존성 1개
- 후속 작업: TKT-BE-M2-01
