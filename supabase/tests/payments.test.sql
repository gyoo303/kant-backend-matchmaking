-- 결제 확정·환불 멱등성 테스트 (AR-GATE §2 순위 3, SEQ-03·08) — TKT-DB-02
-- 결과 표 형식(AR-DB §8): 판정은 `not ok` 0줄, 마지막 줄 `1..N`. 파일 전체를 rollback한다.
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
create temp table ctx (key text primary key, id uuid);
grant insert, select on tap, ctx to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- 준비 (postgres): 회원 A, 책방지기 K, 책 P1(15,000원·재고 3)·P2(15,000원·재고 2), A의 장바구니 P1×2 + P2×1 = 45,000원
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';
insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock) values
  ('c0000000-0000-4000-8000-000000000011', '결제 테스트 책 1', '작가', 15000, 'https://picsum.photos/seed/ub-p1/600/800', '설명', 'nature', '노트', 3),
  ('c0000000-0000-4000-8000-000000000012', '결제 테스트 책 2', '작가', 15000, 'https://picsum.photos/seed/ub-p2/600/800', '설명', 'ecology', '노트', 2);
insert into public.cart_items (member_id, product_id, quantity) values
  ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000011', 2),
  ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000012', 1);

-- 회원 A: 주문·결제 준비
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'order1', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into ctx select 'pay1', (public.create_payment((select id from ctx where key = 'order1'), null)).id;
insert into tap (line) select is((select total_amount from public.orders where id = (select id from ctx where key = 'order1')),
  45000, 'SEQ-02: 주문 합계는 서버가 계산한다(45,000원)');
insert into tap (line) select is((select count(*)::int from public.order_items where order_id = (select id from ctx where key = 'order1')),
  2, 'SEQ-02: 장바구니 줄이 주문 줄로 복사된다');
insert into tap (line) select is((select amount from public.payments where id = (select id from ctx where key = 'pay1')),
  45000, 'NFR-19: 결제 금액은 주문 합계(서버 값)');
insert into tap (line) select matches((select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')),
  '^ub[0-9a-f]{32}$', '04 §7: pg_order_id는 DB가 만든다(ub + 32자)');
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 45000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_hack'),
  '42501', null, 'ADR-004: 회원은 결제를 확정할 수 없다(서버 전용)');
reset role;

-- 서버: 금액 불일치 (AC-08-8)
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 1000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_test_1'),
  'P0001', 'AMOUNT_MISMATCH', 'AC-08-8: 승인 금액이 1,000원이면 확정하지 않는다');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000011'),
  3, 'AC-08-8: 금액이 다르면 재고는 그대로');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order1')),
  'pending_payment', 'AC-08-8: 금액이 다르면 주문은 결제 대기 그대로');

-- 서버: 같은 확정 2회 (AC-08-6)
insert into tap (line) select is(
  public.confirm_payment(
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_test_1', 45000) ->> 'already',
  'false', 'AC-08-6: 첫 확정');
insert into tap (line) select is(
  public.confirm_payment(
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_test_1', 45000) ->> 'already',
  'true', 'AC-08-6: 두 번째 확정은 already');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000011'),
  1, 'AC-08-6: 재고는 한 번만 줄어든다(P1 3→1)');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000012'),
  1, 'AC-08-6: 재고는 한 번만 줄어든다(P2 2→1)');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order1')),
  'paid', '§6.1: 확정하면 주문 paid');
insert into tap (line) select is((select status::text from public.payments where id = (select id from ctx where key = 'pay1')),
  'paid', '§6.3: 결제 ready → paid');
insert into tap (line) select is((select count(*)::int from public.cart_items where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  0, '§6.1: 확정하면 장바구니 해당 줄이 지워진다');
insert into tap (line) select is((select recipient_name from public.shipping_addresses where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  '김독자', '§6.1: 확정하면 기본 배송지를 저장한다');
reset role;

-- 재고 부족 (AC-08-5): P1 재고 1에 2권 주문
insert into public.cart_items (member_id, product_id, quantity)
values ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000011', 2);
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'order2', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into ctx select 'pay2', (public.create_payment((select id from ctx where key = 'order2'), null)).id;
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 30000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay2')), 'pk_test_2'),
  'P0001', 'OUT_OF_STOCK', 'AC-08-5: 재고가 모자라면 확정하지 않는다');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000011'),
  1, 'AC-08-5: 재고 부족이면 재고는 그대로');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order2')),
  'pending_payment', 'AC-08-5: 재고 부족이면 주문은 결제 대기 그대로');
