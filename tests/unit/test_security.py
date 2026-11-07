# 2단계 어댑터 단위 테스트 — DB 없이 실행된다
#
# [핵심 개념] 생성자로 설정·시계를 받는 구조의 장점
#   - 비밀 키를 테스트용 문자열로, 현재 시각을 "1시간 전"으로 바꿔 넣을 수 있다
#   - .env나 sleep 없이 "만료된 토큰" 상황을 바로 만든다

from datetime import UTC, datetime, timedelta

import pytest

from auth.application.ports import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    TokenVerificationError,
)
from auth.infrastructure.security import BcryptPasswordHasher, JwtTokenProvider

SECRET = "test-secret-key-at-least-32-bytes!!"


def make_provider(clock=lambda: datetime.now(UTC)) -> JwtTokenProvider:
    return JwtTokenProvider(SECRET, access_expire_minutes=30, refresh_expire_days=7, clock=clock)


def test_hash_and_verify():
    hasher = BcryptPasswordHasher()
    hashed = hasher.hash("password123")

    assert hashed != "password123"  # 원문을 그대로 저장하지 않는다
    assert hasher.verify("password123", hashed)
    assert not hasher.verify("wrong-password", hashed)


def test_access_and_refresh_claims():
    provider = make_provider()

    access = provider.decode(provider.create_access_token("tester01"))
    refresh = provider.decode(provider.create_refresh_token("tester01"))

    assert (access.subject, access.token_type) == ("tester01", ACCESS_TOKEN_TYPE)
    assert (refresh.subject, refresh.token_type) == ("tester01", REFRESH_TOKEN_TYPE)


def test_expired_token_raises_verification_error():
    # 1시간 전 시계로 30분짜리 토큰 발급 → 이미 만료
    past = make_provider(clock=lambda: datetime.now(UTC) - timedelta(hours=1))
    token = past.create_access_token("tester01")

    with pytest.raises(TokenVerificationError):
        make_provider().decode(token)


def test_wrong_secret_raises_verification_error():
    token = make_provider().create_access_token("tester01")
    other = JwtTokenProvider("another-secret-key-at-least-32-bytes", 30, 7)

    with pytest.raises(TokenVerificationError):
        other.decode(token)
