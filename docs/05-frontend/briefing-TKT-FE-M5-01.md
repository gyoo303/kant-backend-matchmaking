---
stage: FE
tickets: [TKT-FE-M5-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-SCR, PM-AC, AR-API, AR-CONV, AR-GATE, BE-BRIEF]
next_readers: [QA]
---
## [공통] 레이아웃·스타일 토큰·api.js·polling.js (TKT-FE-M5-01)
결론: 완료 조건 2개 중 2개 충족 · 실제 API 기준(SQLite 임시 DB로 확인, PostgreSQL 미확인)

### 사람이 결정할 것
- 없음. 화면 동작 미정 항목 5개는 사용자 확인을 받았다(아래 "기록 필요"). 이후 FE 티켓이 이 결정을 따른다.

### 이해 가이드
- 데이터 흐름: 서버는 템플릿 틀과 URL 값만 준다(D-021) → 페이지가 열리면 `api.js`가 `data-require-login`을 보고 토큰이 없으면 `/login`으로 보낸다 → `initHeader()`가 `GET /api/auth/me`로 머리글 닉네임을 채운다 → 각 화면 스크립트는 `apiRequest()`로 API를 부르고, 1초 갱신이 필요하면 `startPolling()`을 쓴다 → 오류 문구는 `errorMessage()`로 꺼내 `showNotice()`로 안내 영역에 쓴다.
- 토큰: access·refresh 토큰을 `localStorage`에 둔다. `apiRequest()`가 401을 받으면 refresh 토큰으로 한 번 재발급하고 다시 보낸다. 그래도 401이면 토큰을 지우고 `/login?expired=1`로 보낸다.
- 먼저 읽을 파일 3곳:
  - `src/static/js/api.js` — API 호출(`apiRequest`·`loginWithPassword`·`logout`)과 화면 공통 도우미(`showNotice`·`formatTime`·`renderPagination`·`initHeader`)
  - `src/static/js/polling.js` — `startPolling(fetchFn)`: 1초 간격, 겹침 없음, 숨김 시 멈춤, 늦은 응답 버림
  - `src/templates/base.html` — 머리글·안내 영역·본문·바닥글, `require_login`·`content`·`scripts` 블록

### 다음 FE 티켓이 쓸 것
- 화면 템플릿은 `{% extends "base.html" %}`. 로그인 없이 여는 화면(회원가입·로그인)은 `{% block require_login %}false{% endblock %}`.
- 서버가 준 `notice`는 `partials/notice.html`이 자동으로 보인다. JS 문구는 `showNotice(문구, "error" | "success")`.
- 페이지 이동은 `{% include "partials/pagination.html" %}` 후 `renderPagination(document.getElementById("pagination"), page, size, total, function (p) { return 주소; })`.
- 사용자 입력 문자열(방 제목·닉네임)은 반드시 `textContent`로 넣는다.
- 짧은 칸(인원·시각)에는 `class="nowrap"`.

### 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| 완료 조건 | 탭 숨김 시 요청 0건 | 충족 | 브라우저 테스트 페이지(작업 폴더)에서 `document.hidden`을 바꿔 `visibilitychange` 발생 → 숨김 3.2초 동안 조회 0건, 다시 보이면 즉시 1건(0ms) |
| 완료 조건 | 겹침 요청 0건 | 충족 | 조회 하나가 1.5초 걸리게 해도 동시 진행 최대 1건 |
| AC-15-5 (공통 부분) | 조회 간격 1초(±0.5초), 동시 진행 최대 1건 | 충족 | 간격 1081·1013·1002·909ms, 동시 최대 1건. 목록 화면 연결은 TKT-FE-M5-03 |
| AC-15-6 (공통 부분) | 숨김 0건, 복귀 1초 안 조회 | 충족 | 위 완료 조건과 같음 |
| AC-11-3 (공통 부분) | 비로그인으로 로그인 필요 화면 → 로그인 화면 | 충족 | 토큰 없이 `require_login=true` 임시 화면 접속 → `/login`으로 이동 |
| AC-16-6 (공통 부분) | 401이면 로그인 화면 안내 | 충족 | access·refresh 모두 망가진 토큰 → 재발급 실패 → 토큰 삭제 후 `/login?expired=1` |

