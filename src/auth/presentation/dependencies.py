from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from database import get_db

# OAuth2 토큰 수거기: Authorization: Bearer 헤더에서 토큰을 꺼낸다 (교안 6장 1강, SEQ-03)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    return await AuthApplicationService(db).authenticate(token)


async def get_current_user_id(user: User = Depends(get_current_user)) -> int:
    """rooms 라우터가 쓰는 현재 회원 ID (SEQ-03 3단계)."""
    return user.id