insert into tap (line) select lives_ok(
  format('select public.fail_payment(%L, %L)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay2')), 'OUT_OF_STOCK'),
  'SEQ-03: 보상 후 fail_payment');
insert into tap (line) select is((select status::text from public.payments where id = (select id from ctx where key = 'pay2')),
  'failed', '§6.3: 결제 ready → failed');
reset role;

-- 환불 2회 클릭 (AC-10-5)과 환불 완료 (AC-10-2)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is(
  public.request_cancel('order', (select id from ctx where key = 'order1'))::text, 'cancel_requested',
  'AC-10-2: 환불 전 취소 요청');
insert into tap (line) select throws_ok(
  format('select public.begin_refund(%L, %L::uuid)', 'order', (select id from ctx where key = 'order1')),
  'P0001', 'FORBIDDEN', 'INV-15: 회원은 환불을 시작할 수 없다');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is(
  (public.begin_refund('order', (select id from ctx where key = 'order1'))).status::text, 'refunding',
  'AC-10-2: 결제 paid → refunding');
insert into tap (line) select throws_ok(
  format('select public.begin_refund(%L, %L::uuid)', 'order', (select id from ctx where key = 'order1')),
  'P0001', 'ALREADY_PROCESSING', 'AC-10-5: [환불] 두 번째 클릭은 처리 중');
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select lives_ok(
  format('select public.complete_refund(%L::uuid)', (select id from ctx where key = 'pay1')), 'AC-10-2: 환불 완료');
insert into tap (line) select lives_ok(
  format('select public.complete_refund(%L::uuid)', (select id from ctx where key = 'pay1')), 'AC-10-5: 환불 완료를 두 번 불러도 오류 없음');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000011'),
  3, 'AC-10-2·5: 재고는 한 번만 복구된다(P1 1→3)');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000012'),
  2, 'AC-10-2·5: 재고는 한 번만 복구된다(P2 1→2)');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order1')),
  'refunded', '§6.1: cancel_requested → refunded');
insert into tap (line) select is((select status::text from public.payments where id = (select id from ctx where key = 'pay1')),
  'refunded', '§6.3: 결제 refunding → refunded');
reset role;

-- 환불 실패 (AC-10-3): 새 주문(P2×1)을 확정 → 취소 요청 → 환불 시작 → 실패
insert into public.cart_items (member_id, product_id, quantity)
values ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000012', 1);
delete from public.cart_items
where member_id = 'a0000000-0000-4000-8000-00000000000a' and product_id = 'c0000000-0000-4000-8000-000000000011';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'order3', (public.create_order(
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into ctx select 'pay3', (public.create_payment((select id from ctx where key = 'order3'), null)).id;
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select public.confirm_payment(
  (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay3')), 'pk_test_3', 15000);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select public.request_cancel('order', (select id from ctx where key = 'order3'));
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select public.begin_refund('order', (select id from ctx where key = 'order3'));
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select lives_ok(
  format('select public.fail_refund(%L::uuid)', (select id from ctx where key = 'pay3')), 'AC-10-3: 환불 실패 처리');
insert into tap (line) select is((select status::text from public.payments where id = (select id from ctx where key = 'pay3')),
  'paid', 'AC-10-3: 환불 실패면 결제는 paid로 돌아간다');
insert into tap (line) select is((select status::text from public.orders where id = (select id from ctx where key = 'order3')),
  'cancel_requested', 'AC-10-3: 환불 실패면 주문 상태는 그대로');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000012'),
  1, 'AC-10-3: 환불 실패면 재고는 복구되지 않는다');
reset role;

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
