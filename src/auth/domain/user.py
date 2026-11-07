import re
from dataclasses import dataclass
from datetime import datetime

from auth.domain.exceptions import InvalidLoginIdError, InvalidNicknameError, InvalidPasswordError

# 회원 생성에 사용할 문자열 규칙을 준비
LOGIN_ID_PATTERN = re.compile(r"^[a-z0-9]{4,20}$")
NICKNAME_PATTERN = re.compile(r"^[가-힣A-Za-z0-9]{2,12}$")

@dataclass
class User:
    id: int | None
    login_id: str
    nickname: str
    hashed_password: str
    created_at: datetime | None = None

    # 아이디와 닉네임을 검사해 새 회원을 만듦
    @classmethod
    def register(
        cls,
        login_id: str,
        nickname: str,
        hashed_password: str,
    ) -> "User":
    # 아이디 형식을 검사
        if not LOGIN_ID_PATTERN.fullmatch(login_id):
            raise InvalidLoginIdError()

        # 닉네임의 앞뒤 공백을 제거
        nickname = nickname.strip()

        # 다듬은 닉네임의 형식을 검사
        if not NICKNAME_PATTERN.fullmatch(nickname):
            raise InvalidNicknameError()

        # DB 저장 전의 회원 객체를 반환
        return cls(
            id=None,
            login_id=login_id,
            nickname=nickname,
            hashed_password=hashed_password,
        )

    # 원문 비밀번호의 최소 길이를 검사
    @staticmethod
    def validate_raw_password(raw:str) -> None:
        if len(raw) < 8:
            raise InvalidPasswordError()