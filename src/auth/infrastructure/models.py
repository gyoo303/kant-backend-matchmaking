from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


# 회원 정보를 users 테이블에 연결
class UserModel(Base):
    __tablename__ = 'users'

    # DB가 부여할 회원 식별자를 정의
    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    # 아이디와 닉네임의 중복을 제한
    login_id: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
    )

    nickname: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
        unique=True,
    )

    # 저장된 비밀번호 해시를 보관
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # 가입 시각의 기본값을 DB에서 생성
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

# 토큰 차단 기록을 token_blacklist 테이블에 연결
class TokenBlacklistModel(Base):
    __tablename__ = 'token_blacklist'

    # DB가 부여할 차단 기록 식별자를 정의
    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )

    # 차단 여부 조회에 사용할 토큰을 보관
    token: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )

    # 기록 생성 시각의 기본값을 DB에서 생성
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )