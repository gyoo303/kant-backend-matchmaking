from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TokenBlacklist:
    """로그아웃한 토큰의 차단 기록 (INV-14)."""

    jti: str
    expires_at: datetime

    def __post_init__(self) -> None:
        if not self.jti:
            raise ValueError("토큰 식별자(jti)가 비어 있습니다")

    def is_expired(self, now: datetime) -> bool:
        return self.expires_at <= now
