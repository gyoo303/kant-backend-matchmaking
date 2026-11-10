# DB 연결 — AsyncEngine과 세션
###### 실행흐름 ######
# 1. 라우터/의존성이 db: DbSession 선언 -> FastAPI가 get_db() 실행
# 2. get_db() -> session_scope()로 세션 열고, yield에서 멈춰 세션을 넘긴다.
# 3. 라우터 함수가 끝나면 (scope="function") yield 다음으로 복귀
#   - 정상종료 -> commit (요청 하나 = 트랜잭션 하나)
#   - 예외발생 -> rollback 후 raise -> bootstrap/error_handlers.py가 응답 생성
# 4. async with 블록 종료 -> 세션 클로즈 -> 커넥션을 pool에 반납한다
# 5. 최종적으로 응답이 클라이언트로 전송

###### 알아둘 것 #######
# commit(처리내용 확정) - 여기서만 수행
# 서비스, 저장소는 commit하지 않음
# 저장소는 필요 지점에서 flush만 한다
# (DB 생성값 id 필요할 때 & 같은 요청의 다음 조회가 봐야 할 때)


from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

# 루트 경로에 .env 파일이 없으면 불러오기 실패
# lru_cache 적용으로 .env 파일은 딱 한 번만 읽는다.
_settings = get_settings()

# engine
# DB 클라이언트 객체는 앱 전체에서 딱 하나만 만든다.
# bootstrap/lifespan.py - engine.begin()으로 접속한다.
engine = create_async_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,  # 평소에 유지하는 연결
    max_overflow=_settings.db_max_overflow,  # 작업이 몰리면 임시 추가하는 연결 수
    pool_timeout=_settings.db_pool_timeout,  # 커넥션 풀에서 연결을 가져올 때 대기 시간
    pool_recycle=_settings.db_pool_recycle,  # 커넥션 풀에서 연결을 재사용하기 전 최대 사용 시간
    pool_pre_ping=_settings.db_pool_pre_ping,  # 커넥션 풀에서 가져온 연결이 살아있는지 확인
    echo=_settings.db_echo,  # 실행하는 SQL을 콘솔에 찍는다. 기본 끔, 필요할 때 DB_ECHO=true (D-036)
)

# AsyncSessionLocal
# 세션 팩토리
# 세션 = 하나의 요청이 DB와 주고받는 작업 단위
# AsyncSessionLocal 호출할 때마다 세션 +1
# expire_on_commit = False > 비동기 환경에서 필수 (교안 5-2)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=_settings.db_session_expire_on_commit,
    autoflush=_settings.db_session_autoflush,
)


# Base: 모든 ORM 모델의 부모, 교안 5-1
# 클래스 내부 정의 필요X - 상속만 하면 빈 테이블 목록 생성 (Base.metadata)
# 작업분담 B, D파트가 class UserModel(Base)처럼 상속 -> 해당 모델이 목록에 등록된다.
# 나중에 bootstrap/lifespan.py에서 create_all 호출 -> 목록에 올라간 테이블 전체를 생성한다.
class Base(DeclarativeBase):
    """모든 ORM 모델의 부모"""


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """
    블록 정상 종료 -> commit
    예외 발생 -> rollback 후 raise
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            # 블록 안의 예외 + commit 자체 실패를 모두 여기서 잡는다
            await session.rollback()
            raise


# get_db(): 요청마다 세션 하나
# 요청이 들어올 때마다 세션을 뿌려준다.
async def get_db() -> AsyncIterator[AsyncSession]:
    """
    - 요청 하나에 세션 하나
    - 예외 발생 시 작업 중 변경사항 rollback 후 raise
      -> bootstrap/error_handlers.py 전역 예외 핸들러
    """
    async with session_scope() as session:
        yield session


############


############
# 서버 종료 시 engine.dispose() 호출 -> 커넥션 풀 정리
async def close_db() -> None:
    """서버 종료 시 커넥션 풀 정리"""
    await engine.dispose()
