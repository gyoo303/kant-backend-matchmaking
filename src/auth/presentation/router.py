from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from auth.presentation.dependencies import get_auth_service, get_current_user, oauth2_scheme
from auth.presentation.schemas import (
    AccessTokenResponse,
    MessageResponse,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)

# 인증 API의 공통 경로와 문서 분류를 지정
router = APIRouter(prefix="/api/auth", tags=["auth"])

# 회원가입 요청을 인증 서비스에 연결
@router.post(
    "/signup",
    summary="회원가입",
    response_model=UserResponse,
)
async def signup(
    body: SignupRequest,
    service: AuthApplicationService = Depends(get_auth_service),
) -> UserResponse:
    # 요청의 가입 정보를 서비스에 전달
    user = await service.signup(
        body.login_id,
        body.nickname,
        body.password,
    )

    # 저장된 회원을 공개 응답 형식으로 변환
    return UserResponse.model_validate(user)


# 로그인 폼을 토큰 발급 서비스에 연결
@router.post(
    "/token",
    summary="로그인(OAuth2 토큰 발급)",
    response_model=TokenResponse,
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: AuthApplicationService = Depends(get_auth_service),
) -> TokenResponse:
    # 폼의 아이디와 비밀번호를 서비스에 전달
    tokens = await service.login(
        form_data.username,
        form_data.password,
    )

    # 발급 결과를 토큰 응답 형식으로 변환
    return TokenResponse.model_validate(tokens)


# 인증된 회원의 공개 정보를 반환
@router.get(
    "/me",
    summary="내 정보",
    response_model=UserResponse,
)
async def me(
    user: User = Depends(get_current_user),
) -> UserResponse:
    # 인증 결과를 공개 응답 형식으로 변환
    return UserResponse.model_validate(user)


# refresh 토큰으로 새 access 토큰 발급을 요청
@router.post(
    "/refresh",
    summary="access 토큰 재발급",
    response_model=AccessTokenResponse,
)
async def refresh(
    body: RefreshRequest,
    service: AuthApplicationService = Depends(get_auth_service),
) -> AccessTokenResponse:
    # 본문의 refresh 토큰을 서비스에 전달
    tokens = await service.refresh(body.refresh_token)

    # 발급 결과를 access 토큰 응답 형식으로 변환
    return AccessTokenResponse.model_validate(tokens)


# 인증된 요청의 두 토큰을 차단
@router.post(
    "/logout",
    summary="로그아웃(토큰 차단)",
    response_model=MessageResponse,
    dependencies=[Depends(get_current_user)],
)
async def logout(
    body: RefreshRequest,
    token: str = Depends(oauth2_scheme),
    service: AuthApplicationService = Depends(get_auth_service),
) -> MessageResponse:
    # 헤더의 access 토큰과 본문의 refresh 토큰을 서비스에 전달
    await service.logout(token, body.refresh_token)

    # 로그아웃 완료 문구를 반환
    return MessageResponse(message="로그아웃되었습니다")
