from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경변수·.env에서 읽는 실행 설정 (ADR-003)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: list[str] = ["http://localhost:8000"]
    db_pool_size: int = 10
    db_max_overflow: int = 10
    seed_user_password: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
