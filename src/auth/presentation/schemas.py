"""auth 요청·응답 스키마 (04-interfaces-api.md §5.1, 교안 6장 1강 3.1). 필드는 snake_case."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class _Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SignupRequest(_Schema):
    login_id: str = Field(..., max_length=50, description="아이디(4~20자 영문 소문자·숫자)")
    nickname: str = Field(..., max_length=50, description="닉네임(2~12자 한글·영문·숫자)")
    password: str = Field(..., max_length=128, description="비밀번호(8자 이상)")


class UserResponse(_Schema):
    id: int = Field(..., description="회원 ID")
    login_id: str = Field(..., description="아이디")
    nickname: str = Field(..., description="닉네임")
    created_at: datetime = Field(..., description="가입 시각")


class TokenResponse(_Schema):
    access_token: str = Field(..., description="발급된 JWT 액세스 토큰")
    refresh_token: str = Field(..., description="발급된 JWT 리프레시 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")


class RefreshRequest(_Schema):
    refresh_token: str = Field(..., description="토큰 재발급 및 로그아웃용 리프레시 토큰")


class AccessTokenResponse(_Schema):
    access_token: str = Field(..., description="새로 발급된 JWT 액세스 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")


class MessageResponse(_Schema):
    message: str = Field(..., description="안내 문구")
