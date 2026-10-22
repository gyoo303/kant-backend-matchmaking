---
stage: FE
tickets: [TKT-FE-M5-01]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-CONV, AR-GATE, AR-ADR, PM-AC, PM-DOMAIN, DB-BRIEF, BE-BRIEF, FE-BRIEF]
next_readers: [QA, UX]
exception: { blocked: [QA-BRIEF], approved_by: user, date: 2026-10-22, read_instead: [DB-BRIEF, BE-BRIEF, FE-BRIEF] }
---
# [README] TKT-FE-M5-01 `README.md`
결론: HANDOFF 확정 목차 7개 섹션을 모두 채웠다(AC-21-1). 깨끗한 클론 실행(AC-21-2)은 QA-M5 확인 대상

## 사람이 결정할 것
- 없음

## 절차 예외
- 막힌 입력: `docs/06-qa/briefing-TKT-QA-M4.md`(QA-BRIEF, 선행 TKT-QA-M4). QA 단계가 아직 진행되지 않았다.
- 승인: 사용자, 2026-10-22("TKT-FE-M5-01 진행하고 푸쉬해").
- 이 티켓에 QA 브리핑이 꼭 필요하지 않은 이유: README 내용(실행·설정·결제·운영 절차)은 DB·BE·FE 브리핑과 설계 문서에서 온다. QA 결과가 바꿀 수 있는 곳은 "결과 캡처"뿐이라, 캡처마다 실제 화면인지 예시 데이터 화면인지 README에 밝혔다. QA가 끝나면 캡처를 검증된 화면으로 바꿀 수 있다.
- 대신 읽은 것: DB 브리핑(환경·연결·대시보드), BE 브리핑(결제·로그인), FE 브리핑(화면·스크린샷), AR-DB §7, PM-DOMAIN §7(보관 기간).

## 이해 가이드
- README 목차 = HANDOFF "README 목차 (확정)": 1 소개 / 2 컴포넌트 트리 / 3 로컬 실행 / 4 환경변수·Supabase 설정 / 5 결제 테스트 / 6 운영 절차 / 7 결과 캡처. 소개 섹션 안에 화면 목록·흐름 표를 같이 두어 섹션 번호를 하나 당겼다(1 소개 + 화면과 흐름).

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-21-1 | 소개·컴포넌트 텍스트 트리·실행 명령·환경 변수 이름·화면 캡처 | 충족 | README 1·2·3·4·7절 |
| KANT-R10·C17 | README(소개, 컴포넌트 트리, 실행 명령, 캡처) | 충족 | 같음 |
| AC-21-2 | 깨끗한 클론에서 README 명령대로 메인이 열림 | 미검증 | QA-M5 범위. 명령은 이 저장소에서 쓰던 그대로다 |

## 선택과 이유
- **5년 경과 거래 기록 삭제 SQL**: 설계(AR-DB §7)는 "README 운영 절차로" 한 줄만 있고 SQL이 없어 FK 순서대로 썼다. 결제(`payments.order_id`·`round_id`가 `on delete restrict`) → 주문(항목 cascade) → 회차(편지·답장·코드·메모 cascade) → 끝난 구독. 원격 DB에서 `begin … rollback`으로 실행해 문법·제약 오류가 없음을 확인했다(대상 0건). 엽서 Storage 파일은 SQL로 지워지지 않아 따로 지우라고 적었다.
- 책방지기 권한 SQL은 `profiles.role = 'keeper'`(AR-DB §2·§4)로 썼다.
- 토스 테스트 카드 번호는 README에 적지 않고 토스페이먼츠 개발자센터 문서를 따르라고 했다. 값이 바뀔 수 있는 외부 정보라서다.
- Node 요구 버전은 설치된 Next 16.4.2의 `engines`(`>=20.9.0`)를 따랐다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 네이버 로그인은 BE 스파이크(TKT-BE-M2-02)가 끝나지 않았다 | 설정 절차는 BE 브리핑 그대로 | 스파이크 결과에 따라 4절 갱신 |
| 회원·책방지기 화면 캡처가 예시 데이터 | README에 명시 | QA 뒤 실제 화면으로 교체 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0 / GATE-05 0줄
- README의 파일 경로·이미지 경로 모두 존재 확인, `.env.example` 변수 8개와 표 일치
- 운영 SQL: 원격 DB `db query --linked`로 `begin … rollback` 실행, 오류 0

## 명세와 다르게 한 것
- 목차 1절에 화면 목록·편지 구독 흐름 표를 더했다(소개를 돕는 내용, 섹션 순서는 그대로).

## 기록 필요
- 없음

## 변경 범위
- 수정: `README.md`(create-next-app 기본 문구 → 프로젝트 설명서)
- 추가: 이 브리핑
- 새 의존성 없음

## 확인하지 못한 것
- 깨끗한 클론에서 `npm install` → `npm run dev` 실행(AC-21-2)
