from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from rooms.domain.exceptions import (
    AlreadyParticipatingError,
    InvalidRoomTitleError,
    InvalidTeamCompositionError,
    NotHostError,
    NotParticipantError,
    RoomDeletedError,
    RoomFullError,
    TeamFullError,
)
from rooms.domain.participation import Participation, TeamSide

__all__ = ["DeleteReason", "Room", "RoomTitle", "TeamSide"]

MAX_TITLE_LENGTH = 20


class DeleteReason(StrEnum):
    GAME_STARTED = "GAME_STARTED"
    EMPTY = "EMPTY"


@dataclass(frozen=True)
class RoomTitle:
    """앞뒤 공백을 뺀 1~20자 제목 (INV-12)."""

    value: str

    def __post_init__(self) -> None:
        if self.value != self.value.strip() or not 1 <= len(self.value) <= MAX_TITLE_LENGTH:
            raise InvalidRoomTitleError()

    @classmethod
    def of(cls, raw: str) -> "RoomTitle":
        return cls(raw.strip())


class Room:
    """2vs2 공개 방. 참가 기록을 묶는 집합의 루트 (INV-01~09)."""

    CAPACITY = 4
    TEAM_CAPACITY = 2

    def __init__(
        self,
        id: int | None,
        title: RoomTitle,
        host_user_id: int,
        last_join_order: int,
        created_at: datetime,
        deleted_at: datetime | None,
        delete_reason: DeleteReason | None,
        participations: list[Participation],
    ) -> None:
        if last_join_order < 0:
            raise ValueError("마지막 입장 순서는 0 이상이어야 합니다")
        if (deleted_at is None) != (delete_reason is None):
            raise ValueError("삭제 시각과 삭제 사유는 함께 있거나 함께 없어야 합니다")
        self.id = id
        self.title = title
        self.host_user_id = host_user_id
        self.last_join_order = last_join_order
        self.created_at = created_at
        self.deleted_at = deleted_at
        self.delete_reason = delete_reason
        self.participations = participations

    @classmethod
    def create(
        cls,
        title: str,
        creator_id: int,
        current_participation: Participation | None,
        now: datetime,
    ) -> "Room":
        if current_participation is not None:
            raise AlreadyParticipatingError()
        room_title = RoomTitle.of(title)
        creator = Participation(
            id=None,
            room_id=None,
            user_id=creator_id,
            join_order=1,
            team=TeamSide.A,
            joined_at=now,
        )
        return cls(
            id=None,
            title=room_title,
            host_user_id=creator_id,
            last_join_order=1,
            created_at=now,
            deleted_at=None,
            delete_reason=None,
            participations=[creator],
        )

    @property
    def is_active(self) -> bool:
        return self.deleted_at is None

    @property
    def current_participants(self) -> list[Participation]:
        return [p for p in self.participations if p.is_current]

    @property
    def current_count(self) -> int:
        return len(self.current_participants)

    @property
    def is_full(self) -> bool:
        return self.current_count >= self.CAPACITY

    @property
    def available_seats(self) -> int:
        return max(self.CAPACITY - self.current_count, 0)

    def team_count(self, team: TeamSide) -> int:
        return sum(1 for p in self.current_participants if p.team == team)

    def participation_of(self, user_id: int) -> Participation | None:
        return next((p for p in self.current_participants if p.user_id == user_id), None)

    def rename(self, requester_id: int, title: str) -> None:
        self._ensure_active()
        if requester_id != self.host_user_id:
            raise NotHostError()
        self.title = RoomTitle.of(title)

    def join(
        self,
        user_id: int,
        current_participation: Participation | None,
        now: datetime,
    ) -> Participation:
        self._ensure_active()
        if current_participation is not None:
            if self.id is not None and current_participation.room_id == self.id:
                return self.participation_of(user_id) or current_participation
            raise AlreadyParticipatingError()
        if self.is_full:
            raise RoomFullError()
        self.last_join_order += 1
        participation = Participation(
            id=None,
            room_id=self.id,
            user_id=user_id,
            join_order=self.last_join_order,
            team=self._team_with_fewer_members(),
            joined_at=now,
        )
        self.participations.append(participation)
        return participation

    def change_team(self, user_id: int, target: TeamSide) -> None:
        self._ensure_active()
        participation = self.participation_of(user_id)
        if participation is None:
            raise NotParticipantError()
        if participation.team == target:
            return
        if self.team_count(target) >= self.TEAM_CAPACITY:
            raise TeamFullError()
        participation.change_team(target)

    def leave(self, user_id: int, now: datetime) -> None:
        self._ensure_active()
        participation = self.participation_of(user_id)
        if participation is None:
            raise NotParticipantError()
        participation.end(now)
        remaining = self.current_participants
        if not remaining:
            self._soft_delete(DeleteReason.EMPTY, now)
        elif user_id == self.host_user_id:
            self.host_user_id = min(remaining, key=lambda p: p.join_order).user_id

    def start_game(self, requester_id: int, now: datetime) -> None:
        self._ensure_active()
        if requester_id != self.host_user_id:
            raise NotHostError()
        if (
            self.team_count(TeamSide.A) != self.TEAM_CAPACITY
            or self.team_count(TeamSide.B) != self.TEAM_CAPACITY
        ):
            raise InvalidTeamCompositionError()
        for participation in self.current_participants:
            participation.end(now)
        self._soft_delete(DeleteReason.GAME_STARTED, now)

    def _team_with_fewer_members(self) -> TeamSide:
        """인원이 적은 팀, 같으면 A팀 (Q-03)."""
        if self.team_count(TeamSide.A) <= self.team_count(TeamSide.B):
            return TeamSide.A
        return TeamSide.B

    def _ensure_active(self) -> None:
        if not self.is_active:
            raise RoomDeletedError()

    def _soft_delete(self, reason: DeleteReason, now: datetime) -> None:
        self.deleted_at = now
        self.delete_reason = reason
