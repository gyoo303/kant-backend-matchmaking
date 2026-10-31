---
stage: QA
tickets: [TKT-QA-M10-01]
status: done
inputs_read: [AR-MAP, AR-HAND, PM-AC, PM-SCR, PM-DEC, AR-GATE, AR-API, FE-BRIEF]
next_readers: [사람]
---
# QA 브리핑 – TKT-QA-M10-01 폴링 제거·수동 새로고침 검증 (reference/agent-pipeline-blueprint)

판정: ⚠️ 조건부 — 바뀐 수용기준은 모두 충족, 발견 이슈 2건은 수정 후 재검증 통과(해결됨). 남은 조건: PostgreSQL 미확인(환경)

## 요약 (3줄 이내)
- D-026·ADR-012 변경(PM·ARCH 문서, `polling.js` 삭제, `rooms.js`·템플릿 2개)은 수용기준 AC-15-2·5·6, AC-16-1~7, NFR-08을 모두 충족했고, GATE-02~08 통과, 시연 흐름 5단계 리허설도 통과했다.
- 기존 문제 1건(중): 410 응답에 캐시 금지 헤더가 없어 Chrome이 캐시한다. DB를 다시 만든 뒤 같은 브라우저로 시연하면 활성 방이 "해산됨"으로 보일 수 있다.
- 이번 변경 1건(하): 조회 실패 안내가 떠 있는 상태에서 변경이 거부되면 거부 사유가 곧바로 지워진다.
- 두 이슈 모두 같은 날 BE·FE가 고쳤고, 같은 재현 방법으로 재검증해 "해결됨"이다(아래 재검증).

## 검증 범위와 환경
- 범위: `18b95c2`(PM), `431c8f8`(ARCH), `6fc4b31`(FE). 원격 `origin/reference/agent-pipeline-blueprint`보다 3커밋 앞섬(푸시 전)
- 환경: PostgreSQL·`.env`·Node.js 없음. 화면은 QA 작업 폴더(저장소 밖)의 임시 실행 스크립트로 실제 `main.app`을 SQLite 임시 DB(`aiosqlite`, `uv run --with`로 임시 사용)로 띄워 앱 내장 브라우저(Chrome)로 확인. SQLite가 시간대 없이 돌려주는 시각에 UTC를 붙임. 앱 코드 변경 없음

## 수용기준 검증

| 수용기준 | 테스트 | 결과 |
|---|---|---|
| AC-15-2 해산 뒤 [새로고침]·재진입 시 현재 방 링크 사라짐 | 브라우저: 방장이 방 9 해산 → 목록 `#current-room` hidden | 통과 |
| AC-15-5 / NFR-08 10초 무조작 시 추가 조회 0건 | FE 브리핑 측정값(진입 3건, 10초 추가 0건) + `grep -rnE "setInterval\|polling" src/static src/templates` 0줄. 소스에 타이머 없음 | 통과 |
| AC-15-6 다른 사람이 만든 방이 [새로고침]으로 보임 | FE 브리핑 확인 + 상세에서 같은 동작 재확인(아래 AC-16-1) | 통과 |
| AC-16-1 다른 사람 참가가 [새로고침]으로 반영 | 방 9: seed13·14 API 참가 → 화면 "1/4" 유지 → [새로고침] → "3/4" | 통과 |
| AC-16-2 방장만 제목 변경·게임 시작 | 방장 화면 [게임 시작] 보임·4/4에서 활성 | 통과 |
| AC-16-3 방장 게임 시작 → 목록 + 해산 안내 | 방 9 방장 seed12가 [게임 시작] → `/?notice=dissolved`, "게임이 시작되어 방이 해산되었습니다" | 통과 |
| AC-16-4 다른 참가자는 [새로고침]·버튼 때 해산 확인 | 버튼 경로·새로고침 경로 모두 FE 브리핑에서 확인, 이번에 다른 참가자의 상세 조회가 410(`cache:'no-store'`)임을 재확인 | 통과 |
| AC-16-5 통신 실패 → 마지막 정보 유지 + 안내 | `fetch`를 실패하게 바꾸고 [새로고침] → "최신 정보를 불러오지 못했습니다", 구성 유지 | 통과 |
| AC-16-6 401 → 로그인 안내 | FE 브리핑 확인(`/login?expired=1`). 이번 변경은 `api.js`를 바꾸지 않음 | 통과 |
| AC-16-7 없는 방 → "방을 찾을 수 없습니다" | `/api/rooms/99` 404 "방을 찾을 수 없습니다"(curl), 화면은 FE 브리핑 확인 | 통과 |
| SEQ-13 변경 거부 뒤 재조회 | 오래된 화면(B팀 빈자리 2)에서 [B팀으로 이동] → 400 "선택한 팀의 정원이 찼습니다" 표시 + 재조회로 B팀 "시드유저13·14", "4/4" | 통과 |
| SEQ-13 조회 겹침 방지 | [새로고침] 3회 연속 클릭 → `/api/rooms?` 요청 1건, 키보드 포커스 버튼에 유지 | 통과 |
| 시연 흐름 `07-screens.md` §5 | ① 목록 검색(1건)·빈자리 필터(3건)·페이지(size 2, 2쪽) ② UI로 방 생성 → 참가·[새로고침]·본인 팀 이동 ③ 200 ④ 400: 3명 시작 "A팀과 B팀이 각각 2명일 때만…", 방장 아닌 시작 "방장만 할 수 있습니다", 정원 찬 팀 이동 ⑤ 방장 시작 → 해산 안내, 목록에서 방 사라짐, 내 기록에 "QA 시연 방" 입장·퇴장 | 통과 |

