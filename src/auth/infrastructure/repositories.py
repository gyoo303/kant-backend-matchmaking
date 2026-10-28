from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User
from auth.infrastructure.models import TokenBlacklistModel, UserModel


class UserRepository:
    """users ↔ User. flush만 하고 commit은 응용 서비스가 한다.

    아이디·닉네임 중복은 서비스가 exists_login_id·exists_nickname으로 먼저 확인한다.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_id(self, user_id: int) -> User | None:
        model = await self.session.get(UserModel, user_id)
        return self._to_domain(model) if model else None

    async def find_by_login_id(self, login_id: str) -> User | None:
        result = await self.session.execute(select(UserModel).where(UserModel.login_id == login_id))
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

    async def exists_login_id(self, login_id: str) -> bool:
        return bool(
            await self.session.scalar(select(exists().where(UserModel.login_id == login_id)))
        )

    async def exists_nickname(self, nickname: str) -> bool:
        return bool(
            await self.session.scalar(select(exists().where(UserModel.nickname == nickname)))
        )

    async def save(self, user: User) -> User:
        if user.id is None:
            model = self._to_model(user)
            self.session.add(model)
        else:
            model = await self.session.get(UserModel, user.id)
            if model is None:
                raise ValueError(f"저장할 회원이 없습니다: id={user.id}")
            model.login_id = user.login_id
            model.nickname = user.nickname
            model.hashed_password = user.hashed_password
        await self.session.flush()
        # DB가 채운 id·created_at을 객체에 다시 읽어 온다
        await self.session.refresh(model)
        return self._to_domain(model)

    @staticmethod
    def _to_domain(model: UserModel) -> User:
        return User(
            id=model.id,
            login_id=model.login_id,
            nickname=model.nickname,
            hashed_password=model.hashed_password,
            created_at=model.created_at,
        )

    @staticmethod
    def _to_model(user: User) -> UserModel:
        return UserModel(
            login_id=user.login_id,
            nickname=user.nickname,
            hashed_password=user.hashed_password,
        )


class TokenBlacklistRepository:
    """token_blacklist ↔ TokenBlacklist. flush만 하고 commit은 응용 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def exists(self, token: str) -> bool:
        stmt = select(exists().where(TokenBlacklistModel.token == token))
        return bool(await self.session.scalar(stmt))

    async def save(self, entry: TokenBlacklist) -> None:
        self.session.add(TokenBlacklistModel(token=entry.token))
        await self.session.flush()
