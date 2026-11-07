# auth 외부기능 계약 (포트) - 비밀번호 해시, 토큰 발급 및 검증

# [핵심 개념] 포트와 어댑터
#   - 포트 = application이 "이런 기능 필요해"라고 적어둔 콘센트 (추상클래스)
#   - 어댑터 = 콘센트에 맞춰 끼우는 실제 부품 (infrastructure/security.py의 구현 클래스)

#   - 서비스는 포트만 안다 -> passlib, PyJWT를 다른 라이브러리로 바꿔도 서비스 코드는 변경X

# [왜 repository 계약과 달리 application 게층에 있을까?]
#   - 비밀번호 해시, JWT는 "회원" 도메인 규칙이 아니라 인증흐름(유스케이스)이 쓰는 도구
#   - 이 계약을 쓰는 곳도 AuthApplicationService뿐 -> 쓰는 계층에 둔다

# [고려사항]
#   - 이 파일은 jwt, passlib import하지 않는다.
#   - 예외(ExpiredSignatureError)도 여기서 정의한 TokenVerificationError를 "번역"해서 서비스에 전달


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


@dataclass(frozen=True)
class TokenClaims:
    """
    검증된 토큰에서 서비스가 필요한 값만 꺼낸다
    (dict 대신 이름 있는 필드)
    값을 변경할 수 없다, 변경이 필요하면 replace로 재생성한다
    ** 왜 딕셔너리가 아니라 데이터클래스를 쓸까?
       .get('sbu') -> 키 입력 잘못돼면 조용히 None 반환 (에러없음)
       claims.sbu -> 바로 AttributeError 발생시킨다
    """

    subject: str | None  # 로그인 아이디 (JWT의 "sub")
    token_type: str | None  # ACCESS_TOKEN_TYPE 또는 REFRESH_TOKEN_TYPE


class PasswordHasher(ABC):
    @abstractmethod
    def hash(self, raw: str) -> str:
        """비밀번호 원문을 해시값으로"""

    @abstractmethod
    def verify(self, raw: str, hashed: str) -> bool:
        """원문과 해시가 일치하는가?"""


class TokenProvider(ABC):
    @abstractmethod
    def create_access_token(self, subject: str) -> str:
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
