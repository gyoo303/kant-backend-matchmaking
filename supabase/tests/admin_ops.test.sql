-- 관리자 운영·탈퇴 테스트 (AR-GATE §2 순위 4, INV-17, AR-DB §7) — TKT-DB-04
-- 결과 표 형식(AR-DB §8): 판정은 `not ok` 0줄, 마지막 줄 `1..N`. 파일 전체를 rollback한다.
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
create temp table ctx (key text primary key, payload jsonb);
grant insert, select on tap, ctx to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- 준비 (postgres): A 탈퇴할 회원, B paid 주문(탈퇴 막힘), C 주소록 대상, D 취소 요청 회차·읽는 중(탈퇴 막힘), K 책방지기
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}'),
  ('a0000000-0000-4000-8000-0000000000c1', 'member-c@test.local', '{}'),
  ('a0000000-0000-4000-8000-0000000000d1', 'member-d@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';
insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock)
values ('c0000000-0000-4000-8000-000000000041', '운영 테스트 책', '작가', 12000,
        'https://picsum.photos/seed/ub-ops/600/800', '설명', 'nature', '노트', 5);

-- 구독 (회차가 결제 확정 상태가 되려면 구독 연결이 필요하다)
insert into public.subscriptions (id, member_id) values
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a'),
  ('f0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1'),
  ('f0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d1');

-- 주문: A 결제 대기, B paid, C paid·cancel_requested·shipped
insert into public.orders (id, order_number, member_id, status, total_amount, ship_recipient_name, ship_phone, ship_address) values
  ('d0000000-0000-4000-8000-0000000000a1', 'UB000000-A001', 'a0000000-0000-4000-8000-00000000000a', 'pending_payment', 12000, '김탈퇴', '010-1111-1111', '대전 A'),
  ('d0000000-0000-4000-8000-0000000000b1', 'UB000000-B001', 'a0000000-0000-4000-8000-00000000000b', 'paid', 12000, '이결제', '010-2222-2222', '대전 B'),
  ('d0000000-0000-4000-8000-0000000000c1', 'UB000000-C001', 'a0000000-0000-4000-8000-0000000000c1', 'paid', 24000, '박수령', '010-3333-3333', '대전 C 결제 시점'),
  ('d0000000-0000-4000-8000-0000000000c2', 'UB000000-C002', 'a0000000-0000-4000-8000-0000000000c1', 'cancel_requested', 12000, '박수령', '010-3333-3333', '대전 C'),
  ('d0000000-0000-4000-8000-0000000000c3', 'UB000000-C003', 'a0000000-0000-4000-8000-0000000000c1', 'shipped', 12000, '박수령', '010-3333-3333', '대전 C');
insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
values ('d0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-000000000041', '운영 테스트 책', 12000, 2);

-- 회차: A 결제 대기 + 언박싱(답장·엽서·메모·편지), C 읽는 중·발송됨, D 읽는 중 + 취소 요청 표시
insert into public.subscription_rounds (id, member_id, subscription_id, status, ship_recipient_name, ship_phone, ship_address, paid_at, cancel_requested_at) values
  ('e0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', null, 'pending_payment', '김탈퇴', '010-1111-1111', '대전 A', null, null),
  ('e0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-00000000000a', 'unboxed', '김탈퇴', '010-1111-1111', '대전 A', now(), null),
  ('e0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-0000000000c1', 'reading', '박수령', '010-3333-3333', '대전 C 회차 시점', now(), null),
  ('e0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-0000000000c1', 'shipped', '박수령', '010-3333-3333', '대전 C', now(), null),
  ('e0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-0000000000d1', 'f0000000-0000-4000-8000-0000000000d1', 'reading', '최취소', '010-4444-4444', '대전 D', now(), now());
insert into public.reader_letters (round_id, member_id, body) values
  ('e0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', '결제 대기 중인 편지입니다.'),
  ('e0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', '언박싱까지 마친 편지입니다.');
insert into public.round_contents (round_id, product_id, reply_letter, postcard_path) values
  ('e0000000-0000-4000-8000-0000000000a2', 'c0000000-0000-4000-8000-000000000041', '답장입니다.',
   'rounds/e0000000-0000-4000-8000-0000000000a2/postcard.jpg'),
  ('e0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-000000000041', '답장 초안', null);
