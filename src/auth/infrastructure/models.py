from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class UserModel(Base):
    """ENT-01 users (03-db-schema.md §3.1)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    login_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TokenBlacklistModel(Base):
    """ENT-02 token_blacklist (03-db-schema.md §3.2). 로그아웃한 토큰 원문을 보관한다."""

    __tablename__ = "token_blacklist"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
