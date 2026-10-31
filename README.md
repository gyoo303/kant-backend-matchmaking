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
cp .env.example .env   # 로컬 학습용 예시 값이 들어 있어 그대로 써도 됩니다
uv run uvicorn main:app --app-dir src --reload
```

### 로컬 PostgreSQL 띄우기 (Docker Desktop, Windows 기준)

`.env.example`의 접속 정보(`matchmaking:matchmaking@localhost:5432/matchmaking`)로 접근할 수 있는 PostgreSQL 서버를 Docker로 띄우는 방법입니다. Docker Desktop은 이미 설치되어 있다고 봅니다.

> 💡 **터미널은 PowerShell을 쓰세요.** 프로젝트 문서는 Windows에서 Git Bash를 기준으로 하지만, Docker 명령은 PowerShell에서 실행하는 게 안전해요. Git Bash는 `-v …:/var/lib/postgresql/data` 같은 `/`로 시작하는 경로를 Windows 경로로 바꿔 버려서 명령이 깨질 수 있어요. 끝의 "자주 막히는 점" 5번도 참고하세요.

#### 1단계. Docker Desktop 실행

1. 시작 메뉴에서 **Docker Desktop**을 실행해요.
2. 처음이면 약관 동의 창이 떠요. 로그인 화면은 **Skip**해도 돼요.
3. 창 왼쪽 아래에 **Engine running**(초록색)이 보일 때까지 기다려요. 작업 표시줄 오른쪽 트레이의 고래 아이콘이 움직이지 않으면 준비된 거예요.

#### 2단계. PowerShell에서 프로젝트 경로로 이동하고 Docker 확인

PowerShell을 열고 저장소를 클론한 폴더로 이동해요. 경로는 각자 받은 위치로 바꾸세요.

```powershell
cd C:\Users\<사용자이름>\Documents\kant-backend-matchmaking
```

```powershell
docker --version
```

```powershell
docker info
```

- 버전이 나오고 `docker info`에 오류가 없으면 준비된 거예요.
- `error during connect` 또는 `Cannot connect to the Docker daemon` 오류가 나면 Docker Desktop이 아직 켜지는 중이에요. 1단계의 Engine running을 기다려요.

#### 3단계. 5432 포트가 비어 있는지 확인

```powershell
netstat -ano | findstr :5432
```

- **아무것도 안 나오면** 다음 단계로 가요.
- **`LISTENING` 줄이 나오면** 이미 다른 PostgreSQL이 이 포트를 쓰고 있는 거예요. Windows용 PostgreSQL 설치본이 서비스로 켜져 있는 경우가 흔해요. 둘 중 하나를 해요.
  - `Win + R` → `services.msc` → `postgresql-x64-…` 서비스를 **중지**해요.
  - 4단계 명령의 `-p 5432:5432`를 `-p 5433:5432`로 바꾸고, `.env`의 주소도 `localhost:5433`으로 바꿔요.

#### 4단계. PostgreSQL 컨테이너 띄우기

`.env`의 `DATABASE_URL`에 맞춰 사용자, 비밀번호, DB 이름을 모두 `matchmaking`으로 만들어요.

```powershell
docker run -d --name matchmaking-db -e POSTGRES_USER=matchmaking -e POSTGRES_PASSWORD=matchmaking -e POSTGRES_DB=matchmaking -p 5432:5432 -v matchmaking-pgdata:/var/lib/postgresql/data postgres:16
```

| 옵션 | 뜻 |
|---|---|
| `-d` | 터미널을 붙잡지 않고 뒤에서 실행 |
| `--name matchmaking-db` | 컨테이너 이름. 이후 명령에서 이 이름을 써요 |
| `-e POSTGRES_USER/PASSWORD/DB` | 처음 만들 때 생기는 계정과 DB → `.env`의 `matchmaking:matchmaking@…/matchmaking` 부분 |
| `-p 5432:5432` | 내 PC의 5432 → 컨테이너의 5432 → `.env`의 `localhost:5432` |
| `-v matchmaking-pgdata:…` | 데이터를 Docker 볼륨에 저장해서 컨테이너를 껐다 켜도 남게 해요 |
| `postgres:16` | 이미지. 처음 한 번은 내려받느라 시간이 조금 걸려요 |

- Windows 방화벽 허용 창이 뜨면 **허용**을 눌러요.

#### 5단계. 제대로 떴는지 확인

```powershell
docker ps
```

- 목록의 `matchmaking-db` 행에서 `STATUS`가 `Up …`이면 실행 중이에요. Docker Desktop의 **Containers** 탭에서도 초록색으로 보여요.

```powershell
docker logs matchmaking-db
```

- 마지막 부분에 `database system is ready to accept connections`가 보이면 접속할 준비가 된 거예요.

#### 6단계. 테스트용 DB 추가 (`TEST_DATABASE_URL`용)

```powershell
docker exec matchmaking-db createdb -U matchmaking matchmaking_test
```

#### 7단계. `.env` 값으로 실제 접속되는지 확인

```powershell
docker exec -it matchmaking-db psql -U matchmaking -d matchmaking -c "\l"
```

- DB 목록에 `matchmaking`과 `matchmaking_test`가 보이면 성공이에요.
- 아직 테이블은 없어요. 테이블은 나중에 앱이 처음 뜰 때 `create_all`이 만들어요.

#### 8단계. `.env` 준비와 앱 실행 (코드가 채워진 뒤)

`.env`가 아직 없으면 저장소 루트에서 만들어요. `.env.example`에 아래 세 값이 이미 들어 있어서 복사만 하면 돼요.

```powershell
Copy-Item .env.example .env
```

```
DATABASE_URL=postgresql+asyncpg://matchmaking:matchmaking@localhost:5432/matchmaking
JWT_SECRET_KEY=local-dev-jwt-secret-key-for-study-only-0001
SEED_USER_PASSWORD=seedpass1234
```

`config.py`, `database.py`, `main.py`가 구현되면 아래 순서로 실행해요.

```powershell
uv sync --frozen
```

```powershell
uv run uvicorn main:app --app-dir src --reload
```

- `.env`는 실행한 위치를 기준으로 읽어요. 그래서 꼭 **저장소 루트**에서 실행해야 해요(STK-10).

#### 평소에 쓰는 명령

| 상황 | 명령 |
|---|---|
| 작업 끝, DB 끄기 | `docker stop matchmaking-db` |
| 다음 날 다시 켜기 | `docker start matchmaking-db` (Docker Desktop을 먼저 켜야 해요) |
| 상태 보기 | `docker ps -a` |

Docker Desktop **Containers** 탭의 ▶/■ 버튼으로 켜고 꺼도 같아요.

**모델이 바뀌어서 DB를 새로 만들어야 할 때 (STK-13)**

`create_all`은 이미 있는 테이블을 고치지 않아요. 그래서 DB를 지우고 다시 만들어요.

```powershell
docker exec matchmaking-db psql -U matchmaking -d postgres -c "DROP DATABASE matchmaking WITH (FORCE);" -c "CREATE DATABASE matchmaking;"
```

**완전히 처음부터 다시 만들 때**

컨테이너와 데이터 볼륨을 함께 지워요. 그다음 4단계부터 다시 하면 돼요.

```powershell
docker rm -f matchmaking-db
```

```powershell
docker volume rm matchmaking-pgdata
```

#### 자주 막히는 점

1. **`.env`의 비밀번호를 나중에 바꿨더니 접속이 안 돼요.** `POSTGRES_*` 값은 볼륨이 **처음 만들어질 때 한 번만** 적용돼요. 컨테이너만 다시 만들어서는 안 바뀌어요. 위의 "완전히 처음부터"처럼 볼륨까지 지워야 해요.
2. **`port is already allocated` 또는 `bind: An attempt was made to access a socket…` 오류가 나요.** 5432를 이미 다른 프로그램이 쓰고 있어요. 3단계를 보세요.
3. **`Conflict. The container name "/matchmaking-db" is already in use` 오류가 나요.** 이미 만든 컨테이너가 있는 거예요. `docker start matchmaking-db`로 켜면 돼요.
4. **PC를 재부팅했더니 접속이 안 돼요.** Docker Desktop을 먼저 켜고 `docker start matchmaking-db`를 실행해요. Docker Desktop 설정 → General → **Start Docker Desktop when you sign in**을 켜 두면 편해요.
5. **Git Bash에서 실행했더니 볼륨 경로가 이상해지거나 `-it`에서 오류가 나요.** Git Bash가 `/`로 시작하는 경로를 Windows 경로로 바꾸는 문제예요. PowerShell에서 실행하는 게 가장 쉬워요. 꼭 Git Bash를 써야 하면 두 가지를 바꿔요.
   - 4단계 명령 앞에 `MSYS_NO_PATHCONV=1 `을 붙여요.
   - 7단계 명령 앞에 `winpty `를 붙여요.

## 테스트

```bash
uv run pytest
```
