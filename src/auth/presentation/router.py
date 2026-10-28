"""auth JSON API (04-interfaces-api.md §4.1, API-AUTH-01~05, 교안 6장 1강 3.4)."""

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.service import AuthApplicationService
from auth.domain.user import User
from auth.presentation.dependencies import get_current_user, oauth2_scheme
from auth.presentation.schemas import (
    AccessTokenResponse,
    MessageResponse,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

LOGOUT_MESSAGE = "로그아웃되었습니다"


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthApplicationService:
    return AuthApplicationService(db)


@router.post("/signup", summary="회원가입", response_model=UserResponse)
async def signup(
    body: SignupRequest, service: AuthApplicationService = Depends(get_auth_service)
) -> UserResponse:
    user = await service.signup(body.login_id, body.nickname, body.password)
    return UserResponse.model_validate(user)


@router.post("/token", summary="로그인(OAuth2 토큰 발급)", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: AuthApplicationService = Depends(get_auth_service),
) -> TokenResponse:
    tokens = await service.login(form_data.username, form_data.password)
    return TokenResponse(**tokens)


@router.post("/logout", summary="로그아웃(토큰 차단)", response_model=MessageResponse)
async def logout(
    body: RefreshRequest,
    token: str = Depends(oauth2_scheme),
    _: User = Depends(get_current_user),
    service: AuthApplicationService = Depends(get_auth_service),
) -> MessageResponse:
    await service.logout(token, body.refresh_token)
    return MessageResponse(message=LOGOUT_MESSAGE)


@router.get("/me", summary="내 정보", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.post("/refresh", summary="access 토큰 재발급", response_model=AccessTokenResponse)
async def refresh(
    body: RefreshRequest, service: AuthApplicationService = Depends(get_auth_service)
) -> AccessTokenResponse:
    return AccessTokenResponse(**await service.refresh(body.refresh_token))
