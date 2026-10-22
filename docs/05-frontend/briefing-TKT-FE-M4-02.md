---
stage: FE
tickets: [TKT-FE-M4-02]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [서재 작업] TKT-FE-M4-02 `/admin/desk`
결론: 한 열 서재 작업 화면을 실제 액션(API-13·17·18·19, `getDeskRounds`·`getKeeperRound`·`getFarewellNotes`)에 연결 · 책방지기 세션이 없어 실제 열람·발송은 못 봄

## 사람이 결정할 것
- 없음

## 이해 가이드
- `app/admin/desk/page.tsx`: `?round=<id>`(없으면 도착 순 첫 회차) → 서버에서 `openRound`(API-17, arrived → reading) → `getKeeperRound`로 다시 읽는다(BE 브리핑). 같은 요청 안이라 "읽는 중"이 바로 보인다.
- ① 편지 읽기: 회차 목록(결제 확정된 arrived·reading만) + 고른 회차의 편지 전문(`LetterPaper`). 취소 요청 회차는 [환불]·[취소 거절](`KeeperOrderActions kind="round"`).
- ② `components/DeskContentsForm.tsx`: 책 검색(제목·저자, 화면 안 필터) → 라디오(품절은 비활성 + 배지) → 답장 → 엽서 → `saveRoundContents`(API-18, FormData).
- ③ `components/ShipRoundForm.tsx`: 힌트 + 글자 수 → 빠진 항목 안내 → [발송](API-19) → 코드 크게(`UnboxingCode`). 발송한 회차를 주소로 다시 열면 같은 코드(AC-15-2).
- 아래: 작별 안부 목록(AC-18-4).

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-13-1, NFR-13 | 편지 읽기 → 책·답장·엽서 → 힌트·발송이 한 열, 좌우 분할 없음, 다른 화면 이동 없음 | 충족(미리보기) | `SCR-19-admin-desk-*.png`, 단계 번호 원 1·2·3 |
| AC-13-2·3 | 처음 열면 읽는 중, 다시 열어도 그대로 | 코드 | 진입 때 `openRound`(RPC가 arrived일 때만 바꿈) |
| AC-13-4 | 결제 대기 회차는 목록에 없음 | BE | `getDeskRounds`가 arrived·reading만 |
| AC-13-5 | 일반 회원은 못 봄 | TKT-FE-M2-01 | `app/admin/layout.tsx` |
| AC-14-1 | 책·답장·엽서 저장, 다시 와도 남음 | 코드 | 저장 뒤 BE가 revalidate, 폼 기본값은 `getKeeperRound` 값 |
| AC-14-2 | 품절 책은 "품절", 고를 수 없음 | 충족(미리보기) | 라디오 `disabled` + 품절 배지. 서버도 재고를 다시 본다 |
| AC-14-3 | 11MB·PDF → 이유 | 충족(미리보기) | 서버 `fieldErrors.postcard`를 칸 아래에 |
| AC-15-1·4 | [발송] → 6자리 코드, 두 번 눌러도 1개 | 충족(미리보기) | 가짜 액션으로 코드 표시, `aria-label="언박싱 코드 4 8 2 9 1 3"`(`SCR-19-admin-desk-sent-1280.png`). 처리 중 버튼 막음, 최종 멱등은 BE |
| AC-15-3 | 힌트 없으면 [발송] 비활성 + 빠진 항목 | 충족(미리보기) | "아직 빠진 것: 힌트 문장" + 비활성 |
| AC-15-5 | 발송 직전 품절 → 다른 책 안내 | 코드 | 액션 `OUT_OF_STOCK` 문구를 버튼 아래에 |
| AC-20-3 | 취소 요청 회차는 [발송] 막힘 | 코드 | `cancelRequested`면 비활성 + 안내 |
| AC-18-4 | 작별 안부를 읽을 수 있음 | 코드 | 하단 목록, 조회 실패 시 안내 |
| UX-18 | 관리자 바, 한 열 `max-w-3xl` | 충족 | 관리자 레이아웃 |

## 선택과 이유
- 책 검색은 서버 검색 API가 없어 공개 상품 목록(`getProducts`)을 받아 화면 안에서 거른다. 책이 수십 권 규모라 충분하다.
- `KeeperOrderActions`(TKT-FE-M3-02)에 `kind`를 받게 하고 `shipOrder`를 선택으로 바꿨다. 주문·회차의 [환불]·[취소 거절]이 같은 버튼·같은 처리 중 막기를 쓴다. `app/admin/orders/page.tsx`의 prop 이름(`orderId` → `targetId`)도 같이 바꿨다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 목록에 손님 이름이 없다(시안은 "김예시 님의 편지") | 도착 날짜로 구분, 펼친 편지 위에는 받는 사람 이름 | BE에 `getDeskRounds`에 받는 사람 이름 추가 요청 |
| 화면 렌더 중에 `openRound`(쓰기)를 부른다 | BE 설계(SEQ-05)대로, 영향 0이어도 성공 | — |
| 실제 저장·업로드·발송을 못 봄 | 미리보기로 상태 확인 | QA-M4 |

## 검증 결과
- GATE-01~06 통과(위 TKT-FE-M4-01과 같은 실행)
- 스크린샷(미리보기): `SCR-19-admin-desk-{1280,360}`, `SCR-19-admin-desk-sent-1280`
- 비회원 `/admin/desk` → 307 `/login?next=/admin/desk`
- audit: 새 의존성 없음

## 명세와 다르게 한 것
- 목록 줄 이름: "<날짜> 도착한 편지"(위 위험).
- 명세에 없는 문구: "지금 읽을 편지가 없어요", "아직 남겨진 작별 안부가 없어요", "작별 안부를 불러오지 못했어요", "찾는 책이 없어요", [책과 답장 저장], "저장했어요", 로딩 문구.
- 작별 안부 목록에는 이름 없이 날짜만 보인다(`getFarewellNotes`가 이름을 주지 않음).

## 기록 필요
- 없음

## 변경 범위
- 추가: `app/admin/desk/page.tsx`, `components/DeskContentsForm.tsx`, `ShipRoundForm.tsx`, `UnboxingCode.tsx`, 스크린샷, 이 브리핑
- 수정: `components/KeeperOrderActions.tsx`(kind·선택 발송), `app/admin/orders/page.tsx`(prop 이름. 같은 파일의 [주소록 내려받기]는 TKT-FE-M4-03 내용이지만 같은 커밋에 들어갔다)
- 새 의존성 없음

## 확인하지 못한 것
- 실제 열람(arrived → reading)·저장·엽서 업로드·발송·코드 재확인
