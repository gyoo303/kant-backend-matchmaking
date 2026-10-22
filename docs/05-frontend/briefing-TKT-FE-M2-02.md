---
stage: FE
tickets: [TKT-FE-M2-02]
status: done
inputs_read: [AR-MAP, AR-HAND, AR-API, AR-CONV, AR-GATE, PM-SCR, PM-AC, BE-BRIEF, UX-DESIGN, UX-DEC, UX-CTX-FE, UX-PLAN-FE, FE-BRIEF]
next_readers: [QA, UX]
---
# [책 관리] TKT-FE-M2-02 `/admin/products`, `/new`, `/[id]`
결론: 수용 기준 AC-06-1~5 중 AC-06-3·4는 충족, AC-06-1·2는 저장 흐름을 실제로 돌려 보지 못함, AC-06-5는 TKT-FE-M2-01 틀로 처리 · 실제 API(`saveProduct`) 연결

## 사람이 결정할 것
- 없음

## 이해 가이드
- 목록: `app/admin/products/page.tsx`가 `getProducts()`(API-01, 공개 조회·`'use cache'`)로 전체 책을 그린다. 권한은 `app/admin/layout.tsx`(`requireKeeper`).
- 등록·수정: `components/ProductForm.tsx`(client)가 `onSubmit`에서 `FormData`를 만들어 BE `saveProduct(formData)`(API-04)를 부른다. 수정이면 `id`를 붙인다. 성공: 새 책은 `/admin/products/<id>?saved=1`로 이동해 "저장했어요", 수정은 같은 화면에 "저장했어요" + `router.refresh()`. 실패: `fieldErrors`를 칸 아래에, 첫 오류 칸으로 포커스.
- 저장 뒤 목록·상세 갱신은 BE 액션의 `updateTag('products')`·`revalidatePath('/admin/products')`가 한다.
- 먼저 읽을 파일: `components/ProductForm.tsx` — 폼 상태·오류 / `components/FormField.tsx` — 라벨·오류 연결(UX-15) / `app/admin/products/[id]/page.tsx` — 수정 화면

## 수용 기준
| 번호 | 내용 | 충족 | 근거 |
|---|---|---|---|
| AC-06-1 | 필수 항목 넣고 새 책 저장 → 목록·상세에 보임 | 미검증 | 책방지기 세션이 없어 실제 저장을 못 함. 저장 뒤 `updateTag('products')`로 목록·상세 캐시가 바뀌는 것은 BE 코드로 확인 |
| AC-06-2 | 재고 0으로 수정 → 목록·상세 "품절", 담기 막힘 | 부분 | 목록의 재고 0 행에 품절 배지(`SCR-08-admin-products-*.png`, 4번 책), 상세 비활성은 TKT-FE-03에서 확인. 수정 저장 자체는 못 함 |
| AC-06-3 | 삭제 버튼 없음 | 충족 | 목록·폼에 삭제 없음 + 목록 아래 "책을 지우는 기능은 없어요…" |
| AC-06-4 | 가격 `-1000`·재고 `1.5` → 저장 안 됨, 해당 칸에 이유 | 충족(미리보기) | 가짜 액션이 BE와 같은 모양의 `fieldErrors`를 돌려줄 때: 가격 칸 `aria-invalid`, `aria-describedby="price-error"`, 이유 문구, 포커스 이동, 입력값 `-1000` 유지(`SCR-08-admin-product-form-error-*.png`). 문구는 BE 스키마(`product.schema.ts`)가 정한다 |
| AC-06-5 | 비관리자에게 관리자 화면 안 보임 | TKT-FE-M2-01 | `app/admin/layout.tsx` |
| UX-15 | 오류는 칸 바로 아래 `--destructive`, `aria-invalid`, `aria-describedby` | 충족(미리보기) | 위 DOM 확인 |
| UX-11 | 기본 버튼 1개 | 충족 | 목록 [새 책 등록], 폼 [저장] |

"충족(미리보기)"는 TKT-FE-M2-01 브리핑과 같은 방법(커밋하지 않은 임시 경로 + 가짜 액션)이다.

