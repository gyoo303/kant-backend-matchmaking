# auth 저장소 계약 (추상클래스)
# - application이 필요한 기능을 정의한다.

# [의존성 역전]
#   application(이 파일) <- infrastructure(SqlAlchemyUserRepository가 상속해서 구현함)
#   서비스는 이 계약만 알고 있고, 실제 구현(SQLAlchemy)은 container.py가 골라서 넣는다.

# [규칙]
#   - import는 domain과 표준 라이브러리만 (sqlalchemy 금지)
#   - 반환 타입은 도매인 객체 (ORM 모델 금지)
#   - ABC: @abstractmethod를 하나라도 덜 구현하면 그 클래스는 객체 생성 불가능
#   -> 구현 누락을 앱이 시작될 때 바로 알 수 있다.

from abc import ABC, abstractmethod

from auth.domain.token_blacklist import TokenBlacklist
from auth.domain.user import User

class UserRepository(ABC):
    """회원 저장소 contract 정의"""

    @abstractmethod
    async def find_by_id(self, user_id: int) -> User | None:
        """기본 키로 회원을 찾고 없으면 None 반환한다"""

    @abstractmethod
    async def find_by_login_id(self, login_id: str) -> User | None:
        """로그인 아이디로 회원을 찾는다, 없으면 None 반환한다"""

    @abstractmethod
    async def exists_login_id(self, login_id: str) -> bool:
        """같은 로그인 아이디가 있는가? 아이디 중복 확인한다"""

    @abstractmethod
    async def exists_nickname(self, nickname: str) -> bool:
        """존재하는 닉네임인가? - 닉네임 중복 확인한다"""

    @abstractmethod
    async def save(self, user: User) -> User:
        """
        저장 후 DB 생성값(id, created_at)이 채워진 회원을 돌려준다
        commit 안함
        """

class TokenBlacklistRepository(ABC):
    """
    토큰 차단 기록 저장소 계약
    """        

    @abstractmethod
    async def exists(self, token: str) -> bool:
        """차단된 토큰인가?"""

    @abstractmethod
    async def save(self, entry: TokenBlacklist) -> None:
        """차단 기록 저장 (이후 인프라에서 DB 반영한다), commit 안함"""