# auth 외부기능 계약 (추상클래스) - 비밀번호 해시, 토큰발급 및 검증
# 서비스가 jwt, passlib 라이브러리를 직접 import 
# -> 라이브러리 변경 시 업무 흐름 코드까지 고쳐야 한다

# -> 서비스는 "무엇이 필요한가"만 알고,
# "어떻게"는 infrastructure/security.py가 구현한다

from abc import ABC, abstractmethod
from dataclasses import dataclass

# 토큰 종류 ㅡ 발급(security.py) / 검사(service.py) 같은 값 쓰도록 한곳에

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

class TokenVerificationError(Exception):
    """
    서명 불일치, 만료, 형식 오류
    jwt 라이브러리 예외(ExpiredSignatureError 등)를 application의 언어로 바꾼것
    서비스가 잡아서 AuthenticationError(401) 등으로 바꾼다
    -> 서비스 바깥으로 나가면 안 된다.
    """


@dataclass(frozen = True)
class TokenClaims:
    """
    검증된 토큰에서 서비스가 필요한 값만 꺼낸다
    (dict 대신 이름 있는 필드)
    값을 변경할 수 없다, 변경이 필요하면 replace로 재생성한다
    """

    subject: str | None # 로그인 아이디 (JWT의 "sub")
    token_type: str | None # ACCESS_TOKEN_TYPE 또는 REFERESH_TOKEN_TYPE

class PasswordHasher(ABC):
    @abstractmethod
    def hash(self, raw: str) -> str:
        """비밀번호 원문을 해시값으로"""

    @abstractmethod
    def verfiy(self, raw: str, hashed: str) -> bool:
        """원문과 해시가 일치하는가?"""


class TokenProvider(ABC):
    @abstractmethod
    def created_access_token(self, subject: str) -> str:
        """API 인증용 access 토큰 발급"""

    @abstractmethod
    def create_refresh_token(self, subject: str) -> str:
        """access 재발급용, refresh 토큰 발급"""

    @abstractmethod
    def decode(self, token: str) -> TokenClaims:
        """
        서명 만료를 검증하고 값을 꺼낸다
        실패 -> TokenVerificationError
        """

