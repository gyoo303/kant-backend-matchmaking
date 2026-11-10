# 실행 설정 — .env에서 값을 읽는다 (pydantic-settings)
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Settings
#   - database_url, jwt_secret_key
#   - access_token_expire_minutes, refresh_token_expire_days
#   - cors_origins, db_pool_size, db_max_overflow
#   - seed_user_password


# pydantic BaseModel -> 클래스 내부에 정의된 타입 표기를 읽어서 생성자 대신 만들어줌
# Settings() 호출 시 부모(BaseSettings) __init__이 실행된다
# self로 속성 정의하지 않아도, 객체 생성 시 s.database_url처럼 바로 접근 가능하다
# env 파일에 대응되는 변수에 값을 넣고, 나머지는 정의된 기본값 할당 (없으면 ValidationError)
class Settings(BaseSettings):
    # env_file은 실행 위치를 기준으로 경로를 탐색
    # extra_ignore -> 모르는 키값이 있어도 무시한다(임시/테스트 목적 키값).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    jwt_secret_key: str

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: list[str] = ["http://localhost:8000"]

    db_pool_size: int = 10
    db_max_overflow: int = 10

    # 수업 추가 내용: DB 커넥션 풀 관련 설정
    # 커넥션 풀에서 연결을 빌릴 때 최대 대기 시간(초)
    #   - 30초 -> 1초 (ADR-013 AD-03)
    #   풀이 고갈되면 -> 30초 동안 응답 X -> "화면 멈춤"
    #   - 1초 안에 연결을 못 빌리면 
    #       -> SQLAlchemy가 TimeoutError를 던지고, 전역 핸들러가 409로 바뀐다
    db_pool_timeout: float = 1.0
    db_pool_recycle: int = 1800
    db_pool_pre_ping: bool = True

    # db_pool_timeout = 1.0으로 발생하는 트레이드오프(단점)
    # db_pool_timeout은 앱 전체 적용
    # 과부하 상황에서 목록 조회도 1초 안에 연결을 못 받으면 -> 409
    # ADR-013 "감수할 점"으로 수용 (감수하는 리스크)


    # 방 행 잠금을 기다리는 최대 시간 (밀리초) - ADR-013, AD-02
    #   쓰기 트랜잭션 안에서 SET LOCAL lock_timeout으로 건다, 넘으면 409 (바빠서 거절)
    #   지연예산: 풀 대기 1초 + 잠금대기 2초 + 처리여유 1초 = 서버4초 < 클라이언트5초 (최대대기시간)
    db_lock_timeout_ms: int = 2000

    # 실행하는 SQL을 콘솔에 찍을지 (SQLAlchemy echo) - D-036
    #   켜면 요청마다 SQL 수십 줄을 출력해 CPU를 쓴다 → 처리 한계가 약 25% 낮아진다(7단계 측정)
    #   기본은 끔. SQL을 직접 봐야 할 때만 .env에 DB_ECHO=true
    db_echo: bool = False

    # 진입 단계 동시 처리 상한 - ADR-015
    #   /api 요청 중 "지금 처리 중인" 요청 수가 이 값에 닿으면
    #   새 요청은 일을 시작하지 않고 즉시 409
    #   처리 한계를 넘는 부하에서 요청이 서버 안에 끝없이 쌓여 5초를 넘기는 것을 막는다
    max_inflight_requests: int = 150

    # 수업 추가 내용: DB 세션 관련 설정
    db_session_autoflush: bool = False
    db_session_expire_on_commit: bool = False

    seed_user_password: str


@lru_cache  # .env 파일에 딱 한번만 접근하고 이후 캐시로 불러들인다.
def get_settings() -> Settings:
    return Settings()


# get_settings()
