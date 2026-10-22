---
stage: FE
tickets: [TKT-FE-M4-03]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [언박싱·서가·마무리·주소록] TKT-FE-M4-03 `/mypage/rounds/[id]`, `/mypage/shelf`, `/mypage/farewell`, SCR-13·20
결론: 세 화면과 주소록 버튼을 실제 액션(API-14·20·21·22)에 연결, SCR-20 숫자는 TKT-FE-M2-01에서 이미 연결 · 회원 세션이 없어 실제 언박싱·메모·마무리는 못 봄

## 사람이 결정할 것
- 없음

## 이해 가이드
- 언박싱: `app/mypage/rounds/[id]/page.tsx` → `getMemberRound`(상태·힌트만) → 발송됨이면 `components/UnboxForm.tsx`, 언박싱됨이면 `getUnboxedRound` → `UnboxedView`. 남의 회차·없는 회차는 같은 not-found. 언박싱 전 데이터에는 제목·표지·답장·엽서 주소가 없다(NFR-08).
- `UnboxForm`: 코드 한 칸 → `unbox`(API-20) → 맞으면 실루엣이 0.8초 흐려지고 책·답장이 1.2초에 걸쳐 나타난다(합 2초, NFR-10). 틀리면 같은 안내만, 횟수 제한 없음.
- 서가: `getShelf()` → 책 격자(상품 목록과 같은 열 수) → 책마다 `ShelfMemo`(보기/쓰기/없음, API-21).
- 마무리: `getSubscriptionState()` → 마지막 인사 편지(UX-D-06 줄바꿈) + 진행 중 회차 안내 + `FarewellForm`(API-22) → "그동안 고마웠어요".
- 주소록: `/admin/orders`의 [주소록 내려받기]는 Route Handler(API-14) 파일 내려받기. 보낼 건이 없으면 BE가 `?empty=1`로 돌려보내고 "지금 보낼 책이 없어요"를 보인다.

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-16-1 | 발송된 회차: 실루엣·힌트·코드 칸만 | 충족(미리보기) | `SCR-16-unboxing-wrong-*.png` |
| AC-16-2 | 맞는 코드 → 공개 전환 → 표지·제목·답장·엽서 | 충족(미리보기) | 0.5초 시점 `unbox-hide` 진행, 4초 뒤 책 제목·"책방지기의 답장" 보임(`SCR-16-unboxing-opened-*.png`) |
| AC-16-3·4 | 틀린 코드 → "코드가 맞지 않아요…", 다시 입력 | 충족(미리보기) | 입력칸 아래 `role="alert"`, `aria-invalid="true"` |
| AC-16-5 | 5자리·문자 → [열기] 비활성 | 충족(미리보기) | 5자리에서 `disabled` |
| AC-16-6 | 언박싱 전 데이터에 책 정보 없음 | 코드·BE | 언박싱 전에는 `getMemberRound`(id·status·teaser)만 부른다 |
| AC-16-7 | 동작 줄이기 → 바로 공개 | 충족(미리보기) | `prefers-reduced-motion: reduce`에서 공개 화면 `animation-name: none` |
| UX-12, UX-D-07 | 코드 칸 1개, numeric, one-time-code, 최대 6자 | 충족 | DOM `numeric,one-time-code,6` |
| AC-17-1·2 | 메모 저장·수정·삭제, 날짜는 마지막 저장일 | 충족(미리보기) | `SCR-17-shelf-*.png`(저장된 메모 + 날짜, 메모 없음) |
| AC-17-3 | 별점·공개·공유·댓글 없음 | 충족 | 화면에 없음 |
| AC-17-4 | 101자 저장 안 됨 | 코드 | "N / 100자" 빨강 + [저장] 비활성, 서버도 거부 |
| AC-17-6 | 언박싱 전 회차엔 메모 칸 없음 | 코드 | 서가에는 언박싱된 책만 |
| AC-18-1 | US-18 문구 그대로 + 작별 안부 칸 + 버튼 | 충족(미리보기) | `SCR-18-farewell-*.png`, 줄을 이으면 US-18 문구와 같다 |
| AC-18-2 | 확인 없이 바로 마무리 | 충족(미리보기) | 누르면 "그동안 고마웠어요" |
| AC-18-5 | 1,001자 → 버튼 비활성 | 충족(미리보기) | 1,001자에서 `disabled` |
| AC-18-7 | 구독 없음 → 메뉴 없음 | TKT-FE-M2-01 | 이 화면에 직접 오면 "진행 중인 구독이 없어요" |
| UX-13 | 서명 줄 오른쪽 정렬, 기본 버튼 색, 빨간색 없음 | 충족 | 스크린샷 |
| AC-19-2·4 | 보낼 건 없음 → "지금 보낼 책이 없어요" | 코드 | `?empty=1` 안내 + 빈 목록도 같은 문구(`SHIPPING_LIST_EMPTY_MESSAGE`) |
| AC-19-1·3 | 파일 2건·한글·권한 | BE | API-14 |
| UX-14 | 빈 서가 "아직 서가에 꽂힌 책이 없어요" + 다음 행동 | 코드 | [편지 띄우기] |

