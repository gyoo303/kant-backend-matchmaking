# DB 연결 — AsyncEngine과 세션
###### 실행흐름 ######
# 1. 라우터에서 db: AsyncSession = Depends(get_db) 호출로 실행된다.
# 2. yield에서 멈추고 세션을 라우터에게 다시 넘긴다
# 3. 요청 처리가 끝나면 yield 다음 코드를 진행한다
# 4. async with 블록 실행 완료 -> 세션 close -> 커넥션을 pool에 반납한다.

###### 예외처리 #######
# 작업 중 변경사항을 rollback으로 되돌린다.
# 그다음 raise로 오류를 발생시켜 main.py의 전역 예외 핸들러가 응답을 만들도록 한다 (400, 404 등)

###### 알아둘 것 #######
# commit(처리내용 확정)은 여기서 처리하지 않는다.
# 실제 작업요청을 처리하는 개별 서비스에서 마지막에 await self.db.commit() 호출한다.


from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

# 루트 경로에 .env 파일이 없으면 불러오기 실패
# lru_cache 적용으로 .env 파일은 딱 한 번만 읽는다.
_settings = get_settings()

# engine
# DB 클라이언트 객체는 앱 전체에서 딱 하나만 만든다.
# main.py - engine.begin()으로 접속한다.
engine = create_async_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,  # 평소에 유지하는 연결
    max_overflow=_settings.db_max_overflow,  # 작업이 몰리면 임시 추가하는 연결 수
)

# AsyncSessionLocal
# 세션 팩토리
# 세션 = 하나의 요청이 DB와 주고받는 작업 단위
# AsyncSessionLocal 호출할 때마다 세션 +1
# expire_on_commit = False > 비동기 환경에서 필수 (교안 5-2)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Base: 모든 ORM 모델의 부모, 교안 5-1
# 클래스 내부 정의 필요X - 상속만 하면 빈 테이블 목록 생성 (Base.metadata)
# 작업분담 B, D파트가 class UserModel(Base)처럼 상속 -> 해당 모델이 목록에 등록된다.
# 나중에 main.py에서 create_all 호출 -> 목록에 올라간 테이블 전체를 생성한다.
class Base(DeclarativeBase):
    """모든 ORM 모델의 부모"""


# get_db(): 요청마다 세션 하나 (commit은 서비스가 한다)
# 요청이 들어올 때마다 세션을 뿌려준다.
async def get_db() -> AsyncIterator[AsyncSession]:
    """
    - 요청 하나에 세션 하나
    - 예외 발생 시 작업 중 변경사항 rollback 후 raise -> main.py 전역 예외 핸들러
    """

    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
