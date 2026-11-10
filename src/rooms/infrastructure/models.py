# rooms ORM 모델

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base  # ORM 모델의 부모 클래스 (공통요소)

### 개념: ORM 모델 = 테이블 설계도
# `class RoomModel(Base)` 처럼 `Base`를 상속하면 `Base.metadata`라는 "테이블 목록"에 자동 등록
#   - 나중에 A의 `bootstrap/lifespan.py`가 `create_all`을 부르면 목록에 있는 테이블을 실제로 생성함
# `Mapped[int]` = "이 속성은 int 컬럼"이라는 타입 표시
# `mapped_column(...)` = 컬럼 옵션(PK, FK, 길이 등).
# `Mapped[datetime | None]` 처럼 `| None`을 붙이면 NULL 허용 컬럼
# `relationship(...)` = 컬럼이 아니라 **"연결된 다른 객체로 가는 길"**
#   - `room_model.participations` 처럼 파이썬 리스트로 다룰 수 있게 함

### 이 프로젝트 테이블 구조의 특이사항 3가지 (ADR-011)
# 1. `participations` = **지금 방에 있는 사람만**. 행이 있으면 참가 중 -> 그래서 `left_at` 컬럼 없음
# 2. 나간 기록은 `participation_logs`로 **INSERT만**(수정·삭제 금지, INV-10).
# 3. `participations`의 PK는 `(room_id, user_id)` **복합키**, 그리고 `user_id`는 `unique=True`
#     → "한 회원은 동시에 한 방에만" 강제


# RoomModel: rooms 테이블
class RoomModel(Base):
    __tablename__ = "rooms"  # 실제 DB 내 테이블 이름

    # primary_key=True + int -> 1,2,3 자동 넘버링 (PostgreSQL)
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(20), nullable=False)
    # default=4, 값 안넣으면 4 들어감
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    # ForeignKey("users.id") : 문자열로 적어도 접근 가능하다, 파일 별도 import 필요없다
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    last_join_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # timezone=True, UTC 기준
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # 아래 두 값이 채워지면 "삭제된 방" (소프트삭제 - 행은 남기고 표시만 한다)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # ── 관계 정의 ──
    # 현재 참가자 목록.
    # cascade="all, delete-orphan" : 이 리스트에서 remove()한 행은 flush 때 DB에서도 DELETE된다.
    #   -> 퇴장 처리("로그로 옮기고 참가 행 삭제")가 이 설정 덕분에 리스트 조작만으로 끝난다
    participations: Mapped[list["ParticipationModel"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    # A-B 두 팀. 방이 삭제돼도 행은 남아야 한다(로그가 가리킴) - cascade 주지 않는다
    teams: Mapped[list["TeamModel"]] = relationship(back_populates="room")


# TeamModel: teams 테이블 (방마다 A·B 두 행)
class TeamModel(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    side: Mapped[str] = mapped_column(String(1), nullable=False)  # A 또는 B

    # back_populates : 양쪽 relationship이 "서로 같은 연결"임을 알려준다.
    #  team.room = room 하면 room.teams에도 자동으로 들어간다.
    room: Mapped["RoomModel"] = relationship(back_populates="teams")
    participations: Mapped[list["ParticipationModel"]] = relationship(back_populates="team")


# 제약 이름을 상수로 둔다
# repository가 IntegrityError 제약 이름으로 "무슨 위반인가"를 구분
UQ_PARTICIPATION_USER = "uq_participations_user_id"
UQ_PARTICIPATION_JOIN_ORDER = "uq_participations_room_join_order"


# ParticipationModel: participations 테이블 — 현재 참가만 (team_id -> teams)
#   - PK (room_id, user_id), user_id unique, left_at 없음.
class ParticipationModel(Base):
    __tablename__ = "participations"

    # __table_args__ : 컬럼 하나에 붙이기 어려운 테이블 단위 설정 (여러 컬럼 unique 등)
    __table_args__ = (
        # 한 회원은 동시에 한 방에만. 기존 unique=True 제약에 이름만 붙임
        #   이름을 붙인 이유 = 위반 시 "이미 참가 중(400)"으로 정확히 판단 가능
        UniqueConstraint("user_id", name=UQ_PARTICIPATION_USER),

        # 안전망 - 한 방 안에서 입장순번 겹치면 저장 자체를 실패시킨다.
        #   잠금이 제대로 걸려 있으면 절대 생기지 않는다
        #   생겼다 = 버그 = 500 호출한다
        #   잠금 전: 순번이 겹친 채 조용히 에러없이 저장성공 (baseline test)
        UniqueConstraint("room_id", "join_order",
                         name=UQ_PARTICIPATION_JOIN_ORDER),
    )

    # 두 컬럼에 primary_key=True -> 복합PK (room_id, user_id)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    # unique=True -> 한 회원은 participations에 딱 1행만, 동시에 한 방에만 참가
    #   이전 행(참여)는 덮어쓴다.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # left_at 없음! 나가면 이 행이 지워지고 participation_logs에 남는다

    room: Mapped["RoomModel"] = relationship(back_populates="participations")
    team: Mapped["TeamModel"] = relationship(back_populates="participations")


# ParticipationLogModel: participation_logs 테이블
# — 끝난 이용 1건 = 1행, INSERT only
class ParticipationLogModel(Base):
    __tablename__ = "participation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)  # 같은 방 재입장도 행이 따로 생긴다
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    join_order: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # 역방향(back_populates)
    # RoomModel에 logs 목록을 두면 방을 읽을 때 지난 기록까지 끌려올 위험 O
    room: Mapped["RoomModel"] = relationship()
    team: Mapped["TeamModel"] = relationship()
