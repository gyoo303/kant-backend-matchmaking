# rooms 화면 라우트 — 인증하지 않는다(D-021). 회원 데이터는 템플릿 JS가 API로 채운다
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"
templates = Jinja2Templates(directory=TEMPLATES_DIR)

DISSOLVED_NOTICE = "게임이 시작되어 방이 해산되었습니다"

page_router = APIRouter(include_in_schema=False)


# GET /  방 목록
@page_router.get("/", response_class=HTMLResponse)
async def room_list_page(
    request: Request,
    keyword: str = "",
    available_only: str = "",
    sort: str = "newest",
    page: str = "1",
    notice: str | None = None,
):
    cond = {"keyword": keyword, "available_only": available_only, "sort": sort, "page": page}
    return templates.TemplateResponse(
        request=request,
        name="rooms/list.html",
        context={
            "cond": cond,
            "notice": DISSOLVED_NOTICE if notice == "dissolved" else None,
        },
    )


# GET /rooms/{room_id}  방 상세
@page_router.get("/rooms/{room_id}", response_class=HTMLResponse)
async def room_detail_page(request: Request, room_id: int):
    return templates.TemplateResponse(
        request=request, name="rooms/detail.html", context={"room_id": room_id}
    )


# GET /me/history  내 이용 기록
@page_router.get("/me/history", response_class=HTMLResponse)
async def history_page(request: Request, page: int = 1):
    return templates.TemplateResponse(
        request=request, name="rooms/history.html", context={"page": max(page, 1)}
    )


# GET /me/history/{room_id}  보관 정보
@page_router.get("/me/history/{room_id}", response_class=HTMLResponse)
async def archived_room_page(request: Request, room_id: int):
    return templates.TemplateResponse(
        request=request, name="rooms/archived.html", context={"room_id": room_id}
    )
