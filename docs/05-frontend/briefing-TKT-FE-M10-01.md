---
stage: FE
tickets: [TKT-FE-M10-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-SCR, PM-AC, PM-DEC, AR-API, AR-CONV, AR-GATE, FE-BRIEF]
next_readers: [QA]
---
## [방] 폴링 제거·수동 새로고침 SCR-03·04 (TKT-FE-M10-01)
결론: 수용 기준 10개 중 10개 충족 · 실제 API 기준(SQLite 임시 DB + 시간대 보정으로 확인, PostgreSQL 미확인)

### 사람이 결정할 것
- 없음

### 이해 가이드
- 데이터 흐름: 자동 조회는 없다(D-026, ADR-012). 화면마다 조회 함수 하나(`loadRoomList(cond)`, `loadRoomDetail()`)를 `setupRefreshButton()`에 넘기면, 돌려받은 `refresh()`가 [새로고침] 버튼을 막고 조회한 뒤 다시 켠다. 이 `refresh()`를 화면 진입 때 1회, 버튼 클릭 때 부른다.
- 상세 화면은 변경 요청(제목·팀 이동·참가·나가기·게임 시작)이 거부되면 `showChangeFailure()`가 사유를 보인 뒤 `refreshDetail()`로 한 번 더 조회한다. 해산된 방에 보낸 변경은 400이고 이어진 조회가 410이라 `handleDetailError()`가 `/?notice=dissolved`로 보낸다(SEQ-13).
- 조회 결과 처리(410·404·401·통신 실패)는 예전과 같은 `handleDetailError()`가 한다. 401은 `api.js`가 재발급을 시도하고 실패하면 `/login?expired=1`로 보낸다.
- 먼저 읽을 파일 3곳:
  - `src/static/js/rooms.js` — `setupRefreshButton`, `loadRoomList`·`initRoomListPage`, `loadRoomDetail`·`showChangeFailure`·`initRoomDetailPage`
  - `src/templates/rooms/detail.html` — 맨 위 [새로고침](`id="refresh-button"`), `polling.js` script 태그 삭제
  - `src/templates/rooms/list.html` — 같은 [새로고침], `polling.js` script 태그 삭제

### 수용 기준
| 번호 | 내용 | 충족 | 근거 (브라우저 확인, 작업 폴더 밖 임시 서버) |
|---|---|---|---|
| AC-15-2 | 해산 뒤 [새로고침]·재진입하면 현재 방 링크 사라짐 | 충족 | seed12가 참가한 방 7 해산 → 목록 재진입 시 `#current-room` hidden |
| AC-15-5 / NFR-08 | 10초 무조작 시 진입 1회 외 목록 조회 0건 | 충족 | `performance` 리소스 기록: 진입 때 API 3건(`/me`·`/rooms`·`/me/room`), 이후 10초 동안 추가 0건 |
| AC-15-6 | 다른 사람이 만든 방이 [새로고침]으로 보임 | 충족 | seed13이 API로 방 생성 → 1.5초 뒤에도 목록에 없음("전체 5개") → [새로고침] → 보임("전체 6개"), 요청은 `/api/rooms`·`/api/me/room` 2건 |
| AC-16-1 / NFR-08 | 다른 사람 참가가 [새로고침]으로 반영, 무조작 시 자동 조회 0건 | 충족 | 방 7에서 seed14가 API로 참가 → 3초 뒤에도 "2/4" → [새로고침] → "3/4", B팀에 "시드유저14" |
| AC-16-2 | 방장만 제목 변경·게임 시작 보임 | 충족(변경 없음) | 방장 seed08 화면에 제목 변경·게임 시작 보임, 참가자 seed12 화면엔 팀 이동·나가기만 |
| AC-16-3 | 방장 게임 시작 성공 → 목록 + 해산 안내 | 충족 | 방 5(2vs2) 방장 seed05가 [게임 시작] → `/?notice=dissolved`, "게임이 시작되어 방이 해산되었습니다" |
| AC-16-4 | 다른 참가자가 [새로고침]·버튼 클릭 때 해산 확인 → 목록 + 해산 안내 | 충족 | ① 버튼: 방 7 해산 뒤 seed12가 오래된 화면에서 [B팀으로 이동] → 400 문구 → 재조회 410 → `/?notice=dissolved` ② 새로고침: 방 4 해산 뒤 seed02가 [새로고침] → `/?notice=dissolved` |
| AC-16-5 | 통신 실패 → 마지막 정보 유지 + 안내, [새로고침]으로 재시도 | 충족 | `fetch`를 실패하게 바꾸고 [새로고침] → 팀 칸 유지, "최신 정보를 불러오지 못했습니다", 버튼 다시 활성. 되돌리고 [새로고침] → 안내 사라짐 |
| AC-16-6 | 401(재발급도 실패) → 로그인 안내 | 충족 | 두 토큰을 망가뜨리고 [새로고침] → `/login?expired=1`, "로그인이 만료되었습니다" |
| AC-16-7 | 없는 방 → "방을 찾을 수 없습니다" | 충족 | `/rooms/999` → 안내 표시, 방 칸 숨김, [새로고침]은 보임 |

### 구현 중 자율 결정
#### [새로고침] 버튼 위치
- 결정: 두 화면 모두 본문 맨 위(안내 영역 바로 아래)에 기존 `.form-row` + `button.secondary`로 둔다 — `07-screens.md` SCR-03·04 와이어프레임(안내 영역 줄에 [새로고침]), `base.html`·`app.css`는 이 티켓 산출이 아님
- 선택지: **A. 각 템플릿 본문 맨 위, 기존 클래스만 (권장·채택)** / B. 안내 영역 오른쪽 정렬(공통 `base.html`·`app.css` 수정 필요)
- 권장 이유: 티켓 산출 파일 안에서 끝나고 새 스타일 값이 없다. 상세 화면에서 방 칸이 숨겨져도(404) 버튼은 남는다.
- trade-off: A — 와이어프레임처럼 오른쪽 정렬은 아니다. B — 모양은 맞지만 공통 파일을 기능 티켓에서 고친다.

