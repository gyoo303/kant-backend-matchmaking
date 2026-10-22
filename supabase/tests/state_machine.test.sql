-- 주문 상태 전이 테스트 (AR-GATE §2 순위 2, AR-API §6.1) — TKT-DB-02
-- 표에 있는 전이 1개씩 + 표에 없는 전이 거부. 회차 전이는 TKT-DB-03에서 추가한다.
-- 결과 표 형식(AR-DB §8): 판정은 `not ok` 0줄, 마지막 줄 `1..N`. 파일 전체를 rollback한다.
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
create temp table ctx (key text primary key, id uuid);   -- 역할을 바꿔도 만든 주문·결제 id를 다시 찾는다
grant insert, select on tap, ctx to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- 준비 (postgres): 회원 A·B, 책방지기 K, 책 1권(재고 10), A의 장바구니
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';
insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock)
values ('c0000000-0000-4000-8000-000000000021', '전이 테스트 책', '작가', 10000,
        'https://picsum.photos/seed/ub-sm/600/800', '설명', 'food', '노트', 10);
insert into public.cart_items (member_id, product_id, quantity)
values ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000021', 1);

-- 회원 A: 주문 2건 만들기 (order1은 결제 대기 취소용, order2는 결제 후 전이용)
-- D-044(TKT-DB-05): 결제 대기 주문은 회원당 1건이라 order2는 order1을 취소한 뒤 만든다
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  $$ select public.create_order('{"recipientName": "김독자", "phone": "abc", "address": "대전"}'::jsonb) $$,
  'P0001', 'VALIDATION', 'AC-08-7: 연락처 형식이 틀리면 주문을 만들지 않는다');
insert into tap (line) select throws_ok(
  $$ select public.create_order('{"recipientName": "", "phone": "010-1234-5678", "address": "대전"}'::jsonb) $$,
  'P0001', 'VALIDATION', 'AC-08-7: 받는 사람이 비면 주문을 만들지 않는다');
insert into ctx select 'order1', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order1')),
  'pending_payment', '§6.1: 새 주문은 pending_payment');
insert into tap (line) select matches((select order_number from public.orders where id = (select id from ctx where key = 'order1')),
  '^UB[0-9]{6}-[0-9]{4}$', 'AR-DB §5.2: 주문 번호 형식 UBYYMMDD-NNNN');

-- 표에 없는 전이: 결제 대기 주문의 취소 요청
insert into tap (line) select throws_ok(
  format('select public.request_cancel(%L, %L::uuid)', 'order', (select id from ctx where key = 'order1')),
  'P0001', 'INVALID_STATE', '§6.1: pending_payment에서는 취소 요청할 수 없다');

-- pending_payment → cancelled (D-037), 다시 불러도 그대로
insert into tap (line) select is(
  public.cancel_pending('order', (select id from ctx where key = 'order1'))::text, 'cancelled',
  'D-037: 결제 대기 주문을 회원이 취소한다');
insert into tap (line) select is(
  public.cancel_pending('order', (select id from ctx where key = 'order1'))::text, 'cancelled',
  'D-037: 취소를 두 번 눌러도 cancelled 그대로');
insert into tap (line) select throws_ok(
  format('select public.create_payment(%L::uuid, null)', (select id from ctx where key = 'order1')),
  'P0001', 'INVALID_STATE', '§6.1: 취소된 주문은 결제를 시작할 수 없다');
insert into ctx select 'order2', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into tap (line) select isnt(
  (select order_number from public.orders where id = (select id from ctx where key = 'order1')),
  (select order_number from public.orders where id = (select id from ctx where key = 'order2')),
  'AR-DB §5.2: 주문 번호는 주문마다 다르다');
insert into ctx select 'pay2', (public.create_payment((select id from ctx where key = 'order2'), null)).id;
reset role;

-- 책방지기: 결제 전 발송 거부 (INV-04)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.ship_order(%L::uuid)', (select id from ctx where key = 'order2')),
  'P0001', 'INVALID_STATE', 'INV-04: 결제 전 주문은 발송할 수 없다');
reset role;

