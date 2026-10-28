"""auth 화면 라우트 (PAGE-01·02). 인증하지 않는다(D-021)."""

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"
templates = Jinja2Templates(directory=TEMPLATES_DIR)

EXPIRED_NOTICE = "로그인이 만료되었습니다. 다시 로그인해 주세요"

page_router = APIRouter(include_in_schema=False)


@page_router.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request=request, name="auth/signup.html", context={})


@page_router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, expired: int | None = None) -> HTMLResponse:
    notice = EXPIRED_NOTICE if expired == 1 else None
    return templates.TemplateResponse(
        request=request, name="auth/login.html", context={"notice": notice}
    )