### 구현 중 자율 결정

#### 스타일 토큰 값 (D-019)
- 결정: 회색 바탕 + 파란 주요 색(`--color-primary: #1f5fbf`), 안내 파랑·위험 빨강·성공 초록, A팀 연파랑·B팀 연분홍, 간격 4·8·16·24px, 모서리 6px, 시스템 글꼴(맑은 고딕·Apple SD Gothic Neo 포함), 글자 14·16·20px — `05-structure-conventions.md` §6, D-019
- 선택지: **A. 중립 회색 + 파란 강조 (권장·채택)** / B. 팀 색을 주요 색으로 쓰는 강한 색 조합
- 권장 이유: 모든 글자·배경 조합의 대비가 4.5:1 이상(최저 5.08)이고, 팀 색은 영역 구분에만 써서 상태 색(오류·성공)과 섞이지 않는다.
- trade-off: A — 시각적으로 밋밋하다(값만 바꾸면 전체가 바뀐다). B — 화면이 눈에 띄지만 상태 색과 헷갈리고 대비 맞추기가 어렵다.

#### 화면 공통 도우미를 api.js에 둠
- 결정: `showNotice`·`formatTime`·`renderPagination`·`initHeader`를 `api.js`에 둔다 — HANDOFF TKT-FE-M5-01 산출(정적 JS는 `api.js`·`polling.js`뿐), TKT-FE-M5-05 산출에 JS 파일이 없음
- 선택지: **A. api.js에 함께 둠 (권장·채택)** / B. `ui.js` 파일을 새로 만듦
- 권장 이유: 산출 목록에 없는 파일을 만들지 않고, 내 기록 화면(M5-05)처럼 자기 JS 파일이 없는 화면도 같은 도우미를 쓸 수 있다.
- trade-off: A — `api.js`가 API 호출과 화면 도우미를 함께 맡아 조금 길다(주석으로 구분). B — 역할은 깔끔하지만 산출 목록 밖 파일이 생긴다.

#### 폴링의 늦은 응답 처리 방식
- 결정: `startPolling`은 `fetchFn(isCurrent)`를 부르고, 화면 코드가 응답을 받은 뒤 `isCurrent()`가 거짓이면 그 응답을 버린다 — SEQ-13(seq로 조건 변경 전 응답 버림)
- 선택지: **A. isCurrent 콜백 (권장·채택)** / B. `AbortController`로 이전 요청 취소
- 권장 이유: 교안 수준 JS(D-020)로 충분하고, 검색 조건은 사용자 확인 ③에 따라 페이지를 새로 읽어 바뀌므로 실제로 버릴 일은 주로 `stop()` 뒤 도착한 응답이다.
- trade-off: A — 버린 요청도 끝까지 받는다. B — 요청을 실제로 끊지만 코드가 길어지고 교안 밖이다.

#### 레이아웃 고정 값
- 결정: 테두리 1px, 본문 최대 폭 960px, 팀 칸 최소 폭 240px는 토큰 없이 CSS에 직접 쓴다 — §6(토큰 목록에 테두리 두께·레이아웃 폭 없음)
- 선택지: **A. 직접 값 (권장·채택)** / B. 토큰을 추가
- 권장 이유: 색·간격·글꼴처럼 바꿔 쓸 값이 아니라 레이아웃 고정값이고, §6 토큰 표를 늘리지 않는다.
- trade-off: A — 폭을 바꾸려면 CSS를 찾아 고쳐야 한다. B — 토큰 표가 늘어난다.

### 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 토큰이 `localStorage`에 있어 XSS가 생기면 탈취될 수 있다 | 사용자 입력은 `textContent`로만 넣는 규칙을 `api.js` 머리 주석·브리핑에 명시, `innerHTML` 사용 0건 | 다음 FE 티켓도 같은 규칙을 지켜야 함(QA 점검 항목) |
| 같은 초 재로그인 시 차단된 토큰을 받는 알려진 제한(BE 브리핑) | 해당 없음(로그인 화면은 M5-02) | 시연 때 로그아웃 직후 바로 로그인하지 않기 |
| 여러 조회가 동시에 401을 받으면 재발급 요청이 여러 번 나갈 수 있다 | 화면당 폴링은 겹치지 않아 동시 401은 드묾 | 실사용 영향 낮음 |

