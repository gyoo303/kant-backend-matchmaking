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

LOGIN_FAILED_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다'
BLACKLISTED_REFRESH_MESSAGE = '로그아웃 처리되어 사용할 수 없는 토큰입니다'
EXPIRED_REFRESH_MESSAGE = '리프레시 토큰이 만료되었습니다. 다시 로그인하세요'
INVALID_TOKEN_MESSAGE = '인증 토큰이 올바르지 않거나 로그인이 만료되었습니다'

# 인증 처리의 순서와 확정을 담당
class AuthApplicationService:
    def __init__(self, db: AsyncSession) -> None:
        # 같은 세션을 사용하는 저장소를 준비
        self.db = db
        self.users = UserRepository(db)
        self.blacklist = TokenBlacklistRepository(db)

        # 비밀번호 해시 도구를 준비
        self.hasher = PasswordHasher()

    # 입력 검사와 중복 확인을 거쳐 새 회원을 저장
    async def signup(
        self,
        login_id: str,
        nickname: str,
        password: str,
    ) -> User:
        # 비밀번호 원문의 최소 길이를 검사
        User.validate_raw_password(password)
        
        if await self.users.exists_login_id(login_id):
            raise DuplicateLoginIdError
        
        # 저장할 닉네임 기준으로 중복을 확인
        if await self.users.exists_nickname(nickname.strip()):
            raise DuplicateNicknameError
        
        # 비밀번호 원문을 저장용 해시로 변환
        passowrd_hash = self.hasher.hash(password)
        
        # 도메인 규칙을 검사해 새 회원 객체를 만듦
        user = User.register(login_id, nickname, passowrd_hash)

        # 회원을 저장하고 DB 생성값이 반영된 객체를 받음
        saved = await self.users.save(user)

        # 회원가입의 DB 변경을 확정
        await self.db.commit()

        return saved

    # 회원 정보를 확인해 access와 refresh 토큰을 발급
    async def login(self, login_id: str, password: str) -> dict:
        # 로그인 아이디로 회원을 조회
        user = await self.users.find_by_login_id(login_id)

        # 회원 없음과 비밀번호 불일치를 같은 오류로 처리
        if user is None or not self.hasher.verify(password, user.hashed_password):
            raise AuthenticationError(LOGIN_FAILED_MESSAGE)

        # 회원의 로그인 아이디를 담은 토큰을 반환
        return {
            'access_token' : create_access_token({'sub': user.login_id}),
            'refresh_token' : create_refresh_token({'sub': user.login_id}),
            'token_type' : 'bearer',
        }
    # refresh 토큰을 확인해 새 access 토큰을 발급한다
    async def refresh(self, refresh_token: str) -> dict:
        # 차단된 토큰의 재사용을 거부한다
        if await self.blacklist.exists(refresh_token):
            raise AuthenticationError(BLACKLISTED_REFRESH_MESSAGE)
        
        # JWT의 서명과 만료를 검증
        try:
            payload = decode_token(refresh_token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise AuthenticationError(EXPIRED_REFRESH_MESSAGE) from error
        
        # refresh 용도와 회원 식별값을 확인
        login_id = payload.get('sub')
        if payload.get('token_type') != 'refresh' or login_id is None:
            raise AuthenticationError(EXPIRED_REFRESH_MESSAGE)

        # 새 access 토큰만 반환
        return {
            'access_token': create_access_token({'sub': login_id}),
            'token_type': 'bearer',
        }
    
    # access와 refresh 토큰을 모두 차단
    async def logout(self, access_token: str, refresh_token: str) -> None:
        # 로그아웃에 사용할 refresh 토큰을 검증
        try:
            decode_token(refresh_token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise InvalidRefreshTokenError() from error

        # 이미 처리한 refresh 토큰의 재사용을 거부
        if await self.blacklist.exists(refresh_token):
            raise AlreadyLoggedOutError()

        # access 토큰의 차단 기록을 저장
        await self.blacklist.save(TokenBlacklist(token=access_token))

        # refresh 토큰의 차단 기록을 저장
        await self.blacklist.save(TokenBlacklist(token=refresh_token))

        # 두 차단 기록의 저장을 함께 확정
        await self.db.commit()
    
    # 토큰을 검증해 현재 회원을 반환
    async def authenticate(self, token: str) -> User:
        # JWT의 서명과 만료를 검증
        try:
            payload = decode_token(token)
        except (ExpiredSignatureError, InvalidTokenError) as error:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE) from error
        
        # refresh 토큰을 요청 인증에 사용하는 것을 거부
        if payload.get('token_type') == 'refresh':
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)

        # 회원을 조회할 로그인 아이디 확인
        login_id = payload.get('sub')
        if login_id is None:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)

        # 로그아웃으로 차단된 토큰의 사용을 거부
        if await self.blacklist.exists(token):
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)

        # 토큰에 담긴 로그인 아이디로 회원을 조회
        user = await self.users.find_by_login_id(login_id)
        if user is None:
            raise AuthenticationError(INVALID_TOKEN_MESSAGE)

        return user