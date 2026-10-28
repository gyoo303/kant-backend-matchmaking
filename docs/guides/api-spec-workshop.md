# API 명세서 함께 작성하기 — 워크북

> 2vs2 매치메이킹 · 기획(PM) 산출물만 보고 API 명세서를 처음부터 쓰는 실습
> 화면 왼쪽: 명세서 작성 도구 / 화면 오른쪽: 이 문서
> 먼저 하면 좋은 실습: `docs/guides/erd-workshop.md` (ERD)

---

## 0. 사용 방법

**준비물**
- 명세서 작성 도구 하나
  - 노션 표·데이터베이스 (팀 공유 쉬움)
  - 구글 스프레드시트 (행 = API 하나)
  - 마크다운 파일 (§1.3 카드 양식 복사)
- 근거 문서: `docs/01-pm/`
- 완성한 ERD (응답 필드를 정할 때 봐요)

**진행 방식**
1. 단계 1~6을 순서대로 진행해요.
2. 각 단계의 **❓ 질문**을 팀이 토론해요.
3. 결정을 명세서에 바로 적어요.
4. 막히면 **💡 힌트**를 열어요.
5. **✅ 단계 정리**는 그 단계를 끝낸 뒤 열어요.
6. 마지막에 §10 참고 답안과 비교해요.

**규칙**
- 정답은 하나가 아니에요.
- 근거는 번호로 말해요: `US-02`, `REQ-033`, `AC-02-3`
- 프론트엔드 담당이 "이 명세만 보고 화면을
  붙일 수 있는가?"가 좋은 명세의 기준이에요.

**시간 배분 (약 2시간 30분)**

| 단계 | 시간 |
|---|---|
| 1. 양식 이해 | 10분 |
| 2. 기능 목록 뽑기 | 20분 |
| 3. Path·Method 정하기 | 25분 |
| 4. 요청 상세 | 25분 |
| 5. 응답 상세 | 30분 |
| 6. 담당자·Version | 10분 |
| 7. 화면·AC로 검증 | 20분 |
| 정리·비교 | 10분 |

---

## 1. 명세서 양식 (10분)

### 1.1 필수 항목

| 항목 | 적을 내용 |
|---|---|
| API Path | 주소. 예: `/books/{book_id}` |
| HTTP Method | `GET`·`POST`·`PUT`·`PATCH`·`DELETE` |
| 요청 상세 | Header, Path·Query 매개변수, Body |
| 응답 상세 | 상태 코드, Header, Body (성공·오류) |
| 담당자 | 구현·관리 책임자 이름 |
| Version | 이 명세의 버전. 예: `0.1.0` |

추가로 **API-ID**와 **기능 요약**(한 줄)을
적으면 대화할 때 편해요. 예: `API-BOOK-02 도서 등록`

### 1.2 요청·응답 각 칸의 뜻

**요청 상세**

| 칸 | 뜻 | 예 |
|---|---|---|
| Header | 요청에 붙는 부가 정보 | `Authorization`, `Content-Type` |
| Path | 주소 안의 변수 | `{book_id}` |
| Query | `?` 뒤의 조건 | `?page=1&size=10` |
| Body | 보내는 데이터 | `{"title": "..."}` |

**응답 상세**

| 칸 | 뜻 | 예 |
|---|---|---|
| 상태 코드 | 결과 종류 | `200`, `400`, `404` |
| Header | 응답 부가 정보 | `Content-Type`, `WWW-Authenticate` |
| Body | 돌려주는 데이터 | `{"id": 1, ...}` |

> 💡 교안 연결
> - Path·Query: 3장 1강 (`Path`, `Query`)
> - Body 검증: 2장 1강 (`BaseModel`, `Field`)
> - 응답 필드 거르기: 2장 2강 (`response_model`)
> - 오류 응답: 3장 1강 (`HTTPException`, 전역 처리기)
> - Authorization 헤더: 6장 1강 (`OAuth2PasswordBearer`)

### 1.3 카드 양식 (API 하나당 하나 복사)

```markdown
### API-XXX-00 기능 이름

- 기능 요약:
- 근거: US-xx / AC-xx-n
- API Path:
- HTTP Method:
- 담당자:
- Version:

**요청**
- Header:
- Path:
- Query:
- Body:

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
|  |  |  |  |

**응답 — 성공**
- 상태 코드:
- Header:
- Body:

| 필드 | 타입 | 설명 |
|---|---|---|
|  |  |  |

**응답 — 오류**

| 코드 | 언제 | Body 예 |
|---|---|---|
|  |  |  |
```

