---
stage: FE
tickets: [TKT-FE-M4-04]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [보완] TKT-FE-M4-04 서재 목록 받는 사람 이름, 언박싱·서가 표지 테마
결론: 두 요청 모두 반영·검증 · 실제 API(TKT-BE-M4-05) 기준

## 사람이 결정할 것
- 없음

## 이해 가이드
- 서재 작업 ① 목록: `getDeskRounds()`가 이제 `DeskRound.recipientName`을 준다 → `components/DeskRoundList.tsx`가 "<이름> 님의 편지 · <날짜> 도착"으로 그린다(SCR-19 시안).
- 언박싱·나의 서가: `UnboxedRound.product.theme`을 `BookCover`에 넘긴다 → 표지 이미지가 깨지면 그 책의 테마 무늬로 대체 표지(UX-D-10, AC-04-2).
- 먼저 읽을 파일: `components/DeskRoundList.tsx` / `components/UnboxedView.tsx` / `components/BookCover.tsx`

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| SCR-19 시안 | 목록 줄이 "<이름> 님의 편지" | 충족 | `DeskRoundList`에 예시 회차 3건 → "김예시 님의 편지 2026-10-20 도착 [current]", "이예시 님의 편지 … 취소 요청"(+ [환불]·[취소 거절]), "박예시 …" (`SCR-19-desk-list-names-{1280,360}.png`) |
| AC-04-2, UX-D-10 | 깨진 표지 → 같은 비율, 그 책의 테마 무늬 | 충족 | 이미지 요청을 막고 그림: 언박싱 `할머니의 장독대 → text-theme-food`(`SCR-16-unboxed-fallback-theme-1280.png`), 서가 4권 nature·food·ecology·local 각각 맞는 무늬(`SCR-17-shelf-fallback-themes-1280.png`) |
| (BE 연동) | 바뀐 select가 원격에서 동작 | 충족 | 같은 PostgREST select 문자열을 원격에 보내 오류 0(대조군: 없는 컬럼은 오류). 원격 회차 데이터가 0건이라 실제 값은 미리보기로 확인 |

## 선택과 이유
- 서재 목록을 `components/DeskRoundList.tsx`로 분리했다. 화면 코드 그대로를 예시 데이터로 그려 검증하기 위해서이고, 동작은 같다. 환불·거절 액션은 화면이 props로 넘긴다(components는 app을 import하지 않음).
- TKT-FE-M4-03에서 `BookCover`의 `theme`을 선택으로 바꾸고 기본 무늬로 그리던 임시 처리를 걷어내고, 다시 필수로 되돌렸다. 이제 모든 표지가 테마를 받는다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 실제 책방지기·회원 세션으로 보지 못함 | 실제 컴포넌트를 예시 데이터로 그려 확인, BE select 원격 확인 | QA-M4 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0 / GATE-05·06 0줄 / UX-1 변경 파일 0건
- 스크린샷: `SCR-19-desk-list-names-{1280,360}`, `SCR-16-unboxed-fallback-theme-1280`, `SCR-17-shelf-fallback-themes-1280`
- audit: 새 의존성 없음

## 명세와 다르게 한 것
- 없음(TKT-FE-M4-02·03 브리핑의 "목록 줄 이름을 날짜로", "기본 무늬" 두 항목을 이번에 해소)

## 기록 필요
- 없음

## 변경 범위
- 수정: `app/admin/desk/page.tsx`(목록을 컴포넌트로), `components/UnboxedView.tsx`, `app/mypage/shelf/page.tsx`(theme 전달), `components/BookCover.tsx`(theme 필수로 되돌림)
- 추가: `components/DeskRoundList.tsx`, 스크린샷, 이 브리핑
- 새 의존성 없음

## 확인하지 못한 것
- 실제 데이터(회차 0건)로 본 서재 목록·서가
