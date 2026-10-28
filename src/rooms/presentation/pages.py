"""rooms 화면 라우트 (PAGE-03~06).

인증하지 않는다(D-021). 서버는 템플릿 틀과 URL 값만 넘기고, 회원 데이터는 JS가 API로 채운다.
"""

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"
templates = Jinja2Templates(directory=TEMPLATES_DIR)

DISSOLVED_NOTICE = "게임이 시작되어 방이 해산되었습니다"

page_router = APIRouter(include_in_schema=False)


@page_router.get("/", response_class=HTMLResponse)
async def room_list_page(
    request: Request,
    keyword: str = "",
    available_only: bool = False,
    sort: str = "newest",
    page: int = 1,
    notice: str | None = None,
) -> HTMLResponse:
    cond = {"keyword": keyword, "available_only": available_only, "sort": sort, "page": page}
    message = DISSOLVED_NOTICE if notice == "dissolved" else None
    return templates.TemplateResponse(
        request=request, name="rooms/list.html", context={"cond": cond, "notice": message}
    )


@page_router.get("/rooms/{room_id}", response_class=HTMLResponse)
async def room_detail_page(request: Request, room_id: int) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request, name="rooms/detail.html", context={"room_id": room_id}
    )


@page_router.get("/me/history", response_class=HTMLResponse)
async def history_page(request: Request, page: int = 1) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request, name="rooms/history.html", context={"page": page}
    )


@page_router.get("/me/history/{room_id}", response_class=HTMLResponse)
async def archived_room_page(request: Request, room_id: int) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request, name="rooms/archived.html", context={"room_id": room_id}
    )
