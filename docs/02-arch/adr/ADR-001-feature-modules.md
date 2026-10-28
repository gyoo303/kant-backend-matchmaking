# ADR-001: 기능 폴더 분할과 기능 간 참조
- 상태: Accepted (user, 2026-10-28)
- 관련 계층: [레이어] [모듈 협력 구조]
- 근거: DRV-C-03, RISK-01, US-01~07, US-12~14, EV-01, RC-09

## 맥락
발제는 계층 간 의존만 정했다. 방 기능은 회원을 참조하고(방장·참가자), 방 상세·목록은 닉네임을 보여 줘야 한다(REQ-075). 기능 폴더 개수와 `rooms`가 `auth`의 회원을 참조하는 방식을 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | 평가표 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. `auth` + `rooms` 2개. `rooms` 도메인은 회원을 `user_id: int`로만 참조. 닉네임은 `rooms` 레포지토리의 조회 쿼리가 `auth.infrastructure.models.UserModel`을 읽기 전용으로 조인. 현재 회원은 `auth.presentation.dependencies.get_current_user_id` | 가장 단순, 쿼리 1번, 방향이 `rooms → auth` 하나 | `rooms` 인프라가 `auth` 모델 이름을 앎 | 낮음 — 참조 지점 2곳(의존성, 조인)으로 고정 | 충족 | 낮음 |
| B. 2개. 닉네임은 `rooms` 응용 서비스가 `auth` 응용 서비스(`get_nicknames(ids)`)를 호출 | 인프라 간 참조 없음 | 조회마다 추가 쿼리·조립 코드 | 중 — 조립 로직이 서비스에 생김 | 충족 | 중 |
| C. 2개. `rooms` 도메인이 `auth` 도메인 `User`를 import | 객체로 다룸 | 집합 경계가 섞이고 방 로딩마다 회원 로딩 | 높음 — 결합 증가 | 충족 | 높음 |

## 계층 관점 설명
[레이어] 도메인끼리는 서로 import하지 않는다. `Room`·`Participation`은 `user_id`만 가진다. [모듈 협력 구조] 기능 간 화살표는 `rooms.presentation → auth.presentation.dependencies`(현재 회원 ID)와 `rooms.infrastructure → auth.infrastructure.models`(읽기 전용 조인) 두 개이고, `auth`는 `rooms`를 import하지 않는다.

## 결정 / 추천
결정: A — 도메인 결합 없이 조회 1번으로 닉네임을 얻고, 기능 간 방향이 하나로 고정된다.

## 결과
- 좋아지는 점: 순환 참조가 생길 수 없는 구조, 조회 단순
- 감수할 점: `UserModel` 이름 변경 시 `rooms` 레포지토리도 수정
- 후속 작업: TKT-DB-02, TKT-BE-M3-01, GATE-02(역방향 `auth → rooms` import 0)
