from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class RoomModel(Base):
    """ENT-03 rooms (03-db-schema.md §3.3)."""

    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    last_join_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # 1:N — 방의 이용 기록 전체(현재 참가 + 종료 기록)
    participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="room")
    # 1:N — A·B 두 팀 (ADR-010)
    teams: Mapped[list["TeamModel"]] = relationship(back_populates="room")


class TeamModel(Base):
    """ENT-05 teams (03-db-schema.md §3.5)."""

    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    side: Mapped[str] = mapped_column(String(1), nullable=False)

    # N:1 — 소속 방
    room: Mapped["RoomModel"] = relationship(back_populates="teams")
    # 1:N — 이 팀에 속한(속했던) 참가 기록
    participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="team")


class ParticipationModel(Base):
    """ENT-04 participations (03-db-schema.md §3.4).

    한 회원 한 방 부분 유니크 인덱스(uq_participations_user_current)는
    도전 A(TKT-DB-M6-01)에서 추가한다.
    """

    __tablename__ = "participations"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # N:1 — 소속 방
    room: Mapped["RoomModel"] = relationship(back_populates="participations")
    # N:1 — 소속 팀 (종료 기록은 마지막 팀)
    team: Mapped["TeamModel"] = relationship(back_populates="participations")
