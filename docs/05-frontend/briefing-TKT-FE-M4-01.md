---
stage: FE
tickets: [TKT-FE-M4-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [편지 띄우기·창가] TKT-FE-M4-01 `/letters/new`, `/mypage/window`
결론: 두 화면과 세 연출(봉투 닫힘·우체통 들어감·촛불)을 실제 액션(API-15·08·11·12, `getWindow`·`getLetterPageState`)에 연결 · 상태별 모양·연출은 미리보기로, 실제 회차 흐름은 회원 세션이 없어 못 봄

## 사람이 결정할 것
- 없음

## 이해 가이드
- 편지지: `app/letters/new/page.tsx` → `requireMember` → `getLetterPageState()` 세 갈래. ① 새 편지 `components/LetterForm.tsx` ② 결제 대기 편지(내용 보존) + `PendingRoundActions`([다시 결제하기] API-08, [편지 거두기] API-12) ③ 진행 중 → "지금 책방지기가 편지를 준비하고 있어요" + 창가 링크.
- [우체통에 편지 넣기]: 봉투 닫힘(즉시, 0.7초) → `postLetter`(API-15) → `openTossPayment`. 결제창을 닫으면 실패 경로(API-10) → `/checkout/result?status=fail&target=round` → [다시 결제하기]·[편지지로 가기], 편지지는 결제 대기 상태로 내용이 남는다.
- 결제 확정 뒤에만: `/checkout/result?status=ok&target=round`에서 `PostedLetter`가 봉투가 우체통에 들어가는 전환(2초)을 재생하고 창가로 간다(D-041).
- 창가: `app/mypage/window/page.tsx` → `getWindow()`(진입할 때마다, ADR-006) → `WindowScene`(밤 패널 + 그림 + 상태 문구) + 상태별 버튼, 발송됨이면 아래에 `BlindBook` + 힌트 + [코드 입력하기].
- 먼저 읽을 파일: `components/LetterForm.tsx` — 글자 수·봉투·결제 / `components/WindowScene.tsx` — 창가 패널 / `app/globals.css` 앞부분 — 모션 토큰

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-11-1 | 체크박스·설문 없이 편지지 + 30,000원 + 배송지 확인 | 충족(미리보기) | `SCR-14-letter-*.png`. 금액 표시는 30,000원 상수, 실제 결제 금액은 DB(D-003, NFR-19) |
| AC-11-2 | 봉투 닫힘 → 결제, 확정 뒤에만 우체통 | 충족(미리보기) | 누른 뒤 250ms에 봉투 덮개 `animation-name: envelope-close`, 이어서 토스 샌드박스 결제창 열림(`SCR-14-letter-closing-1280.png`). 결과 화면 `mailbox-drop`(`SCR-11-result-round-posted-1280.png`) |
| AC-11-4 | 진행 중 회차면 안내 + 창가 링크 | 코드 | `in_progress` 분기 |
| AC-11-5 | 9자·2,001자 → 버튼 비활성, 글자 수 보임 | 충족(미리보기) | 8자: "8 / 2,000자 · 10자 이상 써 주세요" + 비활성, 54자: 활성 |
| AC-11-6·8 | 결제 미완료 → 내용 보존 + [다시 결제하기]·[편지 거두기], 우체통 전환 없음 | 충족(미리보기) | `SCR-14-letter-pending-*.png`. 우체통 전환은 `status=ok` 결과 화면에만 있다 |
| AC-11-7 | 동작 줄이기 → 정지 그림 | 코드 | 모든 연출이 `motion-safe:`. 봉투 닫힘 대기도 건너뛴다. 우체통 화면은 봉투가 들어간 그림(`motion-reduce:opacity-0`)과 [창가로 가기]만, 자동 이동 없음 |
| AC-12-1~3·5 | 창가 4상태 그림 + 고정 문구 | 충족(미리보기) | `SCR-15-window-{empty,arrived,reading,shipped}-*.png`, 문구는 `WINDOW_COPY` |
| NFR-11, D-043 | 그림 대체 텍스트 = 상태 문구 | 충족 | 네 상태 모두 `role="img"`의 `aria-label`과 문구가 같음(DOM) |
| UX-9 | 360×640 첫 화면에 그림과 문구 | 충족 | 360px에서 문구 아래쪽 478~514px |
| AC-12-4 | 택배·운송장·단계 숫자 없음 | 충족 | 화면 문구 검색 0건 |
| AC-12-7, AC-20-5·6 | 취소 요청 중 문구 + [취소 요청 철회] / 거절 안내 | 충족(미리보기) | `windowNotice()` 문구 + `RoundCancelButton`, `SCR-15-window-reading-*.png` |
| AC-20-2 | 발송된 회차엔 [취소 요청] 없음 | 충족 | shipped 분기에 버튼 없음 |
| UX-10 | "N / 2,000자"가 늘 보이고 입력마다 바뀜 | 충족 | 위 AC-11-5 |
| UX-17 | 반복 움직임은 촛불 하나, 동작 줄이기면 정지 | 충족 | `motion-safe:animate-candle`(읽는 중·메인 그림) |

## 선택과 이유
- 모션 토큰을 `app/globals.css`에 넣었다(`--animate-candle`·`envelope-close`·`mailbox-drop`·`unbox-*`, `@utility svg-origin-*`). design-system §7의 모양·NFR-10의 시간을 그대로 옮긴 값이고, 컴포넌트에 임의값 클래스를 쓰지 않으려면 토큰이 필요했다. 공통 파일 변경이다.
- 봉투 닫힘은 `startTransition` 밖에서 상태를 바꾼다. 안에서 바꾸면 액션이 끝날 때까지 화면에 반영되지 않는 것을 검증 중에 찾아 고쳤다.
- `WindowScene`을 만들고 마이페이지 `WindowSummary`(TKT-FE-M2-01)가 그것을 쓰게 바꿨다. 창가 그림·문구·밤 패널 버튼 모양이 한 곳에 있다.
- 창가 [취소 요청] 등은 밤 패널 외곽선 버튼(`--night-border`), [편지 띄우기]는 등불 버튼(`--lamp`, 창가 패널 안에서만, UX-D-01).

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 실제 회차 결제 한 바퀴(편지 → 결제 → 확정 → 창가 어두움)를 못 봄 | 결제창 열림, 실패 경로, 결과 화면 연출 확인 | QA-M4 |
| 결과 화면이 2.6초 뒤 창가로 자동 이동 | 동작 줄이기면 자동 이동 없음, 버튼으로 이동 | UX가 자동 이동 여부 검토 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0 / GATE-05·06 0줄
- UX-1: 새 파일 중 토큰 밖 색은 일러스트(`LetterArt`, `BlindBook`, `WindowArt`)뿐
- 스크린샷(미리보기, dev 서버): `SCR-14-letter-*`, `SCR-14-letter-closing-1280`, `SCR-14-letter-pending-*`, `SCR-15-window-*-{1280,360}`, `SCR-11-result-round-posted-1280`
- 비회원 `/letters/new`·`/mypage/window` → 307 `/login?next=…`
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- 창가 결제 대기 상태: 시안에 없어 상태 문구 + [편지지로 가기]를 두었다.
- 명세에 없는 문구: "봉투를 닫는 중이에요", "편지지를 펼치는 중이에요.", "편지를 띄웠어요"(결과 화면 제목), 글자 수 옆 "10자 이상 써 주세요", 편지 칸 placeholder "책방지기님께,".

## 기록 필요
- 모션 토큰 값(globals.css)과 결과 화면 자동 이동(2.6초) — UX가 결정 기록에 옮길지 판단

## 변경 범위
- 공통 파일: `app/globals.css`(모션 토큰), `components/WindowArt.tsx`(촛불 흔들림 켬), `components/WindowSummary.tsx`(WindowScene 사용)
- 수정: `app/checkout/result/page.tsx`(회차 성공 연출)
- 추가: `app/letters/new/page.tsx`, `app/mypage/window/page.tsx`, `components/LetterForm.tsx`, `LetterPaper.tsx`, `LetterArt.tsx`, `BlindBook.tsx`, `WindowScene.tsx`, `PendingRoundActions.tsx`, `PostedLetter.tsx`, `RoundCancelButton.tsx`, 스크린샷, 이 브리핑
- 새 의존성 없음

## 확인하지 못한 것
- 실제 회차 결제·확정·창가 상태 변화(AC-11-3, AC-12-6), 회원 간 열람 차단(AC-11-9, BE·DB 범위)
- 실제 기기에서 동작 줄이기 설정