### 1.4 작성 예시 (교안 1장 2강 도서 등록)

> 이 프로젝트가 아닌 교안 예제로 보여 줘요.
> 정답을 미리 보지 않기 위해서예요.

### API-BOOK-02 도서 등록

- 기능 요약: 새 도서를 서가에 등록한다
- API Path: `/books`
- HTTP Method: `POST`
- 담당자: 홍길동
- Version: `0.1.0`

**요청**
- Header: `Content-Type: application/json`
- Path: 없음 / Query: 없음
- Body:

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| title | string | Y | 공백만은 안 됨 |
| author | string | Y | 공백만은 안 됨 |

**응답 — 성공**
- 상태 코드: `201 Created`
- Header: `Content-Type: application/json`
- Body:

| 필드 | 타입 | 설명 |
|---|---|---|
| id | int | 도서 번호 |
| title | string | 제목 |
| author | string | 저자 |
| status | string | `AVAILABLE` / `RENTED` |
| created_at | string | 등록 시각(ISO 8601) |

**응답 — 오류**

| 코드 | 언제 | Body 예 |
|---|---|---|
| 400 | 제목·저자가 공백 | `{"detail": "도서의 제목은 공백일 수 없습니다."}` |

---

## 2. 단계 1 — 기능 목록 뽑기 (20분)

API는 **사용자 스토리의 동사**에서 나와요.
`docs/01-pm/05-user-stories.md`를 펴 두세요.

**필수 스토리 (US-01 ~ US-14)**

| US | 한 줄 |
|---|---|
| 01 | 제목만 입력해 방 만들기 |
| 02 | 빈자리 있는 방에 참가 |
| 03 | (방장) 방 제목 바꾸기 |
| 04 | 내 팀 바꾸기 |
| 05 | 방 나가기 |
| 06 | (방장) 게임 시작 |
| 07 | 방 상세와 내가 참가 중인 방 보기 |
| 08 | 아이디·닉네임·비밀번호로 가입 |
| 09 | 로그인해 토큰 받기 |
| 10 | 로그아웃하면 토큰 못 쓰게 |
| 11 | 로그인 안 한 요청 막기 |
| 12 | 방 목록 검색·필터·정렬·페이지 |
| 13 | 내 이용 이력 보기 |
| 14 | 삭제된 방의 보관 정보 보기 |

US-15~17은 화면 스토리예요. 화면이 부르는 API는
위 목록에서 나와요. US-18~20은 도전 과제예요.

**❓ 질문 1-1**
스토리마다 필요한 **API 개수**를 적어 봐요.
(스토리 하나에 API가 둘일 수도, 0개일 수도 있어요.)

<details>
<summary>💡 힌트</summary>

- US-07은 "방 상세"와 "내가 참가 중인 방" 두 가지예요.
- US-11은 새 API가 아니라 **모든 API의 공통 규칙**이에요.
- US-09 로그인 뒤 화면 머리글에 닉네임을 보여 주려면?
  (내 정보 조회)
- 교안 6장 1강은 로그인·로그아웃 말고
  **토큰 재발급(`/refresh`)**도 만들어요.

</details>

<details>
<summary>✅ 단계 1 정리</summary>

| US | API |
|---|---|
| 01 | 방 생성 |
| 02 | 방 참가 |
| 03 | 제목 변경 |
| 04 | 팀 변경 |
| 05 | 나가기 |
| 06 | 게임 시작 |
| 07 | 방 상세, 내 현재 방 |
| 08 | 회원가입 |
| 09 | 로그인, 토큰 재발급, 내 정보 |
| 10 | 로그아웃 |
| 11 | (공통 규칙) |
| 12 | 방 목록 |
| 13 | 내 이용 이력 |
| 14 | 보관 정보 |

모두 **16개**예요(인증 5 + 방 11).

</details>

---

## 3. 단계 2 — Path·Method 정하기 (25분)

### 3.1 메서드 고르는 법 (교안 1장 2강)

