# auth 저장소 계약 (추상클래스)
# - application이 필요한 기능을 정의한다.

# [핵심 개념] 저장소(Repository) = "Aggregate를 넣고 꺼내는 컬렉션(집합)"
#   - 서비스 입장에서 저장소는 list/dictCJFJA "User를 넣고(save) -> 찾는(find) 정보상자"
#   - 상자 안이 PostgreSQL인지, 메모리인지, 파일인지는 서비스가 몰라도 ok
#   - 그래서 "무엇을 넣고 꺼내는가(계약)"는 도메인 개념 : domain 계층에 둔다.
#   - "어떻게 넣고 꺼내는가(SQL)" - infrastructure 계층에 둔다.

# [의존성 역전]
#   application(이 파일) <- infrastructure(SqlAlchemyUserRepository가 상속해서 구현함)
#   서비스는 이 계약만 알고 있고, 실제 구현(SQLAlchemy)은 container.py가 골라서 넣는다.

# [규칙]
#   - import는 domain과 표준 라이브러리만 (sqlalchemy 금지)
#   - 반환 타입은 도매인 객체 (ORM 모델 금지)
#   - ABC: @abstractmethod를 하나라도 덜 구현하면 그 클래스는 객체 생성 불가능
#   -> 구현 누락을 앱이 시작될 때 바로 알 수 있다.

# [위치 규칙] "계약은 인자, 반환 타입이 속한 가장 안쪽 계층에 둔다"
#   - UserRepository는 User, TokenBlacklist(domain객체)만 주고받는다 -> domain
#   - (비교) RoomQueryRepository는 read_models(application) 반환 -> application

# [고려사항]
#   - import는 표준 라이브러리(abc)와 같은 기능의 domain만 (sqlalchemy 금지)
#   - 반환 타입은 도메인 객체 (ORM 모델 X)
#   - 메서드는 async def : DB I/O contract이므로. 엔티티(User) 메서드는 계속 동기
#   - 계약 정의를 통해 구현 누락을 첫 요청 또는 단위 테스트에서 바로 발견 가능

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