## 선택과 이유
- `BookCover`의 `theme`를 선택으로 바꿨다. `UnboxedRound.product`에 테마가 없어서다. 이미지가 깨질 때만 기본 무늬(자연)로 그린다.
- 공개 연출 총시간을 2초로 맞추려고 `--animate-unbox-hide`를 0.8초로 줄였다(TKT-FE-M4-01에서 넣은 토큰).
- 주소록 버튼은 파일 내려받기라 `<Link>` 대신 `<a>`를 쓴다(CONV-04는 페이지 이동 규칙).
- 회차 not-found(`app/mypage/rounds/[id]/not-found.tsx`)를 두어 남의 회차·없는 회차가 같은 한국어 안내를 받는다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 서가·언박싱의 깨진 표지가 테마 무늬가 아닐 수 있다 | 기본 무늬 | BE에 `UnboxedRound.product`에 `theme` 추가 요청 |
| 엽서 서명 URL은 600초 뒤 만료 | `next/image unoptimized`로 바로 표시 | 오래 열어 둔 화면은 새로고침 필요 |
| 실제 언박싱·메모·마무리를 못 봄 | 미리보기로 상태 확인 | QA-M4 |

## 검증 결과
- GATE-01~06 통과(TKT-FE-M4-01과 같은 실행)
- 스크린샷(미리보기): `SCR-16-unboxing-wrong-*`, `SCR-16-unboxing-opened-*`, `SCR-17-shelf-*`, `SCR-18-farewell-*`
- 비회원 `/mypage/rounds/<id>`·`/mypage/shelf`·`/mypage/farewell` → 307 `/login?next=…`
- audit: 새 의존성 없음

## 명세와 다르게 한 것
- 명세에 없는 문구: "아직 책이 서점 문을 나서지 않았어요"(발송 전 회차), "편지를 찾을 수 없어요"·"창가에서 지금 편지를 확인해 주세요."(not-found), "진행 중인 구독이 없어요", 진행 중 회차 안내 문장(시안 문구), "여는 중이에요", 로딩 문구.
- 서가 메모 날짜는 저장일만(시간 없음).

## 기록 필요
- 없음

## 변경 범위
- 추가: `app/mypage/rounds/[id]/page.tsx`·`not-found.tsx`, `app/mypage/shelf/page.tsx`, `app/mypage/farewell/page.tsx`, `components/UnboxForm.tsx`, `UnboxedView.tsx`, `ShelfMemo.tsx`, `FarewellForm.tsx`, 스크린샷, 이 브리핑
- 수정: `components/BookCover.tsx`(theme 선택). `app/admin/orders/page.tsx`의 주소록 버튼은 TKT-FE-M4-02 커밋에 들어갔다
- 새 의존성 없음

## 확인하지 못한 것
- 실제 언박싱(RLS 공개 시점), 메모 저장·삭제, 구독 마무리, 주소록 파일 내용
