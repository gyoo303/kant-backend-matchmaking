from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from rooms.domain.exceptions import ParticipationAlreadyEndedError


class TeamSide(StrEnum):
    A = "A"
    B = "B"


@dataclass
class Participation:
    """한 회원이 한 방에 한 번 입장한 기록. left_at이 없으면 참가 중 (INV-10·11).

    별도 id 없이 (room_id, user_id)로 구분한다. 끝난 기록은 저장 때 이용 로그로 옮겨진다 (ADR-011).
    """

    room_id: int | None
    user_id: int
    join_order: int
    team: TeamSide
    joined_at: datetime
    left_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.join_order < 1:
            raise ValueError("입장 순서는 1 이상이어야 합니다")
        if self.left_at is not None and self.left_at < self.joined_at:
            raise ValueError("퇴장 시각은 입장 시각 이후여야 합니다")

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
            raise ValueError("퇴장 시각은 입장 시각 이후여야 합니다")
        self.left_at = now
