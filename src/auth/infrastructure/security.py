from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from config import get_settings

ALGORITHM = "HS256"


class PasswordHasher:
    """bcrypt 비밀번호 해시 (ADR-002, STK-07: bcrypt 4.0.1 고정)."""

    def __init__(self) -> None:
        self._context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash(self, raw: str) -> str:
        return self._context.hash(raw)

    def verify(self, raw: str, hashed: str) -> bool:
        return self._context.verify(raw, hashed)


def create_access_token(data: dict) -> str:
    """단기 access 토큰을 발행한다 (교안 6장 1강 3.3)."""
    to_encode = data.copy()
    expire_time = datetime.now(UTC) + timedelta(minutes=get_settings().access_token_expire_minutes)
    to_encode.update({"exp": expire_time, "token_type": "access"})
    return jwt.encode(to_encode, get_settings().jwt_secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """장기 refresh 토큰을 발행한다 (교안 6장 1강 3.3)."""
    to_encode = data.copy()
    expire_time = datetime.now(UTC) + timedelta(days=get_settings().refresh_token_expire_days)
    to_encode.update({"exp": expire_time, "token_type": "refresh"})
    return jwt.encode(to_encode, get_settings().jwt_secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """서명·만료를 검사하고 페이로드를 돌려준다.

    실패하면 pyjwt의 ExpiredSignatureError·InvalidTokenError가 그대로 올라간다.
    """
    return jwt.decode(token, get_settings().jwt_secret_key, algorithms=[ALGORITHM])
