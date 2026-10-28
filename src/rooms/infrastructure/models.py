from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RoomModel(Base):
    """ENT-03 rooms (03-db-schema.md §3.3)."""

    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint("length(btrim(title)) BETWEEN 1 AND 20", name="ck_rooms_title_not_blank"),
        CheckConstraint("capacity = 4", name="ck_rooms_capacity_fixed"),
        CheckConstraint("last_join_order >= 0", name="ck_rooms_last_join_order"),
        CheckConstraint(
            "(deleted_at IS NULL AND delete_reason IS NULL) OR "
            "(deleted_at IS NOT NULL AND delete_reason IN ('GAME_STARTED','EMPTY'))",
            name="ck_rooms_delete_state",
        ),
        Index(
            "ix_rooms_active_created",
            text("created_at DESC"),
            text("id DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    title: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=4, server_default=text("4")
    )
    host_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    last_join_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)


class ParticipationModel(Base):
    """ENT-04 participations (03-db-schema.md §3.4).

    한 회원 한 방 부분 유니크 인덱스(uq_participations_user_current)는
    도전 A(TKT-DB-M6-01)에서 추가한다.
    """

    __tablename__ = "participations"
    __table_args__ = (
        CheckConstraint("join_order >= 1", name="ck_participations_join_order"),
        CheckConstraint("team IN ('A','B')", name="ck_participations_team"),
        CheckConstraint(
            "left_at IS NULL OR left_at >= joined_at", name="ck_participations_left_after_join"
        ),
        UniqueConstraint("room_id", "join_order", name="uq_participations_room_join_order"),
        Index(
            "ix_participations_room_current",
            "room_id",
            postgresql_where=text("left_at IS NULL"),
        ),
        Index(
            "ix_participations_user_joined",
            "user_id",
            text("joined_at DESC"),
            text("id DESC"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    room_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team: Mapped[str] = mapped_column(String(1), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
