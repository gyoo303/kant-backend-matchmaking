from datetime import datetime

from sqlalchemy import DateTime, Identity, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class UserModel(Base):
    """ENT-01 users (03-db-schema.md §3.1)."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("login_id", name="uq_users_login_id"),
        UniqueConstraint("nickname", name="uq_users_nickname"),
    )
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    login_id: Mapped[str] = mapped_column(String(20), nullable=False)
    nickname: Mapped[str] = mapped_column(String(12), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TokenBlacklistModel(Base):
    """ENT-02 token_blacklist (03-db-schema.md §3.2)."""

    __tablename__ = "token_blacklist"
    __table_args__ = (
        UniqueConstraint("jti", name="uq_token_blacklist_jti"),
        Index("ix_token_blacklist_expires_at", "expires_at"),
    )
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    jti: Mapped[str] = mapped_column(String(36), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
