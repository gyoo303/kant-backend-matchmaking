from dataclasses import dataclass


@dataclass(frozen=True)
class TokenBlacklist:
    """로그아웃한 토큰의 차단 기록 (INV-14). access·refresh 토큰 원문을 그대로 담는다."""

    token: str

    def __post_init__(self) -> None:
        if not self.token:
            raise ValueError("차단할 토큰이 비어 있습니다")