| Method | 쓰임 | 같은 요청 반복 시 |
|---|---|---|
| GET | 조회 | 결과 같음 (안전·멱등) |
| POST | 생성, 행동 | 매번 새로 생길 수 있음 |
| PUT | 전체 교체 | 결과 같음 (멱등) |
| PATCH | 일부 수정 | 대개 같음 |
| DELETE | 삭제·해제 | 결과 같음 (멱등) |

### 3.2 Path 짓는 법

- 명사, 복수형: `/rooms` (O) `/getRooms` (X)
- 하나를 가리키면 id: `/rooms/{room_id}`
- 속한 것은 아래로: `/rooms/{room_id}/participants`
- "나"를 가리키면 `me`: `/me/...`
- 소문자, 단어 사이는 `-`: `/room-history`

**❓ 질문 2-1**
화면 주소(`/rooms/3` 화면)와 API 주소가
겹치면 어떻게 구분할까?

<details>
<summary>💡 힌트</summary>

- 방법 A: API 앞에 공통 접두사를 붙임 (`/api/...`)
- 방법 B: 화면 앞에 접두사를 붙임 (`/web/...`)
- 사용자가 브라우저에 직접 치는 주소는 어느 쪽?

</details>

**❓ 질문 2-2**
아래 "행동"의 Method와 Path를 정해 봐요.

| 행동 | Method | Path |
|---|---|---|
| 방 목록 | | |
| 방 생성 | | |
| 방 상세 | | |
| 제목 변경 | | |
| 참가 | | |
| 내 팀 변경 | | |
| 나가기 | | |
| 게임 시작 | | |
| 내 현재 방 | | |
| 내 이용 이력 | | |
| 보관 정보 | | |

<details>
<summary>💡 힌트</summary>

- 참가 = "참가 기록을 **생성**" → POST?
- 나가기 = "내 참가를 **해제**" → DELETE?
  (행을 지우진 않지만 기능 관점은 해제, REQ-067)
- 팀 변경 = 내 참가의 **일부 수정** → PATCH?
- 게임 시작은 생성·수정·삭제 어디에도 딱 맞지
  않는 **행동**이에요. 이럴 땐 POST + 동사 경로를
  쓰기도 해요.

</details>

**❓ 질문 2-3**
로그인은 `POST /login`? `POST /token`?
교안 6장 1강의 `OAuth2PasswordRequestForm`과
Swagger Authorize 버튼이 어떤 주소를 쓰는지 봐요.

<details>
<summary>✅ 단계 2 정리</summary>

- API는 `/api` 접두사, 화면은 접두사 없음 (D-017)
- 인증은 `/api/auth/...`로 묶음

| 행동 | Method | Path |
|---|---|---|
| 방 목록 | GET | `/api/rooms` |
| 방 생성 | POST | `/api/rooms` |
| 방 상세 | GET | `/api/rooms/{room_id}` |
| 제목 변경 | PATCH | `/api/rooms/{room_id}` |
| 참가 | POST | `/api/rooms/{room_id}/participants` |
| 내 팀 변경 | PATCH | `/api/rooms/{room_id}/participants/me` |
| 나가기 | DELETE | `/api/rooms/{room_id}/participants/me` |
| 게임 시작 | POST | `/api/rooms/{room_id}/start` |
| 내 현재 방 | GET | `/api/me/room` |
| 내 이용 이력 | GET | `/api/me/room-history` |
| 보관 정보 | GET | `/api/me/room-history/{room_id}` |

로그인은 `POST /api/auth/token` (OAuth2 관례)

</details>

---

## 4. 단계 3 — 요청 상세 (25분)

### 4.1 Header

**❓ 질문 3-1**
아래 API 중 `Authorization` 헤더가
**필요 없는** 것은? (REQ-010)

- 회원가입 / 로그인 / 토큰 재발급
- 방 목록 / 방 생성 / 내 이용 이력

**❓ 질문 3-2**
로그인 요청의 `Content-Type`은?
JSON? 폼(`application/x-www-form-urlencoded`)?

<details>
<summary>💡 힌트</summary>

- 교안 6장 1강 실습의 로그인 curl을 다시 봐요:
  `-d "username=...&password=..."`
- `OAuth2PasswordRequestForm`의 필드 이름은
  `username`이에요. 우리 서비스의 "아이디"를
  여기에 넣어요.

</details>

### 4.2 Path·Query

**❓ 질문 3-3**
방 목록(US-12)의 Query를 정해 봐요.

