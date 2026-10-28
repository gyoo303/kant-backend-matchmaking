from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.exceptions import (
    AlreadyLoggedOutError,
    DuplicateLoginIdError,
    DuplicateNicknameError,
    InvalidRefreshTokenError,
)
from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User
from auth.infrastructure.repositories import TokenBlacklistRepository, UserRepository
from auth.infrastructure.security import (
    PasswordHasher,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from exceptions import AuthenticationError

LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다"
INVALID_TOKEN_MESSAGE = "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"
BLACKLISTED_REFRESH_MESSAGE = "로그아웃 처리되어 사용할 수 없는 토큰입니다"
EXPIRED_REFRESH_MESSAGE = "리프레시 토큰이 만료되었습니다. 다시 로그인하세요"


class AuthApplicationService:
    """회원가입·로그인·재발급·로그아웃·토큰 인증 흐름 (교안 6장 1강, ADR-002, SEQ-01~04b)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.blacklist = TokenBlacklistRepository(db)
        self.hasher = PasswordHasher()

    async def signup(self, login_id: str, nickname: str, password: str) -> User:
        User.validate_raw_password(password)
        if await self.users.exists_login_id(login_id):
            raise DuplicateLoginIdError()
        if await self.users.exists_nickname(nickname.strip()):
            raise DuplicateNicknameError()
        user = User.register(login_id, nickname, self.hasher.hash(password))
        saved = await self.users.save(user)
        await self.db.commit()
        return saved

    async def login(self, login_id: str, password: str) -> dict:
        user = await self.users.find_by_login_id(login_id)
        if user is None or not self.hasher.verify(password, user.hashed_password):
            raise AuthenticationError(LOGIN_FAILED_MESSAGE)
        return {
            "access_token": create_access_token({"sub": user.login_id}),
            "refresh_token": create_refresh_token({"sub": user.login_id}),
            "token_type": "bearer",
        }

    async def refresh(self, refresh_token: str) -> dict:
        if await self.blacklist.exists(refresh_token):
            raise AuthenticationError(BLACKLISTED_REFRESH_MESSAGE)
        try:
            payload = decode_token(refresh_token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise AuthenticationError(EXPIRED_REFRESH_MESSAGE) from error
        login_id = payload.get("sub")
        if payload.get("token_type") != "refresh" or login_id is None:
            raise AuthenticationError(EXPIRED_REFRESH_MESSAGE)
        return {"access_token": create_access_token({"sub": login_id}), "token_type": "bearer"}

    async def logout(self, access_token: str, refresh_token: str) -> None:
        """access·refresh 두 토큰을 모두 블랙리스트에 넣는다(D-021). 참가 상태는 건드리지 않는다."""
        try:
            decode_token(refresh_token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise InvalidRefreshTokenError() from error
        if await self.blacklist.exists(refresh_token):
            raise AlreadyLoggedOutError()
        await self.blacklist.save(TokenBlacklist(access_token))
        await self.blacklist.save(TokenBlacklist(refresh_token))
        await self.db.commit()

    async def authenticate(self, token: str) -> User:
        """Authorization 헤더의 access 토큰으로 현재 회원을 찾는다(교안 get_current_user)."""
        try:
            payload = decode_token(token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE) from error
        if payload.get("token_type") == "refresh":
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)
        login_id = payload.get("sub")
        if login_id is None:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)
        if await self.blacklist.exists(token):
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)
        user = await self.users.find_by_login_id(login_id)
        if user is None:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)
        return user
