# ADR-003: 소셜 로그인(카카오·네이버)과 책방지기 권한
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [인프라]
- 근거: DRV-C-04, DRV-C-09, RISK-07·11·12, INV-03·15, NFR-06, D-018, →ARCH A-02·A-07·A-10

## 맥락
카카오는 Supabase 기본 제공자(`kakao`)지만 이메일 동의항목은 비즈 앱 전용이다. 네이버는 기본 제공자가 아니다. Supabase는 2026-04에 Custom OAuth/OIDC Providers(`custom:<이름>`, 순수 OAuth2 지원, `email_optional`)를 내놓았으나, 네이버 프로필 응답이 `response.{id,…}`로 한 단계 안쪽에 있어 매핑 가능 여부가 문서로 확인되지 않았다.
(출처: supabase.com/docs/guides/auth/social-login/auth-kakao, …/auth/custom-oauth-providers — 2026-10 조사)

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 카카오 = 기본 제공자, 네이버 = Supabase Custom OAuth Provider(`custom:naver`). 첫날 반나절 스파이크로 매핑 확인, 실패 시 B로 전환 | 두 제공자 모두 `signInWithOAuth` 한 경로, 우리 코드에 OAuth 처리 0 | 네이버 응답 매핑이 안 될 위험(미확인) | 낮음 | 없음 | 낮음 |
| B. 네이버만 Route Handler에서 직접 OAuth → `auth.admin`으로 사용자 생성/조회 → `generateLink(magiclink)` 해시를 서버에서 `verifyOtp`로 교환해 세션 쿠키 발급 | 응답 형식과 무관하게 동작 | 인증 코드를 직접 작성(state·CSRF 검증 필요), 서비스 키 사용 경로 증가 | 중 | 없음 | 중 |

**책방지기 권한(공통)**: `profiles.role`(`member`|`keeper`, 기본 `member`) 컬럼 + `public.is_keeper()` SQL 함수(`security definer`, `auth.uid()` 기준) 하나로 RLS·RPC·화면 가드가 모두 판정한다. 권한 부여는 Supabase SQL 편집기에서 책방지기 계정 1개에 수동 `update`(운영 절차, README). 앱에 권한 부여 화면은 없다. JWT 커스텀 클레임은 쓰지 않는다(권한 변경 즉시 반영, 설정 단순).

**외부 심사(A-10)**: 카카오는 이메일 동의항목을 쓰지 않고 "Allow users without an email"을 켜서 비즈 앱 전환 없이 진행(닉네임만 사용). 네이버는 "개발 중" 상태로 시연하고 시연 계정을 테스트 ID로 미리 등록. 운영 전환 검수는 이번 범위 밖 → 위험으로 기록(RISK-12).

## 계층 관점 설명
- [인프라] 콜백: `/auth/callback`(Route Handler, `exchangeCodeForSession`) 하나. 세션 갱신은 루트 `proxy.ts` → `lib/supabase/proxy.ts`의 `updateSession`(Next 16, Supabase SSR 가이드). 페이지 보호는 서버에서 `getClaims()`/`getUser()`로 다시 확인하며 proxy는 낙관적 리다이렉트만 한다.

## 결정
선택 **A(스파이크 실패 시 B로 자동 전환)** — 우리 코드에 OAuth를 쓰지 않는 길을 먼저 시도하고, 실패해도 B가 같은 날 안에 끝나는 크기다. 권한은 `profiles.role` + `is_keeper()`.

## 결과
- 좋아지는 점: 관리자 판별 지점 1개, 이메일 불필요
- 감수할 점: 네이버는 시연 계정만 로그인 가능(개발 중 상태)
- 후속: TKT-BE-M2-01(카카오), TKT-BE-M2-02(네이버 스파이크), TKT-DB-01(`profiles`, `is_keeper`)