| 이름 | 타입 | 기본값 | 제약 | 근거 |
|---|---|---|---|---|
| | | | | REQ-080 검색 |
| | | | | REQ-081 빈자리만 |
| | | | | REQ-082 정렬 |
| | | | | REQ-083 페이지 |
| | | | | REQ-083 크기 |

<details>
<summary>💡 힌트</summary>

- 검색어는 비어도 돼요 (`None`)
- 정렬은 값이 두 개뿐 → `Literal`
- 크기 최대 50 (REQ-083) → `le=50`
- 범위를 넘으면 상태 코드는? (REQ-062)

</details>

### 4.3 Body

**❓ 질문 3-4**
회원가입 Body 필드와 제약을 적어 봐요.
(Q-04: 아이디 4~20자 영문 소문자·숫자,
닉네임 2~12자, 비밀번호 8자 이상)

**❓ 질문 3-5**
형식 규칙(4~20자 등)을 **스키마**에서 검사하면 422,
**도메인**에서 검사하면 400이에요.
AC-08-2는 "아이디 `Ab` → 400"을 요구해요.
어디서 검사해야 할까?

**❓ 질문 3-6**
방 생성 Body에 `capacity`(정원)를 받을까?
(REQ-024, AC-01-4)

<details>
<summary>✅ 단계 3 정리</summary>

**Header**
- 인증 필요 API: `Authorization: Bearer <access_token>`
- 필요 없음: 회원가입, 로그인, 토큰 재발급
- 로그인: `application/x-www-form-urlencoded`
- 나머지 Body: `application/json`

**방 목록 Query**

| 이름 | 타입 | 기본 | 제약 |
|---|---|---|---|
| keyword | str | 없음 | 최대 50자 |
| available_only | bool | false | |
| sort | newest / oldest | newest | |
| page | int | 1 | 1 이상 |
| size | int | 10 | 1~50 |

범위 밖 → 422

**회원가입 Body**: `login_id`, `nickname`, `password`
- 스키마는 최대 길이만(비정상 입력 방어, 422)
- 형식 규칙은 도메인이 검사 → 400 (AC-08-2~4)

**방 생성 Body**: `title` 하나.
정원 등 다른 필드는 받지 않고 무시 (AC-01-4)

</details>

---

## 5. 단계 4 — 응답 상세 (30분)

### 5.1 상태 코드 정하기

**❓ 질문 4-1**
성공 응답은 생성이면 `201`, 나머지는 `200`?
아니면 모두 `200`? (발제 시연 표기: "정상 200")

**❓ 질문 4-2**
아래 상황의 코드를 정해 봐요.

| 상황 | 코드 |
|---|---|
| 토큰 없음·만료·로그아웃한 토큰 | |
| 없는 방 | |
| 정원 마감, 제목 규칙 위반 | |
| 방장이 아닌데 게임 시작 | |
| 게임 시작으로 해산된 방 상세 | |
| Query `size=100` | |
| 서버 내부 오류 | |

<details>
<summary>💡 힌트</summary>

- REQ-060: 인증 실패 → 401
- REQ-061: 없는 방 → 404
- REQ-062: 잘못된 목록 입력 → 422
- 방장 아님: 403(권한 없음)? 400(규칙 위반)?
  PM 수용기준(AC-03-2, AC-06-3)을 확인해요.
- REQ-094: "해산"과 "없음"을 **구분**하는 응답이
  필요해요. 폴링하던 화면이 "해산됐구나"를
  알아야 하니까요.

</details>

### 5.2 오류 Body 형식

**❓ 질문 4-3**
오류 응답 Body를 **모든 API가 같은 모양**으로
하려면 어떤 모양이 좋을까?

- A: `{"detail": "정원이 마감되었습니다"}`
- B: `{"success": false, "error": "..."}` (교안 2장 2강)
- C: API마다 자유롭게

<details>
<summary>💡 힌트</summary>

- FastAPI 기본 `HTTPException`이 내는 모양은?
- 422(입력 검증 실패)는 FastAPI가 자동으로 만들어요.
  기본 모양은 목록 형태예요. 화면 JS가 다루기
  쉽게 문자열 하나로 바꿀까요?

</details>

### 5.3 성공 Body 필드

**❓ 질문 4-4**
방 상세 응답에 넣을 필드를 정해 봐요.
`07-screens.md` SCR-04 "필수 표시 요소"를 봐요.

