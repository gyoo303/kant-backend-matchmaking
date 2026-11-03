from dataclasses import dataclass

# 로그아웃한 토큰의 차단 기록을 보관

@dataclass(frozen=True)
class TokenBlacklist:
    token: str

    # 빈 토큰으로 차단 기록을 만들지 못하게 함
    def __post_init__(self) -> None:
        if not self.token:
            raise ValueError('토큰은 빈 문자열일 수 없습니다')
            