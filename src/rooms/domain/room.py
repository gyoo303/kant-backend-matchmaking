# 방 도메인 — A팀·B팀 두 Team과 참가 기록을 묶는 루트
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
)
from rooms.domain.participation import Participation, TeamSide
from rooms.domain.team import Team

__all__ = ["DeleteReason", "Room", "RoomTitle", "TeamSide"]


class DeleteReason(StrEnum):
    GAME_STARTED = "GAME_STARTED"
    EMPTY = "EMPTY"


# 이미 다듬은 값만 받는다. 사용자 입력은 RoomTitle.of로 다듬는다
@dataclass(frozen=True)
class RoomTitle:
    value: str

    def __post_init__(self) -> None:
        if self.value != self.value.strip() or not 1 <= len(self.value) <= 20:
            raise InvalidRoomTitleError()

    @classmethod
    def of(cls, raw: str) -> "RoomTitle":
        return cls(raw.strip())


class Room:
    CAPACITY = 4

    def __init__(
        self,
        id: int | None,
        title: RoomTitle,
        host_user_id: int,
        last_join_order: int,
        created_at: datetime,
        deleted_at: datetime | None,
        delete_reason: DeleteReason | None,
        teams: list[Team],
        participations: list[Participation],
    ) -> None:
        if last_join_order < 0:
            raise ValueError("last_join_order는 0 이상이어야 합니다")
        if (deleted_at is None) != (delete_reason is None):
            raise ValueError("deleted_at과 delete_reason은 함께 있거나 함께 없어야 합니다")
        if sorted(team.side for team in teams) != [TeamSide.A, TeamSide.B]:
            raise ValueError("팀은 A·B 하나씩이어야 합니다")

        self.id = id
        self.title = title
        self.host_user_id = host_user_id
        self.last_join_order = last_join_order
        self.created_at = created_at
        self.deleted_at = deleted_at
        self.delete_reason = delete_reason
        self.teams: dict[TeamSide, Team] = {team.side: team for team in teams}
        self.participations = participations

        # 팀원 목록을 현재 참가 기록과 일치시킨다 (RISK-13)
        for team in self.teams.values():
            team.members = [p for p in participations if p.is_current and p.team == team.side]

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
            room_id=None, user_id=creator_id, join_order=1, team=TeamSide.A, joined_at=now
        )
        return cls(
            id=None,
            title=room_title,
            host_user_id=creator_id,
            last_join_order=1,
            created_at=now,
            deleted_at=None,
            delete_reason=None,
            teams=[Team(None, TeamSide.A), Team(None, TeamSide.B)],
            participations=[creator],
        )

    # 조회
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
        return self.CAPACITY - self.current_count

    def team(self, side: TeamSide) -> Team:
        return self.teams[side]

    def participation_of(self, user_id: int) -> Participation | None:
        for p in self.current_participants:
            if p.user_id == user_id:
                return p
        return None

    # 행위 — 모두 삭제된 방이면 RoomDeletedError가 먼저 (04 §2.3 거부 순서)
    def rename(self, requester_id: int, title: str) -> None:
        self._ensure_active()
        if requester_id != self.host_user_id:
            raise NotHostError()
        self.title = RoomTitle.of(title)

    def join(
        self, user_id: int, current_participation: Participation | None, now: datetime
    ) -> Participation:
        self._ensure_active()
        if current_participation is not None:
            if self.id is not None and current_participation.room_id == self.id:
                return current_participation  # 같은 방 재요청: 변화 없음 (D-006)
            raise AlreadyParticipatingError()
        if self.is_full:
            raise RoomFullError()

        self.last_join_order += 1
        participation = Participation(
            room_id=self.id,
            user_id=user_id,
            join_order=self.last_join_order,
            team=TeamSide.A,
            joined_at=now,
        )
        self._team_to_join().add(participation)
        self.participations.append(participation)
        return participation

    def change_team(self, user_id: int, target: TeamSide) -> None:
        self._ensure_active()
        participation = self.participation_of(user_id)
        if participation is None:
            raise NotParticipantError()
        if participation.team == target:
            return
        # add가 participation.team을 바꾸므로 원래 팀을 먼저 담아 둔다
        origin = self.team(participation.team)
        self.team(target).add(participation)
        origin.remove(participation)

    def leave(self, user_id: int, now: datetime) -> None:
        self._ensure_active()
        participation = self.participation_of(user_id)
        if participation is None:
            raise NotParticipantError()
        participation.end(now)
        self.team(participation.team).remove(participation)

        remaining = self.current_participants
        if not remaining:
            self._soft_delete(DeleteReason.EMPTY, now)
        elif user_id == self.host_user_id:
            self.host_user_id = min(remaining, key=lambda p: p.join_order).user_id

    def start_game(self, requester_id: int, now: datetime) -> None:
        self._ensure_active()
        if requester_id != self.host_user_id:
            raise NotHostError()
        if any(not team.is_full for team in self.teams.values()):
            raise InvalidTeamCompositionError()
        for participation in self.current_participants:
            participation.end(now)
        for team in self.teams.values():
            team.members.clear()
        self._soft_delete(DeleteReason.GAME_STARTED, now)

    # 내부
    def _team_to_join(self) -> Team:
        team_a = self.team(TeamSide.A)
        return team_a if not team_a.is_full else self.team(TeamSide.B)

    def _ensure_active(self) -> None:
        if not self.is_active:
            raise RoomDeletedError()

    def _soft_delete(self, reason: DeleteReason, now: datetime) -> None:
        self.deleted_at = now
        self.delete_reason = reason
