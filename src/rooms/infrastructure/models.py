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

    # 1:N — 현재 참가자만. 목록에서 빼면 행이 지워진다 (ADR-011)
    participations: Mapped[list["ParticipationModel"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
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
    # 1:N — 이 팀의 현재 참가자
    participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="team")


class ParticipationModel(Base):
    """ENT-04 participations (03-db-schema.md §3.4, ADR-011).

    현재 참가만 담는다. PK는 (room_id, user_id), user_id unique로 한 회원 한 방(INV-04).
    """

    __tablename__ = "participations"

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True, unique=True)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # N:1 — 소속 방
    room: Mapped["RoomModel"] = relationship(back_populates="participations")
    # N:1 — 현재 소속 팀
    team: Mapped["TeamModel"] = relationship(back_populates="participations")


class ParticipationLogModel(Base):
    """ENT-06 participation_logs (03-db-schema.md §3.6, ADR-011).

    끝난 이용 1건 = 1행. 퇴장·해산 때 INSERT만 한다(INV-10).
    """

    __tablename__ = "participation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # N:1 — 방 (이력의 제목·삭제 여부)
    room: Mapped["RoomModel"] = relationship()
    # N:1 — 퇴장 때의 마지막 팀
    team: Mapped["TeamModel"] = relationship()
