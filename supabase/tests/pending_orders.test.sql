-- 결제 대기 주문 재사용·대체 테스트 (D-044, INV-21, AR-DB §5.3) — TKT-DB-05
-- 결과 표 형식(AR-DB §8): 판정은 `not ok` 0줄, 마지막 줄 `1..N`. 파일 전체를 rollback한다.
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
create temp table ctx (key text primary key, id uuid);   -- 역할을 바꿔도 만든 주문·결제 id를 다시 찾는다
grant insert, select on tap, ctx to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- 준비 (postgres): 회원 A·B, 책 P(10,000원·재고 5)·Q(12,000원·재고 5), A의 장바구니 P×1, B의 장바구니 Q×1
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}');
insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock) values
  ('c0000000-0000-4000-8000-000000000051', '대기 테스트 책 P', '작가', 10000, 'https://picsum.photos/seed/ub-q1/600/800', '설명', 'nature', '노트', 5),
  ('c0000000-0000-4000-8000-000000000052', '대기 테스트 책 Q', '작가', 12000, 'https://picsum.photos/seed/ub-q2/600/800', '설명', 'local', '노트', 5);
insert into public.cart_items (member_id, product_id, quantity) values
  ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000051', 1),
  ('a0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000052', 1);

-- 회원 B: 결제 대기 주문 1건 (다른 회원 주문은 A의 주문서에 영향받지 않는다)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into ctx select 'orderB', (public.create_order(
  '{"recipientName": "이독자", "phone": "010-2222-2222", "address": "대전 B"}'::jsonb)).id;

-- 회원 A: 첫 주문서 → 결제 준비
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'o1', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A"}'::jsonb)).id;
insert into ctx select 'pay1', (public.create_payment((select id from ctx where key = 'o1'), null)).id;

-- AC-08-9: 같은 장바구니·배송지로 다시 → 같은 주문, 결제만 새로
insert into ctx select 'o1again', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A"}'::jsonb)).id;
insert into tap (line) select is((select id from ctx where key = 'o1again'), (select id from ctx where key = 'o1'),
  'AC-08-9: 같은 내용이면 결제 대기 주문을 다시 쓴다');
insert into tap (line) select is(
  (select count(*)::int from public.orders where member_id = 'a0000000-0000-4000-8000-00000000000a' and status = 'pending_payment'), 1,
  'AC-08-9: 결제 대기 주문은 1건 그대로');
insert into tap (line) select is(
  (select public.create_order('{"recipientName": " 김독자 ", "phone": "010-1111-1111", "address": "대전 A"}'::jsonb)).id,
  (select id from ctx where key = 'o1'),
  'AR-DB §5.3: 배송지 앞뒤 공백은 같은 내용으로 본다');
insert into ctx select 'pay1b', (public.create_payment((select id from ctx where key = 'o1'), null)).id;
insert into tap (line) select isnt((select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1b')),
  (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')),
  'AC-08-9: 다시 쓴 주문에는 새 결제(새 pg_order_id)가 붙는다');

-- AC-08-10: 수량을 바꾸면 이전 주문은 결제 전 취소, 새 주문 1건
reset role;
update public.cart_items set quantity = 2
where member_id = 'a0000000-0000-4000-8000-00000000000a' and product_id = 'c0000000-0000-4000-8000-000000000051';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'o2', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A"}'::jsonb)).id;
insert into tap (line) select isnt((select id from ctx where key = 'o2'), (select id from ctx where key = 'o1'),
  'AC-08-10: 수량이 다르면 새 주문을 만든다');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'o1')),
  'cancelled', 'AC-08-10: 이전 결제 대기 주문은 결제 전 취소');
insert into tap (line) select is((select total_amount from public.orders where id = (select id from ctx where key = 'o2')),
  20000, 'AC-08-10: 새 주문 합계는 지금 장바구니 기준');