<details>
<summary>💡 힌트</summary>

- 제목, 현재 인원, 정원, 방장
- 참가자: 닉네임, 팀, 방장 여부
- 화면이 "내 팀"·"내가 방장인지"를 알아야
  버튼을 보여 줄 수 있어요.
- **넣으면 안 되는 것**: 입장 순서(REQ-045),
  비밀번호 해시(INV-13)

</details>

**❓ 질문 4-5**
목록·이력처럼 페이지가 있는 응답은
Body를 어떻게 감쌀까? (REQ-084 전체 건수)

**❓ 질문 4-6**
로그인 성공 Body에는 무엇이 들어갈까?
(교안 6장 1강 `Token` 스키마)

**❓ 질문 4-7**
401 응답 Header에 붙는 것은?
(교안 6장 1강 `credentials_exception`)

<details>
<summary>✅ 단계 4 정리</summary>

**상태 코드**
- 성공은 모두 200 (D-013)

| 상황 | 코드 |
|---|---|
| 인증 실패 | 401 |
| 없는 방 | 404 |
| 규칙 위반 | 400 |
| 방장 아님 | 400 (403 안 씀, D-015) |
| 해산된 방 상세 | 410 Gone (D-016) |
| 입력 범위 밖 | 422 |
| 서버 오류 | 500 (내부 정보 숨김) |

**오류 Body**: A `{"detail": "문자열"}` 하나로 통일.
422도 `"size: ...; page: ..."` 문자열로 바꿈

**401 Header**: `WWW-Authenticate: Bearer`

**페이지 응답**:
`{"items": [...], "total": 23, "page": 1, "size": 10}`

**로그인 응답**:
`{"access_token", "refresh_token", "token_type": "bearer"}`

**방 상세 응답**: id, title, capacity,
current_count, is_full, host_user_id,
participants[{user_id, nickname, team, is_host}],
my_team, am_i_host, created_at

</details>

---

## 6. 단계 5 — 담당자·Version (10분)

### 6.1 담당자

**❓ 질문 5-1**
API 담당자는 어떤 기준으로 정할까?

- A: 기능 묶음별 (인증 = 한 명, 방 변경 = 한 명 …)
- B: API 하나씩 돌아가며
- C: 라우터 파일 담당자 한 명이 전부

<details>
<summary>💡 힌트</summary>

- 담당자는 "명세가 바뀌면 누구에게 물어보나"의 답이에요.
- 분담표(`docs/guides/work-assignment.md`)의
  역할 A~E를 참고해요.

</details>

### 6.2 Version

**❓ 질문 5-2**
Version은 무엇의 버전일까?

- A: **명세 문서**의 버전 (`0.1.0` → `1.0.0`)
- B: **API 주소**의 버전 (`/api/v1/rooms`)
- C: 둘 다

**❓ 질문 5-3**
언제 버전을 올릴까? 아래 규칙을 팀이 정해요.

| 바뀐 내용 | 올릴 자리 |
|---|---|
| 오타·설명만 수정 | |
| 응답에 선택 필드 추가 | |
| 필드 이름 변경·삭제, 경로 변경 | |

<details>
<summary>✅ 단계 5 정리 (예시)</summary>

- 담당자: A(기능 묶음별). 구현자와 같게 두면
  질문할 사람이 분명해져요.
- Version: A(명세 문서 버전).
  이번 프로젝트는 외부 사용자가 없어
  주소에 `v1`을 넣지 않았어요.

| 바뀐 내용 | 올릴 자리 |
|---|---|
| 오타·설명만 | `0.1.0` → `0.1.1` |
| 선택 필드 추가 | `0.1.0` → `0.2.0` |
| 이름 변경·삭제 | `0.x` → `1.0.0` (화면 담당과 합의 필수) |

- 팀 리뷰를 마치고 확정하면 `1.0.0`

</details>

---

## 7. 단계 6 — 화면·AC로 검증 (20분)

### 7.1 화면마다 API가 다 있나

