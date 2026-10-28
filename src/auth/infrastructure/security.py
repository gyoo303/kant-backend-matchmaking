from passlib.context import CryptContext


class PasswordHasher:
    """bcrypt 비밀번호 해시 (ADR-002, STK-07: bcrypt 4.0.1 고정)."""

    def __init__(self) -> None:
        self._context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def hash(self, raw: str) -> str:
        return self._context.hash(raw)

    def verify(self, raw: str, hashed: str) -> bool:
        return self._context.verify(raw, hashed)