## 선택과 이유
- 폼은 React form action 대신 `onSubmit` + `useTransition`: form action은 제출 뒤 입력칸을 비워서, 오류가 나면 입력값이 사라진다(체크리스트 "에러가 나도 입력값 유지").
- 제출 중에는 [저장]을 막아 중복 요청을 보내지 않는다. 숫자 칸은 `type="number"`지만 `noValidate`로 브라우저 검사를 끄고 서버 이유 문구를 보인다(AC-06-4의 `1.5`를 브라우저가 먼저 막지 않게).
- 테마는 라디오 4개를 알약 모양 라벨로 감쌌다(`has-checked:`). 키보드 포커스는 `has-focus-visible:`로 라벨에 3px 링.
- 긴 글 칸(책방지기 노트·출판사 소개)은 `components/ui`에 textarea가 없어 `Input`과 같은 모양의 클래스를 `components/FormField.tsx`에 두었다(design-system §5).
- 360px 목록에서 테마 칸을 숨겼다. 시안 360px는 제목·"고치기"가 한 글자씩 접힌다. 가격·재고·고치기는 줄바꿈 금지.
- 새 책 저장 뒤 수정 화면으로 보낸다(`?saved=1`). 같은 폼을 다시 보여 주면 같은 책을 두 번 만들기 쉽다.

## 알려진 위험
| 위험 | 이번에 한 대응 | 남은 것 |
|---|---|---|
| 실제 저장·표지 업로드를 돌려 보지 못함 | 액션 입력 이름은 BE 브리핑 목록과 같게(`id`, `name`, `author`, `price`, `theme`, `description`, `keeperNote`, `publisherDescription`, `stock`, `cover`) | 책방지기 계정으로 QA-M2 |
| 수정 화면이 공개 캐시(`getProduct`)를 읽는다 | 저장 시 BE가 `updateTag('products')` | — |
| 표지 5MB·형식 검사는 서버에서만 | 오류는 `cover` 칸 아래 | 큰 파일은 업로드 뒤에야 거절됨 |

## 검증 결과
- GATE-01 오류 0 / GATE-02 오류 0 / GATE-03 tests 76, pass 76, fail 0 / GATE-04 종료 0
- GATE-05 0줄 / GATE-06 0줄 / UX-1 새 파일 0건 / UX-5·19 0건
- 스크린샷: `SCR-08-admin-products-*.png`(실제 책 데이터), `SCR-08-admin-product-edit-*.png`(저장 완료 표시), `SCR-08-admin-product-form-error-*.png`(가격·표지 오류)
- audit: 새 의존성 없음 — 해당 없음

## 명세와 다르게 한 것
- "짧은 설명" 라벨: 시안은 "(목록 카드에 보여요)"지만 ProductCard는 설명을 보이지 않는다(PM-SCR §2). 실제로 보이는 곳에 맞춰 "(상세 화면 정보 칸에 보여요)"로 썼다.
- 표지 칸 도움말에 수정 화면용 문장 "새 이미지를 고르지 않으면 지금 표지를 그대로 써요"를 더했고, 지금 표지를 작게 보여 준다.
- 재고 칸 도움말 "0으로 두면 품절로 보이고 담을 수 없어요", 빈 목록 "아직 등록한 책이 없어요…", 로딩·저장 중 문구는 명세에 없는 문구다.
- 360px 목록의 테마 칸 숨김(위 "선택과 이유").

## 기록 필요
- 360px 책 관리 목록에서 테마 칸을 숨긴 판단.

## 변경 범위
- 추가: `app/admin/products/page.tsx`, `app/admin/products/new/page.tsx`, `app/admin/products/[id]/page.tsx`, `components/ProductForm.tsx`, `components/FormField.tsx`, 이 브리핑, 스크린샷
- `FormField`는 SCR-07·10 등 다른 폼에서도 쓸 공통 컴포넌트다
- 새 의존성 없음

## 확인하지 못한 것
- 실제 새 책 저장·수정·표지 업로드(AC-06-1·2)
- 재고 `1.5` 입력의 실제 서버 응답(스키마 단위 테스트는 BE의 `product.schema.test.ts`에 있음)
