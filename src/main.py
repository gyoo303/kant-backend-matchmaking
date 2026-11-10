# 앱 엔트리 — 조립만 한다. 실제 내용은 bootstrap/ 아래 파일이 담당한다 (D-028)
#   bootstrap/lifespan.py        시작(create_all·seed)·종료(커넥션 풀 정리)
#   bootstrap/middleware.py      요청 로깅, 동시 처리 상한(ADR-015), CORS
#   bootstrap/error_handlers.py  전역 예외 핸들러 (400/401/404/410/422/500)
#   bootstrap/routing.py         라우터, /static 마운트
#   container.py                 의존성 조립 (D-031)
# 실행: uv run uvicorn main:app --app-dir src
import logging

from fastapi import FastAPI

from bootstrap.error_handlers import register_exception_handlers
from bootstrap.lifespan import lifespan
from bootstrap.middleware import register_middleware
from bootstrap.routing import register_routes
from config import get_settings
from container import Container


def create_app() -> FastAPI:
    # 로그 기본설정 - 앱 전체에서 딱 한번 호출 (가장 먼저)
    logging.basicConfig(level=logging.INFO)

    settings = get_settings()

    # 의존성 컨테이너 ㅡ 만드는 순간 wiring_config 모듈 연결
    container = Container()

    #   설정값은 여기서 한 번 넣는다 (JwtTokenProvider 비밀키, 만료시간)
    # pydantic Settings객체->dict->from_dict
    container.config.from_dict(settings.model_dump())

    app = FastAPI(
        title="2vs2 매치메이킹",  # /docs 화면 맨 위 제목
        description=(
            "2vs2 공개 방을 만들거나 참가하고, "
            "방장이 게임을 시작하거나 인원수가 0이 되면 방이 해산된다"
        ),
        version="0.1.0",  # /docs 화면 표시, API 버전
        lifespan=lifespan,
    )

    # 테스트 목적 - FastAPI Starlette
    app.state.container = container

    register_middleware(app, settings)
    register_exception_handlers(app)
    register_routes(app)
    return app


app = create_app()
