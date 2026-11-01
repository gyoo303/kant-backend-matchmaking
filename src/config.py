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
    seed_user_password: str


@lru_cache  # .env 파일에 딱 한번만 접근하고 이후 캐시로 불러들인다.
def get_settings() -> Settings:
    return Settings()


# get_settings()
