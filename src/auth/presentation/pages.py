from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

# 로그인 화면에 전달할 만료 안내 문구를 정의
EXPIRED_NOTICE = "로그인이 만료되었습니다. 다시 로그인해 주세요"

# 현재 파일을 기준으로 공통 템플릿 경로를 지정
TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"

# 템플릿 파일로 HTML 응답을 만들 도구를 준비
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# API 문서에서 제외할 화면 라우터를 준비
page_router = APIRouter(include_in_schema=False)


# 회원가입 템플릿으로 화면을 응답
@page_router.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="auth/signup.html",
        context={},
    )


# 로그인 템플릿으로 화면을 응답
@page_router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, expired: int | None = None):
    # 만료 안내가 필요한 요청인지 확인
    notice = EXPIRED_NOTICE if expired == 1 else None

    # 로그인 템플릿에 안내 문구를 전달
    return templates.TemplateResponse(
        request=request,
        name="auth/login.html",
        context={"notice": notice},
    )
