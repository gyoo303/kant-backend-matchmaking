import re
from dataclasses import dataclass
from datetime import datetime

from auth.domain.exceptions import InvalidLoginIdError, InvalidNicknameError, InvalidPasswordError

LOGIN_ID_PATTERN = re.compile(r"[a-z0-9]{4,20}")
NICKNAME_PATTERN = re.compile(r"[가-힣A-Za-z0-9]{2,12}")
MIN_PASSWORD_LENGTH = 8


@dataclass
class User:
    """회원. 비밀번호는 해시만 보관한다 (INV-13)."""

    id: int | None
    login_id: str
    nickname: str
    hashed_password: str
    created_at: datetime | None = None

    @classmethod
    def register(cls, login_id: str, nickname: str, hashed_password: str) -> "User":
        if not LOGIN_ID_PATTERN.fullmatch(login_id):
            raise InvalidLoginIdError()
        trimmed_nickname = nickname.strip()
        if not NICKNAME_PATTERN.fullmatch(trimmed_nickname):
            raise InvalidNicknameError()
        return cls(
            id=None,
            login_id=login_id,
            nickname=trimmed_nickname,
            hashed_password=hashed_password,
        )

    @staticmethod
    def validate_raw_password(raw: str) -> None:
        if len(raw) < MIN_PASSWORD_LENGTH:
            raise InvalidPasswordError()