#### 다시 그릴 때 비교(스냅샷) 삭제
- 결정: `renderRoomPage`·`renderDetail`의 "내용이 같으면 다시 그리지 않기"(`lastRoomPage`·`lastDetailSnapshot`)를 지운다 — 1초 폴링 때 포커스가 사라지는 문제를 막던 장치이고, 이제 다시 그리기는 사용자가 누를 때만 일어남(ADR-012)
- 선택지: **A. 삭제 (권장·채택)** / B. 유지
- 권장 이유: 쓰임이 사라진 코드를 남기지 않는다(금지 패턴 9).
- trade-off: A — [새로고침] 직후 목록 버튼의 포커스는 사라진다(새로고침 버튼 포커스는 유지). B — 쓰지 않는 상태 변수가 남는다.

### 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 오래된 화면에서 보낸 요청 | 서버가 400으로 거부, 화면은 사유 표시 후 상세를 다시 조회해 최신 구성으로 맞춤 | 목록 화면의 [참가]·[만들기] 거부는 사유만 보이고 목록을 다시 조회하지 않음(SEQ-13 범위 밖) |
| PostgreSQL 환경 차이 | 실제 `main.app`을 SQLite 임시 DB로 띄워 확인 | PostgreSQL에서 화면 재확인은 TKT-QA-M10-01 |

### 검증 결과
- 게이트: `uv run ruff check src` 통과, `uv run pytest -q` 76 passed / 88 skipped(PostgreSQL 없음 — 이 티켓은 Python 변경 없음)
- `grep -rnE "setInterval|polling" src/static src/templates` 0줄(티켓 완료 조건)
- 브라우저 확인(앱 내장 브라우저): 임시 실행 스크립트(저장소 밖)가 실제 `main.app`을 SQLite 임시 DB(`aiosqlite`, `uv run --with`로 임시 사용, 프로젝트 의존성 아님)로 띄우고, SQLite가 시간대 없이 돌려주는 시각에 UTC를 붙임. 앱 코드 변경 없음. 시드 회원은 임시 비밀번호로 로그인
- 콘솔: JS 오류 0. 네트워크 오류 기록은 시험에서 일부러 만든 400·410·401·404뿐
- 반응형: 375px 상세 화면 가로 넘침 없음(scrollWidth 375), 1280px 상당(1024px 창) 목록·상세 정상
- 스타일: 새 색·간격 값 없음, `innerHTML`·인라인 스타일 0건(기존 클래스만)
- 스크린샷: 확인 중 찍었으나 저장소에는 저장하지 않음
- audit: 해당 없음(새 의존성 없음)
- `node --check`: 확인하지 못함(이 환경에 Node.js 없음). 브라우저에서 두 화면 스크립트가 오류 없이 동작함으로 대신 확인

### 명세와 다르게 한 것
- 없음. 참고: 방장의 게임 시작 성공 이동 주소를 `/`에서 `/?notice=dissolved`로 바꿨다. TKT-FE-M5-04의 자율 결정("방장은 안내 없이 `/`")을 대체하며, 현재 PM AC-16-3·SCR-04("목록 + 해산 안내")와 ARCH SEQ-13을 따른 것이다.

### 기록 필요
- 없음

### 변경 범위
- 수정: `src/static/js/rooms.js`(검수 지적 반영 포함), `src/templates/rooms/list.html`, `src/templates/rooms/detail.html`
- 삭제: `src/static/js/polling.js`
- 추가: `docs/05-frontend/briefing-TKT-FE-M10-01.md`
- 공통 파일(`base.html`, `api.js`, `app.css`)·서버 코드 변경 없음, 새 의존성 없음

### 검수 지적 반영 (TKT-QA-M10-01, 2026-10-31)
- 막힘 0 · 불편 1(이슈 2, 하) — 이번 PR에서 고침
- 이슈 2 "조회 실패 안내 뒤 변경 거부 사유가 사라짐": `rooms.js`에 `showError(message)`를 두어, 거부 사유·접근 불가 등 오류 문구를 보일 때 조회 실패 표시(`showingLoadError`)를 내린다. 다음 조회 성공의 `clearLoadError()`가 그 문구를 지우지 않는다. 목록의 [참가]·[만들기]·목록 조회 오류, 상세의 404·기타 오류·변경 거부가 모두 이 함수를 쓴다
- 재검증(같은 재현 방법): 통신 실패로 [새로고침] → 안내 → 복구 후 정원 찬 팀으로 이동 → "선택한 팀의 정원이 찼습니다"가 남음, 구성 4/4로 다시 그려짐. 회귀: 통신 실패 안내는 다음 [새로고침] 성공 때 여전히 사라짐, 해산 방 [새로고침] → `/?notice=dissolved`. JS 오류 0
- 이슈 1(410 캐시)은 BE `src/main.py` 수정(백엔드 브리핑)

### 확인하지 못한 것
- PostgreSQL 실제 DB에서의 화면 동작(TKT-QA-M10-01)
- `check-handoff.mjs FE` 사전·사후 점검(Node.js 없음 — 선행 TKT-QA-M9-01 브리핑 `status: done`을 직접 확인)
- 같은 방을 4개 브라우저로 동시에 연 시연 흐름(`07-screens.md` §5)은 QA 리허설에서
