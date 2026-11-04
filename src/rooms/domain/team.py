# 팀 도메인 — 방 안의 한 편(A / B), 정원 2명 (ADR-010)
from dataclasses import dataclass, field
from typing import ClassVar

from rooms.domain.exceptions import TeamFullError
from rooms.domain.participation import Participation, TeamSide

__all__ = ["Team", "TeamSide"]


# Team은 Room을 통해서만 바뀐다 — 서비스·레포지토리가 add/remove를 직접 부르지 않는다
@dataclass
class Team:
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