-- 서버: order2 결제 확정 → paid
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select is(
  public.confirm_payment(
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay2')), 'pk_sm_2', 10000) ->> 'already',
  'false', '§6.1: pending_payment → paid (confirm_payment)');
reset role;

-- 회원 A: 취소 요청 ↔ 철회 (AC-09-2·5)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is(
  public.request_cancel('order', (select id from ctx where key = 'order2'))::text, 'cancel_requested',
  'AC-09-2: paid → cancel_requested');
insert into tap (line) select is(
  public.withdraw_cancel('order', (select id from ctx where key = 'order2'))::text, 'paid',
  'AC-09-5: cancel_requested → paid (철회)');
insert into tap (line) select is(
  public.request_cancel('order', (select id from ctx where key = 'order2'))::text, 'cancel_requested',
  'AC-09-2: 다시 취소 요청');
reset role;

-- 회원 B: 남의 주문은 건드릴 수 없다
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.withdraw_cancel(%L, %L::uuid)', 'order', (select id from ctx where key = 'order2')),
  'P0001', 'NOT_FOUND', 'AC-09-4: 다른 회원의 주문은 철회할 수 없다');
insert into tap (line) select throws_ok(
  format('select public.ship_order(%L::uuid)', (select id from ctx where key = 'order2')),
  'P0001', 'FORBIDDEN', 'INV-15: 회원은 발송할 수 없다');
insert into tap (line) select throws_ok(
  format('select public.reject_cancel(%L, %L::uuid)', 'order', (select id from ctx where key = 'order2')),
  'P0001', 'FORBIDDEN', 'INV-15: 회원은 취소 요청을 거절할 수 없다');
reset role;

-- 책방지기: 취소 요청 중 발송 거부 (AC-10-4) → 거절 (AC-09-6) → 발송 (AC-10-1)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.ship_order(%L::uuid)', (select id from ctx where key = 'order2')),
  'P0001', 'CANCEL_REQUESTED', 'AC-10-4: 취소 요청 주문은 발송할 수 없다');
insert into tap (line) select is(
  public.reject_cancel('order', (select id from ctx where key = 'order2'))::text, 'paid',
  'AC-09-6: cancel_requested → paid (거절)');
insert into tap (line) select ok(
  (select cancel_rejected_at is not null from public.orders where id = (select id from ctx where key = 'order2')),
  'AC-09-6: 거절하면 cancel_rejected_at이 남는다');
reset role;

-- 회원 A: 거절 후 다시 요청하면 거절 표시가 지워진다 → 철회
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is(
  public.request_cancel('order', (select id from ctx where key = 'order2'))::text, 'cancel_requested',
  '§6.1: 거절된 주문도 다시 취소 요청할 수 있다');
insert into tap (line) select ok(
  (select cancel_rejected_at is null from public.orders where id = (select id from ctx where key = 'order2')),
  '§6.1: 새 취소 요청은 cancel_rejected_at을 지운다');
insert into tap (line) select is(
  public.withdraw_cancel('order', (select id from ctx where key = 'order2'))::text, 'paid',
  'AC-09-5: 다시 철회');
reset role;

-- 책방지기: paid → shipped, 두 번 눌러도 그대로
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is(
  public.ship_order((select id from ctx where key = 'order2'))::text, 'shipped', 'AC-10-1: paid → shipped');
insert into tap (line) select is(
  public.ship_order((select id from ctx where key = 'order2'))::text, 'shipped', 'AC-10-1: 발송을 두 번 눌러도 shipped 그대로');
insert into tap (line) select ok(
  (select shipped_at is not null from public.orders where id = (select id from ctx where key = 'order2')),
  '§6.1: 발송하면 shipped_at이 남는다');
reset role;

-- 회원 A: 발송된 주문은 취소 요청할 수 없다 (AC-09-3)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.request_cancel(%L, %L::uuid)', 'order', (select id from ctx where key = 'order2')),
  'P0001', 'INVALID_STATE', 'AC-09-3: 발송된 주문은 취소 요청할 수 없다');
insert into tap (line) select throws_ok(
  format('select public.cancel_pending(%L, %L::uuid)', 'order', (select id from ctx where key = 'order2')),
  'P0001', 'INVALID_STATE', '§6.1: 발송된 주문은 결제 대기 취소를 할 수 없다');
reset role;

-- 회원 B: 장바구니가 비면 주문을 만들 수 없다
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  $$ select public.create_order('{"recipientName": "이독자", "phone": "010-0000-0000", "address": "대전"}'::jsonb) $$,
  'P0001', 'OUT_OF_STOCK', 'SEQ-02: 살 수 있는 줄이 없으면 주문을 만들지 않는다');
reset role;

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
