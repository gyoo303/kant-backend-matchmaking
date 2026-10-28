from datetime import datetime

from sqlalchemy import delete, exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.exceptions import DuplicateLoginIdError, DuplicateNicknameError
from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User
from auth.infrastructure.models import TokenBlacklistModel, UserModel


def _violated_constraint(error: IntegrityError) -> str | None:
    """IntegrityError에서 위반한 제약 이름을 꺼낸다(asyncpg 원인 예외 우선, 없으면 메시지)."""
    cause = getattr(error.orig, "__cause__", None)
    name = getattr(cause, "constraint_name", None)
    if name:
        return name
    message = str(error.orig)
    for candidate in ("uq_users_login_id", "uq_users_nickname"):
        if candidate in message:
            return candidate
    return None


class UserRepository:
    """users ↔ User. flush만 하고 commit은 응용 서비스가 한다."""

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
        try:
            await self.session.flush()
        except IntegrityError as error:
            constraint = _violated_constraint(error)
            if constraint == "uq_users_login_id":
                raise DuplicateLoginIdError() from error
            if constraint == "uq_users_nickname":
                raise DuplicateNicknameError() from error
            raise
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

    async def exists(self, jti: str) -> bool:
        stmt = select(exists().where(TokenBlacklistModel.jti == jti))
        return bool(await self.session.scalar(stmt))

    async def save(self, entry: TokenBlacklist) -> None:
        self.session.add(self._to_model(entry))
        await self.session.flush()

    async def delete_expired(self, now: datetime) -> int:
        result = await self.session.execute(
            delete(TokenBlacklistModel).where(TokenBlacklistModel.expires_at < now)
        )
        return result.rowcount or 0

    @staticmethod
    def _to_domain(model: TokenBlacklistModel) -> TokenBlacklist:
        return TokenBlacklist(jti=model.jti, expires_at=model.expires_at)

    @staticmethod
    def _to_model(entry: TokenBlacklist) -> TokenBlacklistModel:
        return TokenBlacklistModel(jti=entry.jti, expires_at=entry.expires_at)