insert into public.shelf_memos (round_id, member_id, body)
values ('e0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', '다시 읽고 싶은 책');
insert into public.farewell_notes (subscription_id, member_id, body)
values ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', '고마웠어요');
insert into public.cart_items (member_id, product_id, quantity)
values ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000041', 1);
insert into public.shipping_addresses (member_id, recipient_name, phone, address)
values ('a0000000-0000-4000-8000-00000000000a', '김탈퇴', '010-1111-1111', '대전 A');

-- 회원: 주소록·할 일 수는 받을 수 없다 (AC-19-3)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
insert into tap (line) select throws_ok($$ select * from public.list_shipping_targets() $$,
  'P0001', 'FORBIDDEN', 'AC-19-3: 일반 회원은 주소록을 받을 수 없다');
insert into tap (line) select throws_ok($$ select public.keeper_counts() $$,
  'P0001', 'FORBIDDEN', 'INV-15: 일반 회원은 관리자 할 일 수를 볼 수 없다');
insert into tap (line) select throws_ok(
  $$ insert into public.shipping_list_downloads (keeper_id, row_count) values ('a0000000-0000-4000-8000-0000000000c1', 1) $$,
  '42501', null, 'ADR-007: 일반 회원은 다운로드 기록을 남길 수 없다');
reset role;

-- 책방지기: 주소록 대상 (INV-17, AC-19-1·4), 할 일 수 (SCR-20), 다운로드 기록 (ADR-007)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is(
  (select count(*)::int from public.list_shipping_targets() t where t.recipient_name = '박수령'),
  2, 'AC-19-1: paid 주문 1건 + 읽는 중 회차 1건만(취소 요청·발송된 건 제외)');
insert into tap (line) select is(
  (select t.address from public.list_shipping_targets() t where t.target_id = 'd0000000-0000-4000-8000-0000000000c1'),
  '대전 C 결제 시점', 'AC-19-1: 결제 시점 배송지 사본으로 담긴다');
insert into tap (line) select is(
  (select t.books from public.list_shipping_targets() t where t.target_id = 'd0000000-0000-4000-8000-0000000000c1'),
  '운영 테스트 책 × 2', 'SEQ-11: 주문은 책 이름 × 수량');
insert into tap (line) select is(
  (select t.books from public.list_shipping_targets() t where t.target_id = 'e0000000-0000-4000-8000-0000000000c1'),
  '운영 테스트 책', 'SEQ-11: 회차는 매칭한 책 이름');
insert into tap (line) select is(
  (select count(*)::int from public.list_shipping_targets() t where t.recipient_name = '최취소'),
  0, 'AC-19-4: 취소 요청 표시가 있는 읽는 중 회차는 빠진다');
insert into tap (line) select is(
  (select count(*)::int from public.list_shipping_targets() t where t.recipient_name = '김탈퇴'),
  0, 'INV-17: 결제 대기 주문·회차는 빠진다');
-- 원격 DB는 시연 데이터와 공용(RISK-16)이라 숫자는 같은 조건의 직접 집계와 비교한다
insert into tap (line) select is((public.keeper_counts() ->> 'ordersToShip')::int,
  (select count(*)::int from public.orders where status = 'paid' and member_id is not null),
  'SCR-20: 발송 대기 주문 수(paid)');
insert into tap (line) select ok((public.keeper_counts() ->> 'ordersToShip')::int >= 2, 'SCR-20: 테스트의 paid 주문 2건이 세어진다');
insert into tap (line) select is((public.keeper_counts() ->> 'cancelRequests')::int,
  (select count(*)::int from public.orders where status = 'cancel_requested' and member_id is not null)
  + (select count(*)::int from public.subscription_rounds where cancel_requested_at is not null and member_id is not null),
  'SCR-20: 취소 요청 수(주문 + 회차 표시)');
insert into tap (line) select ok((public.keeper_counts() ->> 'cancelRequests')::int >= 2, 'SCR-20: 테스트의 취소 요청 2건이 세어진다');
insert into tap (line) select is((public.keeper_counts() ->> 'arrivedLetters')::int,
  (select count(*)::int from public.subscription_rounds where status = 'arrived'),
  'SCR-20: 도착한 편지 수(arrived)');
insert into tap (line) select lives_ok(
  $$ insert into public.shipping_list_downloads (keeper_id, row_count) values ('a0000000-0000-4000-8000-00000000000c', 3) $$,
  'ADR-007: 책방지기는 다운로드 기록을 남긴다');
insert into tap (line) select throws_ok(
  $$ insert into public.shipping_list_downloads (keeper_id, row_count) values ('a0000000-0000-4000-8000-0000000000c1', 3) $$,
  '42501', null, 'ADR-007: 다른 사람 이름으로 기록할 수 없다');
