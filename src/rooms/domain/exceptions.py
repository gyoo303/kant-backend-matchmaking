from exceptions import DomainRuleError, GoneError, NotFoundError


class InvalidRoomTitleError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("방 제목은 앞뒤 공백을 빼고 1~20자여야 합니다")


class RoomDeletedError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 삭제된 방입니다")


class RoomFullError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("정원이 마감되었습니다")


class AlreadyParticipatingError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 다른 방에 참가 중입니다")


class NotHostError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("방장만 할 수 있습니다")


class NotParticipantError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이 방의 참가자가 아닙니다")


class TeamFullError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("선택한 팀의 정원이 찼습니다")


class InvalidTeamCompositionError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("A팀과 B팀이 각각 2명일 때만 시작할 수 있습니다")


class ParticipationAlreadyEndedError(DomainRuleError):
    def __init__(self) -> None:
        super().__init__("이미 종료된 참가 기록입니다")


class RoomNotFoundError(NotFoundError):
    def __init__(self) -> None:
        super().__init__("방을 찾을 수 없습니다")


class RoomDissolvedError(GoneError):
    def __init__(self) -> None:
        super().__init__("게임이 시작되어 방이 해산되었습니다")