## 실행 결과

| 항목 | 결과 | 분류 |
|---|---|---|
| GATE-01 기동 | SQLite 임시 DB로 기동 오류 0, `/docs` 200, 시드 로그 1회(합계 60) | 환경 문제(PostgreSQL 미확인) |
| GATE-02 계층 격리 · GATE-03 `__init__.py` | 출력 0줄 | 통과 |
| GATE-04 테스트 | 통과 76 / 실패 0 / 실행 76개, 건너뜀 88(`TEST_DATABASE_URL` 없음 — 410/404 통합 테스트 포함) | 환경 문제 |
| GATE-05 린트·포맷 | `ruff check` 통과, `ruff format --check` 49 files already formatted | 통과 |
| GATE-06 비밀값 · GATE-07 금지 패턴 · GATE-08 ORM 누출 | 출력 0줄, `.gitignore` 항목 존재 | 통과 |
| 폴링 잔재 | `grep -rnE "setInterval\|polling" src/static src/templates` 0줄 | 통과 |
| 의존성 | 변경 없음 | 해당 없음 |
| 브랜치 충돌 | `origin/dev`와는 공통 조상 없음("unrelated histories") — 이 참조 브랜치는 dev 머지 대상이 아님. 다른 원격 브랜치 없음 | 해당 없음 |
| JS 문법 | `node --check` 실행 못 함(Node.js 없음). 브라우저에서 두 화면 오류 0으로 대신 확인 | 환경 문제 |

## 발견 이슈

| 심각도 | 위치 | 내용 | 재현 방법 | 수정안 | 확인 수준 | 담당자 |
|---|---|---|---|---|---|---|
| 중 (기존, M5부터) | `src/main.py:77-78` `handle_gone_error` | 410 응답에 `Cache-Control`이 없어 Chrome이 응답을 캐시하고, 같은 주소의 다음 `fetch`에 서버 대신 캐시된 410을 돌려준다(`transferSize 0`). DB를 다시 만들어 방 번호가 재사용되면 **활성 방 상세가 "해산됨"으로 목록에 튕긴다.** 시연 전 DB 재생성(HANDOFF M8·M9 안내) 뒤 리허설 브라우저로 시연하면 그대로 일어남 | ① 방 N을 게임 시작으로 해산하고 그 방 상세를 한 번 연다 ② 서버·DB 재생성 ③ 같은 브라우저로 방 N(이제 활성)에 들어간다 → `/?notice=dissolved`. 같은 탭에서 `fetch('/api/rooms/N')`는 410, `fetch(…,{cache:'no-store'})`는 200 | BE: `_detail(410, exc.message, {"Cache-Control": "no-store"})`(또는 API 응답 전체에 `no-store`를 붙이는 미들웨어). 대안으로 FE `api.js`의 `fetch`에 `cache: "no-store"` | 해결됨 (410 핸들러에 헤더 추가, `04-interfaces-api.md` §6 반영) | BE |
| 하 (이번 변경) | `src/static/js/rooms.js:293-296` `showChangeFailure` | 조회 실패 안내가 떠 있는 상태(`showingLoadError = true`)에서 변경 요청이 거부되면, 거부 사유를 보인 직후 재조회가 성공하면서 `clearLoadError()`가 안내 영역을 숨겨 사유가 사라진다. 폴링 때도 다음 주기에 같은 일이 있었고, 이번에는 바로 일어남 | 상세 화면에서 통신 실패로 [새로고침] → 안내 표시 → 통신 복구 → 거부될 변경(정원 찬 팀으로 이동) → 사유가 잠깐 나왔다가 숨겨짐(`#notice` hidden) | FE: `showChangeFailure`에서 `showNotice` 전에 `showingLoadError = false`로 둔다(목록의 `joinRoom`·`createRoom` 실패 문구도 같은 방식) | 해결됨 (`showError()` 추가, 오류 문구 6곳이 사용) | FE |