insert into tap (line) select is((select count(*)::int from public.shipping_list_downloads
    where keeper_id = 'a0000000-0000-4000-8000-00000000000c'), 1, 'ADR-007: 책방지기는 기록을 본다');
reset role;

-- 회원 C: 다운로드 기록은 보이지 않는다
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.shipping_list_downloads), 0, 'RLS: 회원은 다운로드 기록 0행');
reset role;

-- 탈퇴 거부 (AC-05-9 paid 주문, AC-05-7 읽는 중 회차)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select throws_ok($$ select public.withdraw_member() $$,
  'P0001', 'WITHDRAW_BLOCKED', 'AC-05-9: 주문 접수(paid) 주문이 있으면 탈퇴할 수 없다');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000d1", "role": "authenticated"}';
insert into tap (line) select throws_ok($$ select public.withdraw_member() $$,
  'P0001', 'WITHDRAW_BLOCKED', 'AC-05-7: 읽는 중 회차가 있으면 탈퇴할 수 없다');
reset role;

-- 회원 A 탈퇴 (AC-05-4·8)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'withdraw', public.withdraw_member();
reset role;
insert into tap (line) select is(
  (select payload -> 'postcardPaths' from ctx where key = 'withdraw'),
  '["rounds/e0000000-0000-4000-8000-0000000000a2/postcard.jpg"]'::jsonb,
  'SEQ-10: 삭제할 엽서 경로를 돌려준다');
insert into tap (line) select is((select status::text from public.orders where id = 'd0000000-0000-4000-8000-0000000000a1'),
  'cancelled', 'AC-05-8: 결제 대기 주문은 취소된다');
insert into tap (line) select is((select status::text from public.subscription_rounds where id = 'e0000000-0000-4000-8000-0000000000a1'),
  'cancelled', 'AC-05-8: 결제 대기 회차는 취소된다');
insert into tap (line) select is((select count(*)::int from public.shipping_addresses where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  0, 'AC-05-4: 기본 배송지 삭제');
insert into tap (line) select is((select count(*)::int from public.cart_items where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  0, 'AC-05-4: 장바구니 삭제');
insert into tap (line) select is((select count(*)::int from public.reader_letters
    where round_id in ('e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a2')),
  0, 'AC-05-4: 손편지 삭제');
insert into tap (line) select is((select count(*)::int from public.round_contents where round_id = 'e0000000-0000-4000-8000-0000000000a2'),
  0, 'AC-05-4: 답장·엽서 경로 삭제');
insert into tap (line) select is((select count(*)::int from public.shelf_memos where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  0, 'AC-05-4: 서가 메모 삭제');
insert into tap (line) select is((select count(*)::int from public.farewell_notes where subscription_id = 'f0000000-0000-4000-8000-00000000000a'),
  0, 'AC-05-4: 작별 안부 삭제');
insert into tap (line) select is((select count(*)::int from public.orders where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  0, 'PM-DOMAIN §7: 주문은 회원 연결을 끊는다');
insert into tap (line) select is((select count(*)::int from public.orders where id = 'd0000000-0000-4000-8000-0000000000a1'),
  1, 'PM-DOMAIN §7: 거래 기록(주문)은 보관한다');
insert into tap (line) select is((select count(*)::int from public.subscription_rounds where id in ('e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a2') and member_id is null),
  2, 'PM-DOMAIN §7: 회차는 연결을 끊고 보관한다');
insert into tap (line) select is((select status::text from public.subscriptions where id = 'f0000000-0000-4000-8000-00000000000a'),
  'ended', 'AR-DB §7: 활성 구독은 마무리된다');
insert into tap (line) select ok((select member_id is null from public.subscriptions where id = 'f0000000-0000-4000-8000-00000000000a'),
  'PM-DOMAIN §7: 구독은 회원 연결을 끊는다');
insert into tap (line) select is((select count(*)::int from public.orders where id = 'd0000000-0000-4000-8000-0000000000c1' and member_id is not null),
  1, 'AR-DB §7: 다른 회원의 데이터는 그대로');

-- 탈퇴한 회원의 거래 기록은 책방지기 목록·주소록에 나오지 않는다 (PM-DOMAIN §7)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.orders where id = 'd0000000-0000-4000-8000-0000000000a1'),
  0, 'PM-DOMAIN §7: 탈퇴 회원의 주문은 책방지기 목록에 없다');
reset role;

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
