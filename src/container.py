# 의존성 조립(Composition Root)
# - 어떤 계약에 어떤 구현을 넣을지 "한 곳"에서 정한다. (D-031)

# [핵심 개념] DI 컨테이너 = 부품 설계도 모음
#   - provider 하나 = "이 객체는 이렇게 만든다"는 설계도.
#   - 호출할 때마다 설계도 따라 객체 생성 : container.auth_service(...) -> 서비스 객체
#   - 서비스, 저장소 코드는 container를 모른다 + container만 모두를 안다 (가장 바깥계층)

# [동작 방식] provider 종류와 수명 (scope)
#   Singleton 서버 전체에서 객체 하나 (첫 요청때 생성 후 재사용)
#     -> 상태가 없고 생성비용이 비싼 도구: 비밀번호 해시, 토큰 발급
#   Factory 부를 때마다 새 객체 생성
#     -> 요청 세션에 할당되는 repository + 그 저장소를 쓰는 서비스 객체
#   Configuration 설정값 상자, main.py -> .env 값을 넣는다

# [고려 사항]
#   - wiring: Provide[...] 표시가 있는 모듈을 등록해야 주입이 동작한다
#   새 모듈에서 Provide 쓰면 wiring_config.modules에 추가해야 한다
#   (추가 안하면 -> 500 에러)
#   - DbSession(웹 요청 <-> 세션 연결)도 "조립 정보" -> container에 둔다
#    database.py에서 fastapi 제거한다.
#   - 순환 import 주의: presentation이 container를 import하므로,
#     container는 presentation을 import하면 안 된다
#     -> wiring_config에 모듈을 문자열로 적는 이유!

from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from functools import partial
from typing import Annotated

from dependency_injector import containers, providers
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.infrastructure.repositories import (
    SqlAlchemyTokenBlacklistRepository,
    SqlAlchemyUserRepository,
)
from auth.infrastructure.security import BcryptPasswordHasher, JwtTokenProvider
from database import AsyncSessionLocal, get_db
from rooms.application.queries import RoomQueryService
from rooms.application.realtime import RealtimeServices
from rooms.application.service import RoomApplicationService
from rooms.domain.repository import RoomRepository
from rooms.infrastructure.realtime import InMemoryRoomRealtimeHub
from rooms.infrastructure.repositories import (
    SqlAlchemyRoomQueryRepository,
    SqlAlchemyRoomRepository,
)

# DbSession: 모든 라우터, 의존성이 "같은 방식"으로 세션을 받기 위한 별칭
# scope = "function"의 의미와 목적
#   - 기본값(request) -> yield 뒤 commit이 "응답 전송 후"에 실행
#   -> commit 실패해도 클라이언트는 이미 200을 받는다 (데이터와 응답 불일치)
#   - function이면 라우터 함수가 끝난 직후, "응답 전송 전"에 commit한다
#   -> commit 실패 = 500응답
# 반드시 이 별칭만 사용: Depends(get_db)를 따로 쓰면 scope가 달라 캐시 키가 갈리고,
# 한 요청에 세션이 2개 (= 트랜잭션 2개) 생김
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]
# DbSession 위치 이동: database.py -> container.py
# 옮긴 이유:
#   database.py는 ORM 모델(Base)이 import하는 infrastructure 모듈
#   여기에 fastapi가 있으면 “DB 계층이 웹 프레임워크를 안다”
#   *get_db는 순수 비동기 제너레이터라 database.py에 그대로 유지
#   (웹 요청과 세션을 잇는 별칭만 조립 지점으로 이동)

# 짧은 인증·조회 작업에 필요한 세션과 부품을 준비
@asynccontextmanager
async def _room_realtime_scope(
    *,
    session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]],
    auth_factory: Callable[..., AuthApplicationService],
    rooms_factory: Callable[..., RoomRepository],
    queries_factory: Callable[..., RoomQueryService],
) -> AsyncIterator[RealtimeServices]:
    # 작업마다 새 세션을 만들고 작업 종료 시 닫음
    async with session_factory() as session:
        # 인증과 방 조회에 같은 세션을 연결
        auth = auth_factory(
            users__session=session,
            blacklist__session=session,
        )

        rooms = rooms_factory(session=session)
        
        queries = queries_factory(
            room_repo__session=session,
            query_repo__session=session,
        )
        # 준비한 부품을 작업 범위 안에서 사용하도록 전달
        yield RealtimeServices(
            auth=auth,
            rooms=rooms,
            queries=queries,
        )
        
class Container(containers.DeclarativeContainer):
    # Provide[...]를 쓰는 모듈 목록. Container()를 만들 때 자동으로 연결(wire)된다
    #   wiring은 프로세스 전역: Container()를 또 만들면 연결이 새 컨테이너로 넘어간다
    wiring_config = containers.WiringConfiguration(
        modules=[
            "auth.presentation.dependencies",
            "rooms.presentation.router",
        ],
    )

    config = providers.Configuration()

    # ---------------------------------------------------------- 외부 도구 (Singleton)
    password_hasher = providers.Singleton(BcryptPasswordHasher)
    token_provider = providers.Singleton(
        JwtTokenProvider,
        secret_key=config.jwt_secret_key,
        access_expire_minutes=config.access_token_expire_minutes,
        refresh_expire_days=config.refresh_token_expire_days,
    )

    # 앱 안에서 방별 실시간 연결 상태를 공유
    room_realtime_hub = providers.Singleton(InMemoryRoomRealtimeHub)

    # ---------------------------------------------------------- 저장소 (Factory, session은 호출 때)
    user_repository = providers.Factory(SqlAlchemyUserRepository)
    token_blacklist_repository = providers.Factory(SqlAlchemyTokenBlacklistRepository)
    room_repository = providers.Factory(SqlAlchemyRoomRepository)
    room_query_repository = providers.Factory(SqlAlchemyRoomQueryRepository)

    # ---------------------------------------------------------- 응용 서비스 (Factory)
    # 키워드 이름(users, blacklist …)이 서비스 생성자 매개변수와 같아야 한다
    auth_service = providers.Factory(
        AuthApplicationService,
        users=user_repository,
        blacklist=token_blacklist_repository,
        hasher=password_hasher,
        tokens=token_provider,
    )
    room_service = providers.Factory(
        RoomApplicationService,
        rooms=room_repository,
    )
    room_query_service = providers.Factory(
        RoomQueryService,
        room_repo=room_repository,
        query_repo=room_query_repository,
    )
    # 인증·조회 작업 범위를 만들 함수에 필요한 팩토리를 연결
    room_realtime_scope = providers.Factory(
        partial,
        _room_realtime_scope,
        session_factory=providers.Object(AsyncSessionLocal),
        auth_factory=auth_service.provider,
        rooms_factory=room_repository.provider,
        queries_factory=room_query_service.provider,
    )