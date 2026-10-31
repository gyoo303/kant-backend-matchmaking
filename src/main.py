# 앱 엔트리

# lifespan: 테이블 생성 → 시드 → 종료 시 엔진 정리
# app = FastAPI(...)

# 미들웨어: 요청 로깅, CORS

# 전역 예외 핸들러: 400 / 404 / 410 / 401 / 422 / 500
# (410은 Cache-Control: no-store — 브라우저가 해산 응답을 캐시하지 않게)

# 라우터 등록: auth API, rooms API, 화면 라우트
# /static 마운트
