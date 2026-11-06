from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
# from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
# from database import get_db
from database import DbSession

# 요청 헤더에서 Bearer 토큰을 꺼낼 도구를 준비
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/token')

# 요청의 토큰과 DB 세션으로 현재 회원을 인증
# db를 첫 번째 매개변수로:
#   파이썬은 "기본값 있는 매개변수(token=Depends(...))" 뒤에 기본값 없는 매개변수를 허용X
#   DbSession -> Annotated이므로 기본값 없음
# 같은 요청에서 라우터의 서비스 팩토리도 DbSession을 사용 -> 캐시되어 같은 세션을 함께 씀
async def get_current_user(
    db: DbSession,
    token: str = Depends(oauth2_scheme),
) -> User:
    return await AuthApplicationService(db).authenticate(token)

# 인증된 회원의 식별자를 반환
async def get_current_user_id(
    user: User = Depends(get_current_user),
) -> int:
    return user.id