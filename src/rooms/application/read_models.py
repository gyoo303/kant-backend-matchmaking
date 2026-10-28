"""조회 결과·조건을 담는 읽기 모델. RoomQueryRepository가 반환 타입으로 쓴다."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from rooms.domain.room import TeamSide


@dataclass(frozen=True)
class RoomListCondition:
    keyword: str | None
    available_only: bool
    sort: Literal["newest", "oldest"]
    page: int
    size: int


@dataclass(frozen=True)
class RoomSummary:
    id: int
    title: str
    current_count: int
    capacity: int
    is_full: bool
    created_at: datetime


@dataclass(frozen=True)
class ParticipantView:
    user_id: int
    nickname: str
    team: TeamSide
    is_host: bool


@dataclass(frozen=True)
class RoomDetail:
    id: int
    title: str
    capacity: int
    current_count: int
    is_full: bool
    host_user_id: int
    participants: list[ParticipantView]
    my_team: TeamSide | None
    am_i_host: bool
    created_at: datetime


@dataclass(frozen=True)
class CurrentRoom:
    room_id: int
    title: str


@dataclass(frozen=True)
class HistoryItem:
    participation_id: int
    room_id: int
    room_title: str
    joined_at: datetime
    left_at: datetime | None
    is_current: bool
    room_deleted: bool


@dataclass(frozen=True)
class MyRecord:
    joined_at: datetime
    left_at: datetime | None


@dataclass(frozen=True)
class ArchivedRoom:
    room_id: int
    title: str
    capacity: int
    created_at: datetime
    deleted_at: datetime
    my_records: list[MyRecord]


@dataclass(frozen=True)
class RoomPage:
    items: list[RoomSummary]
    total: int
    page: int
    size: int


@dataclass(frozen=True)
class HistoryPage:
    items: list[HistoryItem]
    total: int
    page: int
    size: int


@dataclass(frozen=True)
class LeaveResult:
    room_deleted: bool
    new_host_user_id: int | None


@dataclass(frozen=True)
class GameStartResult:
    room_id: int
    dissolved_at: datetime
