# 라우터·정적 파일 등록 — auth API, rooms API, 화면 라우트, /static
from pathlib import Path  # 파일, 폴더 경로를 운영체제와 상관없이 다루는 도구

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles  # CSS, JS 등 파일을 그대로 내려주는 기능

from auth.presentation.pages import page_router as auth_page_router
from auth.presentation.router import router as auth_router
from rooms.presentation.pages import page_router as rooms_page_router
from rooms.presentation.router import router as rooms_router
from rooms.presentation.websocket import router as rooms_websocket_router

# static 폴더 절대경로 만들기
# __file__ : 현재 실행중인 파일(bootstrap/routing.py)의 절대경로
# .resolve() : 상대경로를 절대경로로 바꾼다
# .parents[1] : 두 단계 위 폴더 경로 (.../src)
# / "static" : Path에서는 "/"로 경로를 이어 붙인다 -> .../src/static
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"


def register_routes(app: FastAPI) -> None:
    """API 라우터, 화면 라우터를 등록하고 /static을 마운트한다."""
    app.include_router(auth_router)
    app.include_router(rooms_router)
    # 방 실시간 연결 경로를 앱에 등록
    app.include_router(rooms_websocket_router)
    app.include_router(auth_page_router)
    app.include_router(rooms_page_router)

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
