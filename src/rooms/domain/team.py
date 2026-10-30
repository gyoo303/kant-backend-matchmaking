from dataclasses import dataclass, field
from typing import ClassVar

from rooms.domain.exceptions import TeamFullError
from rooms.domain.participation import Participation, TeamSide

__all__ = ["Team", "TeamSide"]


@dataclass
class Team:
    """방 안의 한 편(A·B). 현재 팀원을 갖고 팀 정원 2명을 스스로 검사한다 (INV-01·03, ADR-010)."""

    CAPACITY: ClassVar[int] = 2

    id: int | None
    side: TeamSide
    members: list[Participation] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.members)

    @property
    def is_full(self) -> bool:
        return self.count >= self.CAPACITY

    def add(self, participation: Participation) -> None:
        if self.is_full:
            raise TeamFullError()
        participation.change_team(self.side)
        self.members.append(participation)

    def remove(self, participation: Participation) -> None:
        self.members.remove(participation)
