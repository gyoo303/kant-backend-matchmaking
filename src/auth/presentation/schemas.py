from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
"""
> model_config = ConfigDict(from_attributes=True) <

기본적으로 Pydantic은 딕셔너리 형태의 데이터에서 값을 읽어옴
하지만 DB에서 조회한 결과나 클래스는 딕셔너리가 아닌 '객체' 형태
위 설정을 하게되면 알아서 (.)을 찍어 속성 값을 읽어옴

클래스마다 적는게 귀찮으니 공통 부모 클래스로 만들어 상속시키는 방법도 있음
"""

# 회원가입 요청의 필드와 입력 상한을 정의
class SignupRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    login_id: str = Field(
        max_length=50,
        description='아이디(4~20자 영문 소문자·숫자)',
    )
    nickname: str = Field(
        max_length=50,
        description='닉네임(2~12자 한글·영문·숫자)',
    )
    password: str = Field(
        max_length=128,
        description='비밀번호(8자 이상)',
    )

# 회원 응답에 공개할 필드만 정의
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description='회원 ID')
    login_id: str = Field(description='아이디')
    nickname: str = Field(description='닉네임')
    created_at: datetime = Field(description='가입 시각')

# 로그인 성공 시 반환할 두 토큰을 정의
class TokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str = Field(description='엑세스 토큰')
    refresh_token: str = Field(description='리프레시 토큰')
    token_type: str = Field(default='bearer', description='토큰 인증 방식')

# 토큰 재발급과 로그아웃에 사용할 요청을 정의
class RefreshRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    refresh_token: str = Field(
        description='토큰 재발급 및 로그아웃용 리프레시 토큰',
    )

# 토큰 재발급 시 반환할 응답을 정의
class AccessTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str = Field(description='액세스 토큰')
    token_type: str = Field(description='토큰 인증 방식')

# 처리 결과의 안내 메시지를 정의
class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes = True)

    message: str = Field(description='처리 결과 메시지')