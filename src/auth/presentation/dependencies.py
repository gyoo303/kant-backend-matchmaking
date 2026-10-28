from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from database import get_db
from exceptions import AuthenticationError

# OAuth2 토큰 수거기: Authorization: Bearer 헤더에서 토큰을 꺼낸다 (교안 6장 1강, SEQ-03)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    return await AuthApplicationService(db).authenticate(token)


# TODO(TKT-BE-M4-03): 임시 인증. M3에서는 시드 회원 ID를 요청 헤더로 받는다(D-001).
# M4-03에서 get_current_user를 쓰도록 바꾸고 이 헤더 코드는 지운다.
_DEBUG_USER_HEADER = "X-Debug-User-Id"


async def get_current_user_id(request: Request) -> int:
    raw = request.headers.get(_DEBUG_USER_HEADER)
    if raw is None or not raw.isdigit():
        raise AuthenticationError()
    return int(raw)
