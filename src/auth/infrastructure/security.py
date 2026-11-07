
# auth 외부 도구 구현(어댑터) — passlib(bcrypt), PyJWT
#
# [핵심 개념] 어댑터 = 포트(application/ports.py)를 상속해 실제 라이브러리로 구현한 클래스
#   application/ports.py   PasswordHasher, TokenProvider (계약)
#   infrastructure/security.py  BcryptPasswordHasher, JwtTokenProvider (구현)
#   - 라이브러리 import(jwt, passlib)는 이 파일에만

# [동작 방식] 예외 번역
#   jwt.decode 실패 -> jwt.InvalidTokenError(만료 ExpiredSignatureError 포함)
#       여기서 TokenVerificationError로 바꿔 던진다
#       서비스는 TokenVerificationError만 알면 된다 (jwt를 import할 필요가 없어짐)

# [고려할 사항]
#   - 설정값(비밀 키, 만료 시간)을 생성자로 받는다: 함수 안에서 get_settings()를 부르면
#     테스트에서 다른 키, 짧은 만료를 넣기 어렵다. ((4단계 container가 설정을 넣어 준다))
#   - clock(현재 시각 함수)도 생성자로 받는다: 테스트에서 "이미 만료된 토큰"을
#     sleep 없이 만들 수 있다
#   - 토큰 안의 키 이름('sub', 'token_type')은 기존과 같게 유지한다
#     --> 리팩토링 전에 발급된 토큰도 그대로 검증된다


from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from auth.application.ports import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    PasswordHasher,
    TokenClaims,
    TokenProvider,
    TokenVerificationError,
)

from config import Settings, get_settings

# JWT 서명 알고리즘을 고정
ALGORITHM = "HS256"

# _ -> 클래스 안에서만 쓰는 함수명 관례
def _utc_now() -> datetime:
    return datetime.now(UTC)

class BcryptPasswordHasher(PasswordHasher):
    """bcrypt 해시 구현"""
    
    def __init__(self) -> None:
        # CryptContext - 만들 때 비용이 크므로 객체 하나에 한 번만 생성
        # 이 클래스는 Singleton으로 등록(추후)
        self._context = CryptContext(schemes=["bcrypt"])

    def hash(self, raw: str) -> str:
        # bcrypt - 실행할 때마다 다른 salt를 붙인다, 같은 raw string도 해시값이 매번 달라진다
        return self._context.hash(raw)
    
    def verify(self, raw: str, hashed: str) -> bool:
        # 해시에서 salt를 꺼낸다, 원문을 다시 해시하고 비교한다.
        return self._context.verify(raw, hashed)

class JwtTokenProvider(TokenProvider):
    """PyJWT로 access/refresh 토큰을 발급하고 검증하는 구현"""
    
    def __init__(
        self,
        secret_key: str,
        access_expire_minutes: int,
        refresh_expire_days: int,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._secret_key = secret_key
        self._access_ttl = timedelta(minutes = access_expire_minutes)
        self._refresh_ttl = timedelta(days=refresh_expire_days)
        self._clock = clock
        
    
    # [임시 — 2단계] 서비스가 직접 만들 때 쓰는 생성 도우미. 4단계 container가 대신하면 지운다
    @classmethod
    def from_settings(cls, settings: Settings | None = None) -> "JwtTokenProvider":
        settings = settings or get_settings()
        return cls(
            secret_key=settings.jwt_secret_key,
            access_expire_minutes=settings.access_token_expire_minutes,
            refresh_expire_days=settings.refresh_token_expire_days,
        )

    def create_access_token(self, subject: str) -> str:
        return self._encode(subject, ACCESS_TOKEN_TYPE, self._access_ttl)

    def create_refresh_token(self, subject: str) -> str:
        return self._encode(subject, REFRESH_TOKEN_TYPE, self._refresh_ttl)

    def decode(self, token: str) -> TokenClaims:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[ALGORITHM])
        except jwt.InvalidTokenError as error:
            # 라이브러리 예외 → application 예외로 번역 (from error: 원인 예외를 기록에 남김)
            raise TokenVerificationError(str(error)) from error

        # dict 그대로 넘기지 않고 필요한 값만 이름 있는 필드로 담는다
        return TokenClaims(
            subject=payload.get("sub"),
            token_type=payload.get("token_type"),
        )

    # access/refresh 발급의 공통 부분 — 두 메서드의 중복 코드를 한곳으로 (DRY)
    def _encode(self, subject: str, token_type: str, ttl: timedelta) -> str:
        payload = {
            "sub": subject,
            "token_type": token_type,
            "exp": self._clock() + ttl,  # PyJWT가 datetime을 숫자(epoch)로 바꿔 넣는다
        }
        return jwt.encode(payload, self._secret_key, algorithm=ALGORITHM)



# # 비밀번호 해시에 bcrypt를 사용
# pwd_context = CryptContext(schemes=['bcrypt'])

# class PasswordHasher:
#     # 비밀번호 원문을 저장용 해시로 변환
#     @staticmethod
#     def hash(raw:str) -> str:
#         return pwd_context.hash(raw)

#     # 입력한 비밀번호가 저장된 해시와 일치하는지 검사
#     @staticmethod
#     def verify(raw: str, hashed: str) -> bool:
#         return pwd_context.verify(raw, hashed)

# # API 인증에 사용할 access 토큰을 발급
# def create_access_token(data: dict) -> str:
#     # 토큰 발급 설정을 읽는다
#     settings = get_settings()

#     # 호출자가 전달한 원본 데이터를 보존
#     payload = data.copy()

#     # access 토큰의 만료 시각을 정함
#     expires_at = datetime.now(UTC) + timedelta(
#         minutes=settings.access_token_expire_minutes
#     )

#     # 토큰에 만료 시각과 종류를 기록
#     payload.update({
#         'exp': expires_at,
#         'token_type': 'access',
#     })

#     # 비밀 키로 서명한 JWT 문자열을 반환함
#     return jwt.encode(
#         payload,
#         settings.jwt_secret_key,
#         algorithm=ALGORITHM,
#     )

# # access 토큰 재발급에 사용할 refresh 토큰을 발급
# def create_refresh_token(data: dict) -> str:
#     # 토큰 발급 설정을 읽음
#     settings = get_settings()

#     # 호출자가 전달한 원본 데이터를 보존
#     payload = data.copy()

#     # refresh 토큰의 만료 시각을 정함
#     expires_at = datetime.now(UTC) + timedelta(
#         days=settings.refresh_token_expire_days
#     )

#     # 토큰에 만료 시각과 종류를 기록
#     payload.update({
#         'exp': expires_at,
#         'token_type': 'refresh',
#     })

#     # 비밀 키로 서명한 JWT 문자열을 반환
#     return jwt.encode(
#         payload,
#         settings.jwt_secret_key,
#         algorithm=ALGORITHM,
#     )

# # JWT를 검증하고 토큰에 담긴 데이터를 반환
# def decode_token(token: str) -> dict:
#     # 토큰 검증 설정을 읽음
#     settings = get_settings()

#     # 허용한 알고리즘으로 서명과 만료 시각을 검증
#     return jwt.decode(
#         token,
#         settings.jwt_secret_key,
#         algorithms=[ALGORITHM],
#     )