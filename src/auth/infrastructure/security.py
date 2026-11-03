from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from config import get_settings

# JWT 서명 알고리즘을 고정
ALGORITHM = "HS256"

# 비밀번호 해시에 bcrypt를 사용
pwd_context = CryptContext(schemes=['bcrypt'])

class PasswordHasher:
    # 비밀번호 원문을 저장용 해시로 변환
    @staticmethod
    def hash(raw:str) -> str:
        return pwd_context.hash(raw)

    # 입력한 비밀번호가 저장된 해시와 일치하는지 검사
    @staticmethod
    def verify(raw: str, hashed: str) -> bool:
        return pwd_context.verify(raw, hashed)

# API 인증에 사용할 access 토큰을 발급
def create_access_token(data: dict) -> str:
    # 토큰 발급 설정을 읽는다
    settings = get_settings()

    # 호출자가 전달한 원본 데이터를 보존
    payload = data.copy()

    # access 토큰의 만료 시각을 정함
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    # 토큰에 만료 시각과 종류를 기록
    payload.update({
        'exp': expires_at,
        'token_type': 'access',
    })

    # 비밀 키로 서명한 JWT 문자열을 반환함
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

# access 토큰 재발급에 사용할 refresh 토큰을 발급
def create_refresh_token(data: dict) -> str:
    # 토큰 발급 설정을 읽음
    settings = get_settings()

    # 호출자가 전달한 원본 데이터를 보존
    payload = data.copy()

    # refresh 토큰의 만료 시각을 정함
    expires_at = datetime.now(UTC) + timedelta(
        days=settings.refresh_token_expire_days
    )

    # 토큰에 만료 시각과 종류를 기록
    payload.update({
        'exp': expires_at,
        'token_type': 'refresh',
    })

    # 비밀 키로 서명한 JWT 문자열을 반환
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

# JWT를 검증하고 토큰에 담긴 데이터를 반환
def decode_token(token: str) -> dict:
    # 토큰 검증 설정을 읽음
    settings = get_settings()

    # 허용한 알고리즘으로 서명과 만료 시각을 검증
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[ALGORITHM],
    )