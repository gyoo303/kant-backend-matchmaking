---
stage: FE
tickets: [TKT-FE-M2-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [로그인·마이페이지·관리자 틀] TKT-FE-M2-01 `/login`, `/mypage`, `/admin`
결론: 완료 조건 AC-05-1·3, AC-06-5 충족(AC-05-3·AC-06-5는 회원·책방지기 계정으로는 못 봄, 아래) · 실제 API 기준

## 사람이 결정할 것
- 탈퇴에 확인 단계가 없다. 명세(SCR-06 "확인 팝업은 쓰지 않는다", design-system §5)대로 [탈퇴]를 누르면 바로 탈퇴 액션이 실행된다. 막히는 경우(AC-05-7·9) 외에는 되돌릴 수 없다. 팝업이 아닌 화면 안 두 단계(예: "정말 탈퇴할게요" 버튼이 한 번 더 나옴)가 필요한지 UX·PM이 정해 주세요.

## 이해 가이드
- `/login`: 서버 페이지가 `?next`(→ `safeNextPath`)·`?error=1`을 읽고, 이미 로그인했으면 `next`로 보낸다. 버튼은 `components/LoginButtons.tsx`(client)가 브라우저 클라이언트로 `signInWithOAuth({ provider: 'kakao' | 'custom:naver', redirectTo: SITE_URL/auth/callback?next=… })`. 콜백·세션은 BE(`app/auth/callback/route.ts`).
- `/mypage`: `<Suspense>` 안에서 `requireMember('/mypage')` → `getWindow()`·`getSubscriptionState()` → 창가 요약(`WindowSummary`) + 메뉴(`MenuList`) + [로그아웃]·[탈퇴](`AccountActions`, client).
- `/admin/**`: `app/admin/layout.tsx`의 `KeeperShell`이 `<Suspense>` 안에서 `requireKeeper()`(아니면 `notFound()`) 뒤에만 관리자 바와 본문을 그린다. 관리자 바가 있으면 `globals.css`의 `body:has([data-admin-shell]) [data-site-chrome]` 규칙이 회원 Header·Footer를 숨긴다.
- 먼저 읽을 파일: `app/admin/layout.tsx` — 권한·관리자 틀 / `components/LoginButtons.tsx` — 로그인 호출 / `app/mypage/page.tsx` — 메뉴 구성

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-05-1 | 로그인 수단은 카카오·네이버 2개, 아이디·비밀번호 칸 없음 | 충족 | `SCR-05-login-*.png`, `main input` 0개, 버튼 2개(52px 높이, 폭 같음) |
| AC-05-5 | 취소·실패 시 "로그인을 마치지 못했어요" | 충족 | `/login?error=1` → `role="alert"` 문구, `SCR-05-login-error-*.png`. `signInWithOAuth`가 오류를 돌려줘도 같은 안내 |
| AC-05-6 | 비회원이 마이페이지·관리자 주소로 → 로그인, 후 원래 주소 | 부분 | 비회원 `/mypage`·`/admin`·`/admin/products(/new)` → 307 `/login?next=<원래 주소>`(proxy). [카카오로 시작하기] 클릭 시 `redirect_to=…/auth/callback?next=%2Fproducts` 확인. 실제 로그인 후 돌아오기는 계정 없이 확인 못 함 |
| AC-05-3 | 회원 마이페이지 메뉴: 주문 현황·창가·나의 서가·기본 배송지·로그아웃·탈퇴, "창가"는 `/mypage/window` | 충족(미리보기) | 가짜 데이터 미리보기 `SCR-06-mypage-*.png`, 메뉴 줄 높이 57px |
| AC-18-7 | 구독이 없거나 마무리됨 → "구독 마무리하기" 없음 | 충족(미리보기) | `getSubscriptionState().active`가 false면 메뉴에서 뺀다. `SCR-06-mypage-empty-*.png` |
| AC-12-5 | 구독 없음 → 빈 창가 + [편지 띄우기] | 충족(미리보기) | 같은 스크린샷 |
| AC-05-7·9 | 탈퇴가 막히면 이유 | 충족(미리보기) | 액션의 `error.message`를 탈퇴 줄 아래 `role="alert"` 상자로 |
| AC-06-5 | 일반 회원·비회원은 관리자 화면이 보이지 않음 | 부분 | 비회원은 proxy가 로그인으로. 일반 회원은 `requireKeeper()` → `notFound()`이고 관리자 바도 확인 뒤에만 그린다(코드). 일반 회원 계정으로는 못 봄 |
| UX-18 | 관리자 바 `--primary`, 본문 한 열 `max-w-3xl` | 충족(미리보기) | `SCR-20-admin-home-*.png`, 회원 Header·Footer `display: none` 확인 |
| UX-3 | 관리자 바 현재 메뉴 표시 | 코드만 | `NavLinks tone="admin"`이 `aria-current="page"` + `bg-primary-foreground/15`. 미리보기 주소가 달라 화면으로는 못 봄 |
| UX-D-08·09 | 네이버 흰색형, 탈퇴는 빨간색 아님 | 충족 | 스크린샷 |

"충족(미리보기)": 로그인이 OAuth뿐이라 회원·책방지기 세션을 만들 수 없어, 커밋하지 않는 임시 경로에서 같은 컴포넌트를 가짜 데이터·가짜 액션으로 그려 찍었다. 실제 데이터 연결은 코드로만 확인했다.

## 선택과 이유
- 관리자 화면에서 회원 Header·Footer 숨기기: 사용자 결정(2026-10-22). `app/layout.tsx`의 `<Header/>`·`<Footer/>`는 그대로 두고(KANT-R4) CSS `:has()`로 숨긴다. 라우트 그룹 분리는 KANT 증빙 경로·ARCH 문서를 바꿔야 해서 쓰지 않았다.
- 관리자 바는 권한 확인 뒤에만 그린다. 사전 렌더링 셸에 관리자 메뉴 이름이 섞여 비회원에게 보이지 않게 하려는 것이다(NFR-06).
- [로그아웃]은 브라우저 클라이언트 `auth.signOut()` 후 `/`로 간다. 로그아웃 Server Action이 BE에 없고, 로그인과 같은 인증 호출이라 CONV-05 예외로 봤다.
- SCR-20 숫자는 BE `getKeeperCounts()`가 이미 있어 이번에 연결했다(HANDOFF는 M4 뒤 연결로 적음). 조회 실패면 "–".
- 마이페이지 창가 요약도 BE `getWindow()`로 이번에 연결했다. M4의 `WindowScene`이 나오면 `WindowSummary`를 그것으로 바꾸거나 합친다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 회원·책방지기 화면을 실제 세션으로 보지 못함 | 미리보기로 모양·상태 확인 | 카카오 로그인 설정 후 QA-M2 |
| headless 클릭 시 Supabase `/auth/v1/authorize?provider=kakao`에서 카카오로 넘어가지 않음 | 요청 주소·`redirect_to`는 맞음 | Supabase 대시보드 카카오 공급자 설정 확인(사람) |
| 네이버(`custom:naver`)는 BE 스파이크 미완료(TKT-BE-M2-02) | 버튼은 ADR-003 A 방식으로 호출 | 스파이크 실패 시 B 방식 주소로 바꿔야 함 |
| 탈퇴 확인 단계 없음 | 명세대로 | "사람이 결정할 것" |
| `body:has()`를 지원하지 않는 아주 오래된 브라우저는 관리자 화면에 회원 Header가 같이 보임 | NFR-12 대상(최신 Chrome·Edge·Safari·삼성 인터넷)은 모두 지원 | — |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄, `'use client'` 파일의 `@/lib` import는 `lib/supabase/client`만
- UX-1: 새 파일 중 토큰 밖 색은 `LoginButtons.tsx`(소셜 버튼 예외)뿐 / UX-5·19 0건
- 스크린샷: `SCR-05-login{,-error}-{1280,360}.png`(실제 서버), `SCR-06-mypage{,-empty}-*.png`·`SCR-20-admin-home-*.png`(미리보기)
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- 마이페이지 "주문 현황" 옆 건수(시안 "2건")는 넣지 않았다. 주문 수 조회는 TKT-FE-M3-02에서 주문 현황과 함께 붙인다.
- 관리자 바 "우분투북스"는 책방 화면(`/`), "책방지기 서재"는 관리자 홈(`/admin`)으로 가는 링크로 나눴다. 시안은 로고 하나다.
- 명세에 없는 문구: 로딩 "창가를 살피는 중이에요.", "할 일을 세는 중이에요.", 로그아웃 실패 "로그아웃하지 못했어요. 다시 시도해 주세요".
- 관리자 홈 본문 폭: 시안은 넓은 폭이지만 UX-18(관리자 전체 `max-w-3xl`)을 따랐다.

## 기록 필요
- 관리자 화면에서 회원 Header·Footer를 숨기는 방식(사용자 결정 2026-10-22, CSS `:has()`).

## 변경 범위
- 공통 파일: `app/globals.css`(숨김 규칙 3줄), `components/Header.tsx`·`Footer.tsx`(`data-site-chrome` 속성), `components/NavLinks.tsx`(`tone`, `exact` 추가)
- 추가: `app/login/page.tsx`, `app/mypage/page.tsx`, `app/admin/layout.tsx`, `app/admin/page.tsx`, `components/LoginButtons.tsx`, `AccountActions.tsx`, `WindowSummary.tsx`, `MenuList.tsx`, `AdminBar.tsx`, 이 브리핑, 스크린샷
- 새 의존성 없음

## 확인하지 못한 것
- 실제 카카오·네이버 로그인, 로그인 후 원래 주소로 돌아오기(AC-05-2·6)
- 일반 회원으로 `/admin` 접근 시 404(AC-06-5)
- 실제 탈퇴·탈퇴 거부(AC-05-4·7·8·9) — 회원 데이터가 지워지므로 공용 DB에서 시험하지 않았다