| 화면 | 화면에서 하는 일 | API 있음? |
|---|---|---|
| SCR-01 회원가입 | 가입 | [ ] |
| SCR-02 로그인 | 로그인 | [ ] |
| SCR-03 목록 | 목록·검색 | [ ] |
| | 방 만들기 | [ ] |
| | 참가 | [ ] |
| | 내 현재 방 링크 | [ ] |
| | 머리글 닉네임 | [ ] |
| SCR-04 상세 | 1초마다 상세 | [ ] |
| | 팀 이동·나가기 | [ ] |
| | 제목 변경·게임 시작 | [ ] |
| SCR-05 내 기록 | 이력 페이지 | [ ] |
| SCR-06 보관 | 보관 정보 | [ ] |
| 공통 | 로그아웃 | [ ] |

### 7.2 수용기준과 맞나

명세서만 보고 아래 AC의 **응답 코드와 Body**를
말할 수 있으면 통과예요.

- [ ] AC-01-4 정원 필드를 보내도 무시
- [ ] AC-02-3 정원 마감 → 400, 4명 유지
- [ ] AC-02-7 같은 방 다시 참가 → 200 (D-006)
- [ ] AC-07-4·5 해산 방 410 / 없는 방 404
- [ ] AC-08-1 가입 응답에 비밀번호·해시 없음
- [ ] AC-09-2 틀린 비밀번호·없는 아이디 → 같은 401 문구
- [ ] AC-10-2 로그아웃한 토큰 → 401
- [ ] AC-12-x 목록 Query 조합
- [ ] AC-13-1·4 이력 최신순, 크기 51 → 422 (기본값은 D-007)

### 7.3 프론트엔드 입장에서 읽기

한 명이 FE 담당이 되어 명세만 보고 질문해요.

- [ ] 이 버튼을 누르면 어떤 API를 부르지?
- [ ] 성공하면 화면에 무엇을 다시 그리지?
- [ ] 실패하면 어떤 문구를 보여 주지?
- [ ] 로그인이 만료되면 어떻게 알지?

---

## 8. 자주 하는 실수 체크

- [ ] Path에 동사 사용 (`/createRoom`)
- [ ] 조회를 POST로, 생성을 GET으로
- [ ] 응답에 비밀번호 해시 포함 (INV-13)
- [ ] 응답에 입장 순서 포함 (REQ-045)
- [ ] API마다 오류 Body 모양이 다름
- [ ] 401과 403을 섞어 씀
- [ ] 해산(410)과 없음(404)을 구분 안 함 (REQ-094)
- [ ] 목록 응답에 전체 건수 없음 (REQ-084)
- [ ] Query 기본값·최대값을 안 적음
- [ ] 로그인 Content-Type을 JSON으로 적음
- [ ] 담당자·Version 칸을 비워 둠

---

## 9. 마무리 토론 (선택)

- 우리 명세에서 가장 많이 토론한 API는?
  그 이유를 결정 기록으로 남겨요.
- ERD 워크북에서 정한 테이블과 응답 필드가
  어떻게 다른가요? (예: 현재 인원은 테이블에
  없지만 응답에는 있어요.)

---

## 10. 참고 답안 (실제 프로젝트 명세)

> 팀이 먼저 끝까지 작성한 뒤에 열어요.
> 이 프로젝트 ARCH 단계가 확정한 명세예요
> (`docs/02-arch/04-interfaces-api.md` §4·§5).
> 담당자는 `work-assignment.md`의 역할을 따랐어요.

<details>
<summary>📋 전체 API 목록 (16개)</summary>

**인증** — 담당 A · Version `1.0.0`

| ID | Method | Path | 인증 |
|---|---|---|---|
| AUTH-01 | POST | `/api/auth/signup` | 없음 |
| AUTH-02 | POST | `/api/auth/token` | 없음 (form) |
| AUTH-03 | POST | `/api/auth/logout` | Bearer |
| AUTH-04 | GET | `/api/auth/me` | Bearer |
| AUTH-05 | POST | `/api/auth/refresh` | 없음 (body) |

**방** — 담당 D(라우터) · Version `1.0.0`

| ID | Method | Path |
|---|---|---|
| ROOM-01 | GET | `/api/rooms` |
| ROOM-02 | POST | `/api/rooms` |
| ROOM-03 | GET | `/api/rooms/{room_id}` |
| ROOM-04 | PATCH | `/api/rooms/{room_id}` |
| ROOM-05 | POST | `/api/rooms/{room_id}/participants` |
| ROOM-06 | PATCH | `/api/rooms/{room_id}/participants/me` |
| ROOM-07 | DELETE | `/api/rooms/{room_id}/participants/me` |
| ROOM-08 | POST | `/api/rooms/{room_id}/start` |
| ROOM-09 | GET | `/api/me/room` |
| ROOM-10 | GET | `/api/me/room-history` |
| ROOM-11 | GET | `/api/me/room-history/{room_id}` |

