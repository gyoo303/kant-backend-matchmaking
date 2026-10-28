# ADR-002: 인증 세부 (교안 6장 1강: access·refresh JWT, 블랙리스트, 헤더 전용)
- 상태: Accepted (user, 2026-10-28) — D-021로 개정. 이전 안(쿠키·`jti`·만료 행 정리)은 폐기
- 관련 계층: [인프라] [모듈 협력 구조]
- 근거: D-020, D-021, 교안 6장 1강, 발제 §4.6, US-08~11, RISK-06, RISK-10

## 맥락
사용자가 인증·보안 설계를 교안 6장 1강에 맞추도록 정했다(D-021). 교안은 access(30분)·refresh(7일) 토큰, `token_type` 클레임, `/refresh` 재발급, refresh 토큰을 블랙리스트(메모리 `set`)에 넣는 로그아웃, `OAuth2PasswordBearer` 헤더 인증을 쓴다. 교안 그대로면 로그아웃 뒤에도 access 토큰이 만료까지 통과해 발제 §4.6·AC-10-2와 어긋나고, 메모리 블랙리스트는 재시작 때 사라진다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|
| A. 교안 구조 + 로그아웃 때 access·refresh 모두 차단, 블랙리스트는 DB에 토큰 원문, 헤더 전용 | 교안 코드와 거의 같음, AC-10-2 충족, 재시작 후에도 차단 | 블랙리스트 행이 계속 늘어남, 화면은 JS가 토큰을 다룸 | 충족 | 중 |
| B. 교안 그대로(refresh만 차단, 메모리 `set`) | 교안과 완전히 같음 | 로그아웃한 access 토큰이 만료까지 통과(AC-10-2 미충족), 재시작 시 차단 해제 | 위험 | 낮음 |
| C. 이전 안(쿠키 + `jti` + 만료 행 정리) | 서버 렌더링·리다이렉트 | 교안 밖 기술(쿠키·`jti`·정리 쿼리) | 충족 | 중 |

## 결정
A (사용자 선택, D-021).

## 계층 관점 설명
- [인프라] `src/auth/infrastructure/security.py`: 교안 3.3절과 같은 함수 — `hash_password(password)`·`verify_password(plain, hashed)`(passlib `CryptContext(schemes=["bcrypt"])`, 기존 `PasswordHasher` 클래스로 감싸도 됨), `create_access_token(data: dict) -> str`·`create_refresh_token(data: dict) -> str`(`exp`·`token_type` 추가 후 `jwt.encode(..., settings.jwt_secret_key, algorithm="HS256")`), `decode_token(token: str) -> dict`(`jwt.decode`). 만료·서명 오류는 pyjwt의 `ExpiredSignatureError`·`InvalidTokenError`.
- [모듈 협력 구조] 인증 의존성(`src/auth/presentation/dependencies.py`): `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")`(헤더 없으면 FastAPI가 401) → 응용 서비스 `authenticate(token)`: `jwt.decode`(만료·위조 → 401) → `token_type == "refresh"` → 401 → `sub` 없음 → 401 → 블랙리스트에 토큰 있음 → 401 → `find_by_login_id(sub)` 없음 → 401 → `User` 반환. 실패는 모두 `AuthenticationError`(401, `WWW-Authenticate: Bearer`).
- 로그아웃: 현재 access 토큰(헤더)과 본문의 `refresh_token`을 받아 refresh를 `decode`(실패 → 400 "유효하지 않거나 이미 만료된 토큰입니다"), 이미 차단됨 → 400 "이미 로그아웃 처리된 토큰입니다", 두 토큰을 `token_blacklist`에 저장 → commit.
- 화면: 쿠키 없음. 화면 라우트는 인증 없이 템플릿 틀만 돌려주고, `api.js`가 `localStorage`의 access 토큰을 `Authorization: Bearer`로 붙인다. 401이면 refresh로 한 번 재발급을 시도하고, 실패하면 토큰을 지우고 `/login?expired=1`로 보낸다.
- 비밀키는 환경변수(ADR-003). bcrypt는 4.0.1 고정(교안과 같음, passlib 1.7.4 호환).

## 결과
- 좋아지는 점: 교안 6장 예제를 그대로 읽으면 인증 코드를 이해할 수 있다. 쿠키·CSRF 고려가 없다.
- 감수할 점: `localStorage` 토큰은 XSS에 노출(템플릿 자동 이스케이프 유지), 블랙리스트 행 정리 없음, 비로그인 이동은 JS가 한다.
- 후속 작업: TKT-BE-M4-01~03, TKT-BE-M5-01, TKT-FE-M5-01~05