-- 배송지가 다르면 대체
insert into ctx select 'o3', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A 2층"}'::jsonb)).id;
insert into tap (line) select ok(
  (select id from ctx where key = 'o3') <> (select id from ctx where key = 'o2')
  and (select status::text from public.orders where id = (select id from ctx where key = 'o2')) = 'cancelled',
  'AC-08-10: 배송지가 다르면 이전 주문은 결제 전 취소, 새 주문');

-- 책 가격이 바뀌면 대체 (주문 항목은 가격 사본)
reset role;
update public.products set price = 11000 where id = 'c0000000-0000-4000-8000-000000000051';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'o4', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A 2층"}'::jsonb)).id;
insert into tap (line) select ok(
  (select id from ctx where key = 'o4') <> (select id from ctx where key = 'o3')
  and (select total_amount from public.orders where id = (select id from ctx where key = 'o4')) = 22000,
  'AR-DB §5.3: 가격이 바뀌면 같은 내용이 아니다');
insert into tap (line) select is(
  (select count(*)::int from public.orders where member_id = 'a0000000-0000-4000-8000-00000000000a' and status = 'pending_payment'), 1,
  'INV-21: 몇 번을 바꿔도 결제 대기 주문은 1건');

-- 살 수 있는 줄이 없으면 결제 대기 주문을 건드리지 않는다
reset role;
-- (postgres로 읽는다: 회원 A는 RLS로 B의 주문을 볼 수 없다)
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'orderB')),
  'pending_payment', 'INV-21: 다른 회원의 결제 대기 주문은 그대로');
update public.products set stock = 0 where id = 'c0000000-0000-4000-8000-000000000051';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  $$ select public.create_order('{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A 2층"}'::jsonb) $$,
  'P0001', 'OUT_OF_STOCK', 'SEQ-02: 살 수 있는 줄이 없으면 주문을 만들지 않는다');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'o4')),
  'pending_payment', 'AR-DB §5.3: 품절로 막히면 기존 결제 대기 주문은 그대로');
reset role;
update public.products set stock = 5 where id = 'c0000000-0000-4000-8000-000000000051';

-- 결제 2개가 붙은 재사용 주문: 먼저 확정된 결제만 반영, 나중 결제는 거부 (AR-DB §5.3)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'payA', (public.create_payment((select id from ctx where key = 'o4'), null)).id;
insert into tap (line) select is(
  (select public.create_order('{"recipientName": "김독자", "phone": "010-1111-1111", "address": "대전 A 2층"}'::jsonb)).id,
  (select id from ctx where key = 'o4'), 'AC-08-9: 결제창을 닫고 다시 → 같은 주문');
insert into ctx select 'payB', (public.create_payment((select id from ctx where key = 'o4'), null)).id;
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select public.confirm_payment((select pg_order_id from public.payments where id = (select id from ctx where key = 'payA')), 'pk_pending_a', 22000);
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'o4')),
  'paid', 'SEQ-03: 먼저 확정된 결제로 주문 접수');
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 22000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'payB')), 'pk_pending_b'),
  'P0001', 'INVALID_STATE', 'AR-DB §5.3: 같은 주문의 나중 결제는 확정되지 않는다(BE 보상 취소)');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000051'),
  3, 'INV-05: 재고는 한 번만 줄었다(5 → 3)');

-- 대체로 취소된 주문의 결제가 뒤늦게 성공해도 확정되지 않는다
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 10000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_pending_1'),
  'P0001', 'INVALID_STATE', 'AR-DB §5.3: 결제 전 취소된 주문의 결제는 확정되지 않는다(BE 보상 취소)');
reset role;

-- INV-21을 DB 제약으로 보장: 결제 대기 주문 2건째는 직접 넣어도 거부
insert into tap (line) select throws_ok(
  $$ insert into public.orders (order_number, member_id, total_amount, ship_recipient_name, ship_phone, ship_address)
     values ('UB000000-Z001', 'a0000000-0000-4000-8000-00000000000b', 1000, '이독자', '010-2222-2222', '대전 B') $$,
  '23505', null, 'INV-21: orders_one_pending_per_member가 결제 대기 주문 2건째를 막는다');

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
