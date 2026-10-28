"""도메인 예외의 기반 클래스. 외부 라이브러리를 import하지 않는다.

전역 예외 핸들러(src/main.py)는 아래 부모 클래스만 HTTP 상태 코드로 바꾼다.
DomainRuleError → 400, NotFoundError → 404, GoneError → 410, AuthenticationError → 401.
"""


class DomainError(ValueError):
    """모든 도메인 예외의 부모. message는 응답 detail로 그대로 나간다."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class DomainRuleError(DomainError):
    """규칙 위반 (권한 성격 포함, D-015)."""


class NotFoundError(DomainError):
    """대상 없음·조회 권한 없음."""


class GoneError(DomainError):
    """게임 시작으로 해산된 방 상세 조회 (D-016)."""


class AuthenticationError(Exception):
    """토큰 없음·무효·만료·블랙리스트, 로그인 실패."""

    def __init__(self, message: str = "인증이 필요합니다") -> None:
        super().__init__(message)
        self.message = message
