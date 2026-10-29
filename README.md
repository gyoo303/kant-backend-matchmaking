# kant-backend-matchmaking

2vs2 공개 방 매치메이킹 서비스 (FastAPI 4계층). 팀원이 함께 손코딩으로 구현하는 저장소입니다.

각 파일에는 만들어야 할 클래스·함수 이름만 주석으로 적혀 있습니다.
참고 구현은 `reference/agent-pipeline-blueprint` 브랜치에 있습니다.

## 구조

```
src/
  main.py  config.py  database.py  exceptions.py  seed.py  logging_middleware.py
  auth/    회원가입, 로그인(JWT), 로그아웃
  rooms/   방 만들기, 참가, 팀 변경, 나가기, 게임 시작, 조회
    domain/          순수 파이썬 도메인
    infrastructure/  ORM 모델, 저장소
    application/     서비스
    presentation/    스키마, API 라우터, 화면 라우트
  templates/  static/
tests/
  unit/  integration/
```

## 실행

```bash
uv sync
cp .env.example .env   # 값 채우기
uv run uvicorn main:app --app-dir src --reload
```

## 테스트

```bash
uv run pytest
```
