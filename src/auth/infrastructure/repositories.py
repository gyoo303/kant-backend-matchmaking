from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User
from auth.infrastructure.models import TokenBlacklistModel, UserModel
from auth.application.repository import TokenBlacklistRepository, UserRepository

# 회원의 DB처리와 도메인 객체 변환을 담당
# class UserRepository:
class SqlAlchemyUserRepository(UserRepository):
    # 호출부가 전달한 세션을 보관
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # 기본 키로 회원을 조회
    async def find_by_id(self, user_id: int) -> User | None:
        model = await self.session.get(UserModel, user_id)
    
        # 조회 결과가 없으면 None 반환
        if model is None:
            return None
        
        # 조회한 모델을 도메인 객체로 변환
        return self._to_domain(model)

    # 로그인 아이디로 회원을 조회
    async def find_by_login_id(self, login_id: str) -> User | None:
        # 로그인 아이디 조건을 가진 조회 구문을 만듦
        stmt = select(UserModel).where(UserModel.login_id == login_id)
    
        # 조회를 실행하고 ORM 객체를 꺼냄
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()

        # 조회 결과가 없으면 None을 반환
        if model is None:
            return None
        
        # 조회한 모델을 도메인 객체로 변환
        return self._to_domain(model)

    # 같은 로그인 아이디의 회원이 있는지 검사
    async def exists_login_id(self, login_id: str) -> bool:
        # 로그인 아이디의 존재 여부를 확인할 구문을 만듦
        stmt = select(exists().where(UserModel.login_id == login_id))

        # 조회 결과를 bool로 반환
        result = await self.session.scalar(stmt)
        return bool(result)
    
    # 같은 닉네임의 회원이 있는지 검사
    async def exists_nickname(self, nickname: str) -> bool:
        # 닉네임의 존재 여부를 확인할 구문을 만듦
        stmt = select(exists().where(UserModel.nickname == nickname))

        # 조회 결과를 bool로 반환
        result = await self.session.scalar(stmt)
        return bool(result)

    # 회원을 저장하고 DB의 값을 반영한 도메인 객체를 반환
    # 같은 요청의 다음 조회와 DB 생성값(id, created_at)을 위해 flush. 확정은 get_db
    async def save(self, user: User) -> User:
        if user.id is None:
            # 새 회원의 ORM 객체를 세션에 등록
            model = self._to_model(user)
            self.session.add(model)
        else:
            # 저장할 기존 회원을 조회
            model = await self.session.get(UserModel, user.id)
            if model is None:
                raise ValueError(f"저장할 회원이 없습니다: id={user.id}")
            
            # 기존 회원의 변경 값을 반영
            model.login_id = user.login_id
            model.nickname = user.nickname
            model.hashed_password = user.hashed_password

        # 세션의 변경을 DB에 전달
        await self.session.flush()

        # DB가 생성한 값을 다시 읽음
        await self.session.refresh(model)

        # 저장 결과를 도메인 객체로 반환
        return self._to_domain(model)

    @staticmethod
    def _to_domain(model: UserModel) -> User:
        return User(
            id= model.id,
            login_id=model.login_id,
            nickname=model.nickname,
            hashed_password=model.hashed_password,
            created_at=model.created_at,
        )

    # 새 회원을 저장할 ORM 모델을 만듦
    @staticmethod
    def _to_model(user: User) -> UserModel:
        return UserModel(
            login_id=user.login_id,
            nickname=user.nickname,
            hashed_password=user.hashed_password,
        )

# 토큰 차단 기록의 DB 조회와 저장을 담당
# class TokenBlacklistRepository:
class SqlAlchemyTokenBlacklistRepository(TokenBlacklistRepository):
    # 호출부가 전달한 세션을 보관
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # 토큰의 차단 기록이 있는지 확인
    async def exists(self, token: str) -> bool:
        # 같은 토큰의 존재 여부를 확인할 구문을 만듦
        stmt = select(exists().where(TokenBlacklistModel.token == token))

        # 조회 결과를 bool로 반환
        result = await self.session.scalar(stmt)
        return bool(result)
    
    # 토큰 차단 기록을 저장
    # 같은 요청의 이후 조회가 볼 수 있도록 flush. 확정은 get_db
    async def save(self, entry: TokenBlacklist) -> None:
        # 도메인 객체의 토큰으로 ORM 객체를 만듦
        model = TokenBlacklistModel(token=entry.token)

        # 차단 기록을 세션에 등록
        self.session.add(model)

        # 세션의 변경을 DB에 전달
        await self.session.flush()