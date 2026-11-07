# auth 웹 의존성 — 토큰 추출, 현재 회원 인증, 인증 서비스 받기
#
# [핵심 개념] presentation은 "무엇이 필요한지"만 말하고, 만드는 일은 container가 한다
#   - 3단계: 이 파일이 SqlAlchemy…Repository를 직접 만들었다 (presentation ->infrastructure)
#   - 4단계: Provide[Container.auth_service.provider]로 "인증 서비스 설계도"만 받는다
#     -> 이 파일에서 infrastructure import가 사라진다
#
# [동작 방식] @inject + Provide
#   1) Container()가 만들어질 때 wiring_config에 적힌 이 모듈을 연결(wire)
#   2) 요청이 오면 FastAPI가 get_auth_service를 부르고, @inject가
#      Provide[...] 자리에 container의 provider(설계도)를 넣어 준다
#   3) 설계도에 요청 세션을 넘겨 호출 -> 이번 요청 전용 서비스 객체
#
# [고려할 사항]
#   - .provider를 붙이면 "객체"가 아니라 "설계도(provider)"가 들어온다
#     -> 세션처럼 요청마다 다른 값을 넣고 직접 호출할 수 있다
#   - FastAPI 의존성 캐시: get_current_user와 라우터가 같은 get_auth_service를 쓰므로
#     한 요청 안에서는 서비스+세션이 하나로 공유된다

from collections.abc import Callable

from dependency_injector.wiring import Provide, inject
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from container import Container, DbSession

# 요청 헤더에서 Bearer 토큰을 꺼낼 도구를 준비
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


# container 설계도에 이번 요청 세션을 넣어 인증서비스 생성
@inject
def get_auth_service(
    db: DbSession,
    factory: Callable[..., AuthApplicationService] = Depends(
        Provide[Container.auth_service.provider]
    ),
) -> AuthApplicationService:
    # users_session: auth_service 안의 users 저장소 provider에 session=db 전달
    return factory(users__session=db, blacklist__session=db)


# 요청의 토큰으로 현재 회원을 인증
# 서비스도 의존성으로 받는다 → 라우터의 get_auth_service와 같은 객체(캐시)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    service: AuthApplicationService = Depends(get_auth_service),
) -> User:
    return await service.authenticate(token)


# 인증된 회원의 식별자를 반환
async def get_current_user_id(
    user: User = Depends(get_current_user),
) -> int:
    return user.id
