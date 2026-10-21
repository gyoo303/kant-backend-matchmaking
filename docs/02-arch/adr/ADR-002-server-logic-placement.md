# ADR-002: 서버 로직 위치 (Server Actions / Route Handlers / DB 함수)
- 상태: Accepted (user, 2026-10-21)
- 관련 계층: [어플리케이션] [모듈 협력 구조]
- 근거: DRV-Q-01, DRV-Q-02, DRV-Q-04, RISK-01·03·05·07, INV-04~06·09·12·20

## 맥락
여러 테이블을 함께 바꾸는 작업(결제 확정 + 재고 + 장바구니, 발송 + 코드 + 재고, 탈퇴)이 많다. Supabase JS 클라이언트는 다중 문장 트랜잭션을 지원하지 않으므로 원자성을 어디서 보장할지 정해야 한다.

## 검토한 옵션
| 옵션 | 장점 | 단점 | AI 부채 영향(D2~D4) | KANT 영향 | 되돌리기 비용 |
|---|---|---|---|---|---|
| A. 모든 로직을 Server Actions에서 JS로 순차 호출 | 코드 한 언어 | 중간 실패 시 부분 반영, 경합 시 이중 반영 | 높음: INV-05·06 위반 위험 | 없음 | 중 |
| B. 화면 변경 = Server Actions, 외부 호출 수신 = Route Handlers, 다중 테이블 상태 전이 = Postgres 함수(RPC, `security definer`) | 원자성·조건부 전이를 DB가 보장, 진입점은 얇음 | SQL 함수 작성·테스트 필요 | 낮음 | 없음 | 높음 |
| C. B + Supabase Edge Functions(웹훅·PG 호출) | 서버리스 분리 | 배포 대상 2개, 비밀값 2곳 | 중: 구성 요소 증가(DRV-Q-04) | 없음 | 중 |

## 계층 관점 설명
```
브라우저 ─form→ Server Action ─→ domains/(검증·규칙) ─→ lib/data ─rpc→ Postgres 함수(트랜잭션)
PG ─redirect→ app/api/payments/*/route.ts ─→ lib/payments(PG HTTP) ─→ lib/data ─rpc→ confirm_payment
```
- [어플리케이션] Server Action은 같은 앱 화면의 변경, Route Handler는 PG 리다이렉트·웹훅·파일 다운로드(주소록)만 맡는다.
- [모듈 협력 구조] 상태 전이는 RPC 안의 `update … where status = <허용 이전 상태>`로만 일어나며, 영향 행 0이면 "이미 처리됨"으로 멱등 응답한다.

## 결정
선택 **B** — 결제·재고·코드의 원자성을 DB가 보장하고, 구성 요소는 Next 앱 + Supabase 2개로 유지한다.

## 결과
- 좋아지는 점: RISK-01·03·05를 DB 제약·조건부 갱신으로 차단, Edge Function 없음
- 감수할 점: RPC는 원격 프로젝트에서 pgTAP(`supabase test db --linked`, rollback)으로 검증(ADR-005), `security definer` 함수는 첫 줄에서 `auth.uid()`·`is_keeper()` 검사 필수(CONV-12)
- 후속: TKT-DB-03~06(RPC), TKT-BE 전체
