# auth 웹 의존성 — 토큰 추출, 현재 회원 인증, 인증 서비스 조립
#
# [임시 조립 — 3단계] 서비스가 부품을 생성자로 받게 되었으므로 "누군가는" 부품을 만들어
#   넣어 줘야 한다. 4단계 container.py가 생기기 전까지 이 파일이 그 역할을 맡는다
#   그래서 지금은 presentation -> infrastructure import가 남아 있다 (4단계에서 제거)

# [동작 방식] FastAPI 의존성 캐시
#   - 한 요청 안에서 같은 의존성 함수(get_db, get_auth_service)는 한 번만 실행된다
#   - get_current_user와 라우터가 모두 get_auth_service를 써도
#     같은 세션 · 같은 서비스 객체를 공유한다 (세션 2개 = 트랜잭션 2개 문제 방지)

# [고려할 사항] 수명(scope)
#   - 저장소: 세션에 묶여 있으므로 요청마다 새로 만든다
#   - 해시 도구·토큰 도구: 상태가 없고 만들기 비싸므로 서버 전체에서 하나만 쓴다
#     (4단계 container에서는 각각 Factory / Singleton으로 표현된다)

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
# from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from auth.infrastructure.repositories import (
    SqlAlchemyTokenBlacklistRepository,
    SqlAlchemyUserRepository,
)
from auth.infrastructure.security import BcryptPasswordHasher, JwtTokenProvider
# from database import get_db
from database import DbSession

# 요청 헤더에서 Bearer 토큰을 꺼낼 도구를 준비
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/token')

# 서버 전체에서 하나만 쓰는 도구 (모듈은 처음 import될 때 한 번만 실행된다)
_password_hasher = BcryptPasswordHasher()
_token_provider = JwtTokenProvider.from_settings()


# 요청의 DB 세션으로 인증 서비스를 조립한다
# (router.py에 있던 함수를 여기로 옮겼다: get_current_user도 같은 조립을 써야 하므로)
def get_auth_service(db: DbSession) -> AuthApplicationService:
    return AuthApplicationService(
        users=SqlAlchemyUserRepository(db),
        blacklist=SqlAlchemyTokenBlacklistRepository(db),
        hasher=_password_hasher,
        tokens=_token_provider,
    )

# 요청의 토큰으로 현재 회원을 인증
# 서비스도 의존성으로 받는다 → 라우터의 get_auth_service와 같은 객체(캐시)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    service: AuthApplicationService = Depends(get_auth_service),
) -> User:
    return await service.authenticate(token)


# 인증된 회원의 식별자를 반환
async def get_current_user_id(
    user: User = Depends(get_current_user),
) -> int:
    return user.id