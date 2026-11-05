# 참가 기록 도메인
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from rooms.domain.exceptions import ParticipationAlreadyEndedError


class TeamSide(StrEnum):
    A = "A"
    B = "B"


# id 없음, (room_id, user_id)로 구분 (D-025)
@dataclass
class Participation:
    room_id: int | None  # 새 방이면 None, save 후 채워짐
    user_id: int
    join_order: int
    team: TeamSide
    joined_at: datetime
    left_at: datetime | None = None  # 이번 요청에서 끝나면 채워짐 → save가 로그로 옮김

    def __post_init__(self) -> None:
        if self.join_order < 1:
            raise ValueError("join_order는 1 이상이어야 합니다")
        if self.left_at is not None and self.left_at < self.joined_at:
            raise ValueError("left_at은 joined_at보다 이를 수 없습니다")

    @property
    def is_current(self) -> bool:
        return self.left_at is None

    def change_team(self, team: TeamSide) -> None:
        if not self.is_current:
            raise ParticipationAlreadyEndedError()
        self.team = team

    def end(self, now: datetime) -> None:
        if not self.is_current:
            raise ParticipationAlreadyEndedError()
        if now < self.joined_at:
            raise ValueError("퇴장 시각은 입장 시각보다 이를 수 없습니다")
        self.left_at = now