방 API는 모두 Bearer 인증이 필요해요.
(도전 B의 CSV 다운로드 ROOM-12는 제외)

</details>

<details>
<summary>📋 카드 예시 1 — 로그인 (API-AUTH-02)</summary>

### API-AUTH-02 로그인(OAuth2 토큰 발급)

- 기능 요약: 아이디·비밀번호로 access·refresh 토큰을 받는다
- 근거: US-09 / AC-09-1·2
- API Path: `/api/auth/token`
- HTTP Method: `POST`
- 담당자: A
- Version: `1.0.0`

**요청**
- Header: `Content-Type: application/x-www-form-urlencoded`
- Path: 없음 / Query: 없음
- Body (form):

| 필드 | 타입 | 필수 | 제약·설명 |
|---|---|---|---|
| username | string | Y | 아이디 |
| password | string | Y | 비밀번호 |

**응답 — 성공**
- 상태 코드: `200`
- Header: `Content-Type: application/json`
- Body:

| 필드 | 타입 | 설명 |
|---|---|---|
| access_token | string | 30분 유효 |
| refresh_token | string | 7일 유효 |
| token_type | string | `bearer` |

**응답 — 오류**

| 코드 | 언제 | Body 예 |
|---|---|---|
| 401 | 없는 아이디·틀린 비밀번호 | `{"detail": "아이디 또는 비밀번호가 올바르지 않습니다"}` |
| 422 | 필드 누락 | `{"detail": "password: Field required"}` |

401 응답 Header: `WWW-Authenticate: Bearer`

</details>

<details>
<summary>📋 카드 예시 2 — 방 참가 (API-ROOM-05)</summary>

### API-ROOM-05 방 참가

- 기능 요약: 빈자리가 있는 방에 참가한다
- 근거: US-02 / AC-02-1~8
- API Path: `/api/rooms/{room_id}/participants`
- HTTP Method: `POST`
- 담당자: D
- Version: `1.0.0`

**요청**
- Header: `Authorization: Bearer <access_token>`
- Path: `room_id` (int)
- Query: 없음
- Body: 없음 (참가자는 토큰의 회원)

**응답 — 성공**
- 상태 코드: `200`
- Header: `Content-Type: application/json`
- Body: 방 상세 (`RoomDetailResponse`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | int | 방 ID |
| title | string | 제목 |
| capacity | int | 정원(4) |
| current_count | int | 현재 인원 |
| is_full | bool | 정원 마감 여부 |
| host_user_id | int | 방장 회원 ID |
| participants | list | `{user_id, nickname, team, is_host}` A팀 먼저 |
| my_team | string \| null | 내 팀 |
| am_i_host | bool | 내가 방장인지 |
| created_at | string | 생성 시각 |

같은 방에 다시 참가 요청하면 기록 추가 없이 200 (D-006)

**응답 — 오류**

| 코드 | 언제 | Body 예 |
|---|---|---|
| 400 | 정원 마감 | `{"detail": "정원이 마감되었습니다"}` |
| 400 | 다른 방 참가 중 | `{"detail": "이미 다른 방에 참가 중입니다"}` |
| 400 | 삭제된 방 | `{"detail": "이미 삭제된 방입니다"}` |
| 401 | 토큰 문제 | `{"detail": "인증 토큰이 올바르지 않거나 로그인이 만료되었습니다"}` |
| 404 | 없는 방 | `{"detail": "방을 찾을 수 없습니다"}` |

</details>

---

## 11. 근거 문서

| 문서 | 볼 곳 |
|---|---|
| `docs/01-pm/05-user-stories.md` | 스토리·거부 시나리오 |
| `docs/01-pm/06-acceptance-criteria.md` | 응답 코드 기대값 |
| `docs/01-pm/07-screens.md` | 화면별 표시 요소·동작 |
| `docs/01-pm/01-requirements-inventory.md` | REQ-060~064 오류, 079~087 목록 |
| `docs/01-pm/decision-log.md` | D-006·007·013·015·016·017 |
| `docs/02-arch/04-interfaces-api.md` | 실제 명세 (답안) |
