# 미들웨어 등록 — 요청 로깅, CORS (등록 순서 CONV-11)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # 다른 출처(도메인/포트) 접근 허용 규칙

from config import Settings
from logging_middleware import log_requests


def register_middleware(app: FastAPI, settings: Settings) -> None:
    """먼저 등록한 미들웨어가 안쪽, 나중에 등록한 미들웨어가 바깥쪽이다."""

    # 1) 요청 로깅 ㅡ 먼저 등록 : 안쪽
    #   @app.middleware("http") 데코레이터를 함수 위에 붙이는 것과 같은 동작.
    #   함수가 다른 파일(logging_middleware.py)에 있어서 "호출" 형태로 등록한다.
    #   log_requests(request, call_next) -> FastAPI가 request, call_next를 넣어 호출하고 응답을 반환
    app.middleware("http")(log_requests)

    # 2) CORS 허용 ㅡ 나중 등록 : 바깥쪽
    #   CORS(Cross-Origin Resource Sharing) :
    #   브라우저는 보안상 "다른 출처"(도메인/포트가 다른 곳)로 보내는 요청을 막는다.
    #   서버가 "이 출처는 허용해요"라고 응답 헤더에 넣어줘야 브라우저가 통과시킴
    app.add_middleware(
        CORSMiddleware,
        # 허용할 출처 목록 ㅡ .env의 CORS_ORIGINS 값 (예: ["http://localhost:8000"])
        # ["*"] -> 모든 출처 허용; 아무 사이트나 우리 API 호출이 가능해지므로 금지
        allow_origins=settings.cors_origins,
        # API가 실제로 쓰는 HTTP 메서드 허용 목록
        # PUT -> 멱등성 보장, PATCH -> 멱등성 보장 X
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        # 브라우저가 보낼 수 있는 요청 헤더
        #  Authorization: "Bearer <JWT 토큰>" (로그인 인증)
        #  Content-Type: "application/json" (JSON 요청 본문 형식)
        allow_headers=["Authorization", "Content-Type"],
        # allow_credentials = True, # 쿠키/인증 헤더 허용 여부
    )
