# 앱 시작·종료 처리 (lifespan) — 테이블 생성, 시드, 커넥션 풀 정리
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

# ORM 모델 import: Base.metadata에 테이블을 등록해야 create_all이 테이블을 만든다
import auth.infrastructure.models  # noqa: F401
import rooms.infrastructure.models  # noqa: F401
from database import Base, close_db, engine

# TODO(seed): seed.py에 seed_initial_data가 구현되면 아래 import와 lifespan의 2) 블록 주석을 푼다
#   (2983a95: seed_initial_data 미구현으로 import 실패 → 서버 기동 불가 상태를 임시 회피)
# from config import get_settings
# from database import AsyncSessionLocal
# from seed import seed_initial_data


# lifespan
# @asynccontextmanager: yield 하나로 "앞부분=시작시, 뒷부분=종료시"를 구분해 주는 데코레이터
# FastAPI : 서버가 요청 받기 전에 yield 앞까지 실행한다
# 서버가 종료 신호를 받으면 yield 뒤를 실행한다
@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # 1) 테이블 생성 (SEQ-12)
    #   engine.begin(): 커넥션 하나 + 트랜잭션 열고 블록이 끝나면 자동 commit
    #   create_all -> "동기" 함수, async 커넥션에서 바로 부를 수 없다
    #   -> run_sync가 동기 함수를 비동기 커넥션 위에서 대신 실행 (교안 5강 1장)
    #   이미 있는 테이블은 건너뛴다 + 컬럼 변경은 반영하지 않는다
    #   (모델 바뀌면 DB 지우고 재생성 필요)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2) 시드 (한 세션 = 한 트랜잭션)
    #   seed_initial_data -> flush만 하고, commit은 여기서 딱 한 번.
    #   중간에 예외발생시 commit 없이 블록 이탈 -> 아무것도 저장X
    # async with AsyncSessionLocal() as session:
    #     await seed_initial_data(session, get_settings())
    #     await session.commit()

    yield  # 걸려있는 동안 서버가 요청을 처리한다.

    # 3) 종료: 커넥션 풀의 연결을 모두 닫는다 (database.close_db = engine.dispose)
    await close_db()
