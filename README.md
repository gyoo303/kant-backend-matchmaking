# kant-backend-matchmaking

2vs2 공개 방 매치메이킹 서비스 (FastAPI 4계층). 팀원이 함께 손코딩으로 구현하는 저장소입니다.

각 파일에는 만들어야 할 클래스·함수 이름만 주석으로 적혀 있습니다.
참고 구현은 `reference/agent-pipeline-blueprint` 브랜치에 있습니다.
5명 작업 분담은 [`docs/work-assignment.md`](docs/work-assignment.md)를 봅니다.

## 시작하기 — 팀원 개발 환경 맞추기

모든 팀원이 같은 버전의 패키지로 작업하도록, 처음 받을 때와 `uv.lock`이 바뀔 때마다 아래 순서로 실행합니다.

**1. dev 브랜치로 이동**

```bash
git switch dev
```

**2. 최신 내용 받기**

```bash
git pull
```

**3. 의존성 설치**

```bash
uv sync --frozen
```

> **참고**
> - `--frozen`을 붙이면 `uv.lock`을 다시 계산하지 않고 그대로 설치합니다. 그래서 모든 팀원이 같은 버전을 받습니다.
> - 개발용 그룹(`pytest`, `ruff` 등)은 `uv sync`할 때 기본으로 같이 설치됩니다.
> - Python은 **3.13 이상**이 필요합니다. 없으면 `uv python install 3.13`으로 설치하면 됩니다.
> - 이 저장소에는 `.python-version` 파일이 없습니다.

**4. 작업 브랜치 만들기**

각 팀원은 `dev` 브랜치를 기준으로 새 브랜치를 만들어 작업합니다. `dev`에 직접 커밋하지 않습니다. 위 1~2단계로 `dev`를 최신으로 받은 뒤 만듭니다.

```bash
git checkout -b <브랜치명>
```

### 브랜치 이름 규칙

`<종류>/<작업 내용>` 형식으로 짓습니다.

| 종류 | 언제 | 예 |
|---|---|---|
| `feat` | 새 기능 구현 | `feat/auth-signup`, `feat/room-join` |
| `fix` | 버그 수정 | `fix/room-team-full-check` |
| `refactor` | 동작은 그대로 두고 코드 구조 정리 | `refactor/room-repository` |
| `test` | 테스트 추가·수정 | `test/team-domain` |
| `docs` | 문서 수정 | `docs/readme-branch-rule` |
| `chore` | 설정·의존성 등 그 밖의 작업 | `chore/ruff-config` |

- 영어 소문자를 쓰고, 단어 사이는 `-`(하이픈)으로 잇습니다. 공백·한글·대문자는 쓰지 않습니다.
- 작업 내용은 짧게, 무엇을 하는지 알 수 있게 씁니다. 예: `feat/login` 보다 `feat/auth-login-token`
- 한 브랜치에는 한 가지 작업만 담습니다. 작업이 끝나면 `dev`로 PR을 엽니다.

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
uv sync --frozen
cp .env.example .env   # 값 채우기
uv run uvicorn main:app --app-dir src --reload
```

## 테스트

```bash
uv run pytest
```