## 재검증 (이슈 수정 후)
- 이슈 1: 임시 서버에서 방 4를 해산하고 기본 `fetch`로 상세 조회 → 410, `Cache-Control: no-store` → 서버·DB 재생성 → 같은 브라우저로 `/rooms/4` → 활성 방 "4/4" 표시(이전에는 `/?notice=dissolved`로 튕김)
- 이슈 2: 통신 실패로 [새로고침] → 안내 표시 → 복구 후 정원 찬 팀으로 이동 → "선택한 팀의 정원이 찼습니다" 유지(이전에는 숨겨짐), 구성 4/4로 다시 그려짐
- 회귀: 통신 실패 안내는 다음 [새로고침] 성공 때 사라짐, 해산 방 [새로고침] → `/?notice=dissolved`, 콘솔 JS 오류 0
- 게이트: `ruff check src tests` 통과, `ruff format --check src tests` 49 files already formatted, `uv run pytest -q` 통과 76 / 실패 0 / 건너뜀 88(PostgreSQL 없음)
- 테스트 제안: `tests/integration/test_errors.py::test_nfr_02_410_detail_is_string`에 `response.headers["cache-control"] == "no-store"` 단언을 더하면 회귀를 막는다(이번 티켓 산출에 테스트 경로가 없어 넣지 않음, PostgreSQL에서만 실행)

## AI 부채 체크
- 사람이 이해하기 어려운 코드/과설계: 줄었다. 타이머·`seq`·`visibilitychange`(71줄)가 사라지고, 화면마다 "조회 함수 하나 + 버튼 하나"로 읽힌다. `refreshDetail` 전역 변수 하나로 변경 실패 → 재조회가 이어지는 점만 주석으로 기억하면 된다.
- 미래 위험과 최소화 방법:
  - `setupRefreshButton`의 `refresh()`에 `try/finally`가 없다. 지금은 `apiRequest`가 네트워크 오류를 잡아 `status: 0`으로 돌려주므로 문제없지만, 조회 함수가 예외를 던지게 바뀌면 버튼이 막힌 채 남는다. 바꿀 때 `finally`로 버튼을 켠다.
  - 오래된 화면에서 보낸 요청은 서버가 거부한다(정합성은 서버 재검사). 목록 화면의 [참가]·[만들기] 거부는 목록을 다시 조회하지 않으므로, 시연 중에는 [새로고침]을 먼저 누르는 습관을 시나리오에 적어 두면 좋다.

## 추가한 테스트
- 없음. 티켓 "산출"에 테스트 경로가 없고, 화면 동작은 `06-quality-gates.md` §2대로 수동 점검 대상이다. 위 수동 점검 절차(무조작 10초 요청 수, 연속 클릭 요청 수, 변경 거부 뒤 재조회)를 다음 점검표로 쓸 수 있다.

## QA 자율 결정

#### 화면 확인 환경
- 결정: PostgreSQL이 없어 실제 `main.app`을 SQLite 임시 DB로 띄워 확인하고, 판정은 "조건부"로 둔다 — `06-quality-gates.md` §2(SQLite 대체 금지는 자동 테스트 DB 기준), 이번 변경은 화면 JS·템플릿만
- 선택지: **A. SQLite 임시 서버로 확인 + 조건부 (권장·채택)** / B. PostgreSQL이 준비될 때까지 보류
- 권장 이유: 서버 코드가 바뀌지 않아 화면 동작은 DB 종류와 무관하다. 다만 GATE-04 통합 테스트(410/404 포함)는 PostgreSQL에서만 돌므로 조건으로 남긴다.
- trade-off: A — `timestamptz` 등 PostgreSQL 고유 동작은 보지 못함. B — 검증이 늦어지고 이번 변경과 무관한 대기가 생김.

#### 410 캐시 이슈 분류
- 결정: 판정을 반려가 아닌 조건부로 하고 이슈를 "기존(중)"으로 올린다 — QA 스킬 §0-4, M5부터 같은 응답 헤더
- 선택지: **A. 기존·중, 조건부 (권장·채택)** / B. 이번 티켓 반려
- 권장 이유: 이번 변경이 만든 문제가 아니고 운영 중에는 방 번호가 재사용되지 않는다. 다만 시연 준비(DB 재생성) 흐름과 정면으로 겹친다.
- trade-off: A — 수정 전 시연하면 위험이 남음. B — 이번 티켓과 무관한 이유로 막힘.

## 사람이 결정할 것
- 410 캐시 수정 이전에 쓰던 브라우저에는 옛 410 캐시가 남아 있을 수 있다. 시연 브라우저는 캐시를 한 번 비운다(수정 뒤 받은 410은 캐시되지 않음).
- PostgreSQL 환경에서 `uv run pytest -q`(통합 테스트 88개 포함)와 화면 재확인을 누가 언제 할지
- 이번 커밋 3개를 원격에 푸시할지
