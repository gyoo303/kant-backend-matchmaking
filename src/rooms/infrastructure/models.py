# rooms ORM 모델
#
# 테이블 4개를 SQLAlchemy 2.0 방식(Mapped / mapped_column)으로 정의한다.
# 기준 문서: docs/02-arch/03-db-schema.md §3.3~§3.6 (컬럼 표가 정답)
#
# 핵심 구조 (ADR-011)
#   participations      = 지금 방에 있는 사람만. 행이 있으면 참가 중이라는 뜻.
#   participation_logs  = 나간 기록. 퇴장·해산 때 1행씩 INSERT만 한다.
#   -> 그래서 participations 에는 left_at 컬럼이 없다.
#
# 교안 수준 규칙(D-020): mapped_column 기본 옵션과 relationship 까지만 쓴다.
# CHECK, 이름 붙인 제약, 복합 인덱스는 두지 않는다 (도메인 클래스가 검사한다).

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
    # deleted_at 이 채워지면 삭제된 방(소프트 삭제). 조회는 이 값으로 활성/보관을 가른다.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # 1:N — 현재 참가자만 담긴다.
    # cascade="all, delete-orphan": 이 목록에서 remove 하면 flush 때 그 행이 실제로 지워진다.
    # 퇴장 처리(로그로 옮기고 행 삭제)가 이 설정에 기댄다 (ADR-011).
    participations: Mapped[list["ParticipationModel"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    # 1:N — A·B 두 팀 (ADR-010). 방이 삭제돼도 팀 행은 남겨야 하므로 cascade 를 주지 않는다.
    teams: Mapped[list["TeamModel"]] = relationship(back_populates="room")


class TeamModel(Base):
    """ENT-05 teams (03-db-schema.md §3.5).

    방 하나당 side='A', side='B' 두 행이 방 생성 때 함께 만들어진다.
    팀 정원(2명)은 컬럼이 아니라 도메인 상수 Team.CAPACITY 다.
    """

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

    지금 참가 중인 회원만 담는다. 나가면 participation_logs 로 옮기고 이 행은 지운다.

    - PK 는 (room_id, user_id) 복합키 — 한 방에 같은 회원 행은 하나뿐
    - user_id unique=True — 한 회원은 동시에 한 방에만 (INV-04 를 DB 제약으로 보장)
    - left_at 컬럼도, 자체 id 도 없다
    """

    __tablename__ = "participations"

    # primary_key=True 를 두 컬럼에 주면 복합 PK 가 된다 (__table_args__ 불필요)
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

    끝난 이용 1건 = 1행. 퇴장·해산 때 INSERT 만 하고 이후 바꾸거나 지우지 않는다 (INV-10).
    같은 (방, 회원) 로그가 여러 행이면 그 방에 다시 들어왔던 것이다 (재입장 이력).
    """

    __tablename__ = "participation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # 끝난 기록만 들어오므로 left_at 도 NOT NULL 이다
    left_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # N:1 — 방 (이력 화면의 방 제목·삭제 여부를 읽는 용도)
    # 역방향(RoomModel 쪽 목록)은 만들지 않는다. 방을 읽을 때 지난 기록까지 끌려오면 안 된다.
    room: Mapped["RoomModel"] = relationship()
    # N:1 — 퇴장 때의 마지막 팀
    team: Mapped["TeamModel"] = relationship()