### 검증 결과
- 게이트: `uv run ruff check src` 통과, `uv run pytest -q` 63 passed / 63 skipped, `node --check`로 `api.js`·`polling.js` 문법 오류 0
- 브라우저 확인(앱 내장 브라우저, 작업 폴더의 임시 서버: 실제 `main.app` + SQLite 임시 DB + `base.html`을 상속한 임시 화면·폴링 테스트 페이지, 저장소 밖)
  - 서버: 정적 파일 3개 200, 시드 로그 `seed inserted: … total=42` 1회
  - 폴링: 위 수용 기준 표, `stop()` 뒤 도착한 응답 `isCurrent()` = false
  - 머리글: 토큰 없음 → [로그인]·[회원가입], 로그인 후 → "시드유저01"·[내 기록]·[로그아웃]
  - `api.js`: 로그인 실패 401 문구 / 로그인 성공 시 두 토큰 저장 / 망가진 access → 자동 재발급 후 성공 / 규칙 위반 400 문구 추출("이미 다른 방에 참가 중입니다") / 통신 실패 status 0 + "최신 정보를 불러오지 못했습니다" / 두 토큰 모두 망가짐 → 토큰 삭제·`/login?expired=1` / 로그아웃 → 토큰 삭제·`/login` 이동, 이전 access 토큰으로 `/api/auth/me` 401
  - 도우미: `formatTime("2026-10-28T05:02:00Z")` → "10-28 14:02"(KST), `renderPagination(2/10/35)` → "이전 2 / 4 다음"과 링크 `/?page=1`·`/?page=3`, 서버 `notice`가 안내 영역에 표시
  - 반응형: 1280px·375px 화면 확인, 375px에서 가로 넘침 없음(scrollWidth 375). 좁은 표 칸 줄바꿈은 `.nowrap`으로 해결
  - 스타일: `:root` 밖 색 값 0, 템플릿 인라인 스타일 0, 색 대비 최저 5.08:1
- 스크린샷: 브라우저 확인 중 1280px·375px로 찍었으나 저장소에는 저장하지 않았다(임시 화면이라 실제 화면이 아님)
- audit: 해당 없음(새 의존성 없음)

### 명세와 다르게 한 것
- 없음

### 기록 필요
- 사용자 확인(2026-10-28), 이후 FE 티켓에 적용:
  - ① 목록에서 [참가] 성공 → 그 방 상세(`/rooms/{id}`)로 이동
  - ② 상세에서 [나가기] 성공 → 공개 방 목록(`/`)으로 이동
  - ③ 검색·필터·정렬은 폼 GET 제출로 새로 읽기(`/?keyword=…&page=1`), 페이지 이동은 링크
  - ④ 방장 제목 변경은 상세 화면 제목 옆 입력칸 + [변경] 버튼
  - ⑤ 시각 표시는 브라우저 시간대 `MM-DD HH:mm`
- UX 단계를 쓰지 않으므로(AGENTS.md 규칙 8) 위 결정은 이 브리핑에만 남긴다. PM 화면 명세(`07-screens.md`)에 옮길지는 PM이 정한다.

### 변경 범위
- 새 파일: `src/static/css/app.css`, `src/static/js/api.js`, `src/static/js/polling.js`, `src/templates/base.html`, `src/templates/partials/notice.html`, `src/templates/partials/pagination.html`
- 새 의존성 없음. 다른 담당 영역 수정 없음

### 확인하지 못한 것
- PostgreSQL 위 동작(SQLite 임시 DB로만 확인)
- 실제 화면 템플릿 안에서의 동작(회원가입·로그인·목록·상세·기록 화면은 TKT-FE-M5-02~05)
- 실제 브라우저 탭 전환으로 숨김 처리(테스트 페이지에서 `document.hidden` 값을 바꿔 확인함)
