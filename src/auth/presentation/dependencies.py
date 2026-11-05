from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from database import get_db

# 요청 헤더에서 Bearer 토큰을 꺼낼 도구를 준비
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/token')

# 요청의 토큰과 DB 세션으로 현재 회원을 인증
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await AuthApplicationService(db).authenticate(token)

# 인증된 회원의 식별자를 반환
async def get_current_user_id(
    user: User = Depends(get_current_user),
) -> int:
    return user.id