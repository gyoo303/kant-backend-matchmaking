-- RLS·가입 트리거 테스트 (GATE-07, AR-GATE §2 순위 4) — TKT-DB-01, TKT-DB-02
-- 원격 DB에서 돈다(ADR-005). 파일 전체를 rollback하므로 테스트 사용자·행은 남지 않는다.
-- 결과 표 형식(AR-DB §8): 모든 TAP 줄을 tap에 모아 마지막에 출력한다. 판정: `not ok` 0줄, 마지막 줄 `1..N`
-- 실행: SQL 편집기에 전체를 붙여 실행하거나 npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
grant insert, select on tap to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- GATE-07: public 스키마의 모든 테이블 RLS 활성
insert into tap (line) select is_empty(
  $$ select relname from pg_class
     where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity $$,
  'GATE-07: public 모든 테이블 RLS 활성');

-- 준비 (postgres 권한): 회원 A·B, 책방지기 K, 테스트 책 1권, A의 장바구니·배송지·주문·결제
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{"name": "카카오 회원"}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{"full_name": "책방지기"}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';

insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock)
values ('c0000000-0000-4000-8000-000000000001', '테스트 책', '테스트 작가', 1000,
        'https://picsum.photos/seed/ub-test/600/800', '테스트 설명', 'nature', '테스트 노트', 1);

insert into public.cart_items (member_id, product_id, quantity)
values ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000001', 1);
insert into public.shipping_addresses (member_id, recipient_name, phone, address)
values ('a0000000-0000-4000-8000-00000000000a', '김독자', '010-1234-5678', '대전 유성구 어은로 1');
insert into public.orders (id, order_number, member_id, total_amount, ship_recipient_name, ship_phone, ship_address)
values ('d0000000-0000-4000-8000-000000000001', 'UB000000-T001', 'a0000000-0000-4000-8000-00000000000a',
        1000, '김독자', '010-1234-5678', '대전 유성구 어은로 1');
insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '테스트 책', 1000, 1);
insert into public.payments (id, order_id, pg_order_id, amount)
values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'ubtestrls0001', 1000);

-- 가입 트리거 (D-A06, ADR-003)
insert into tap (line) select is((select nickname from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  '카카오 회원', 'D-A06: 가입 트리거가 제공자 이름을 닉네임으로 쓴다');
insert into tap (line) select is((select nickname from public.profiles where id = 'a0000000-0000-4000-8000-00000000000b'),
  '독자', 'D-A06: 제공자 이름이 없으면 닉네임은 독자');
insert into tap (line) select is((select role::text from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  'member', 'ADR-003: 가입 직후 권한은 member');

-- 비로그인 (anon)
set local role anon;
insert into tap (line) select is((select count(*)::int from public.products where id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'AC-02-1: 비로그인도 책을 조회한다');
insert into tap (line) select is((select count(*)::int from public.profiles), 0, 'RLS: 비로그인은 profiles 0행');
insert into tap (line) select throws_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('x', 'x', 1, 'https://picsum.photos/seed/x/600/800', 'x', 'nature', 'x', 1) $$,
  '42501', null, 'RLS: 비로그인 products insert 거부');
insert into tap (line) select is((select count(*)::int from public.orders), 0, 'RLS: 비로그인은 orders 0행');
insert into tap (line) select is((select count(*)::int from public.cart_items), 0, 'RLS: 비로그인은 cart_items 0행');
insert into tap (line) select is((select count(*)::int from public.payments), 0, 'RLS: 비로그인은 payments 0행');
reset role;

-- 회원 A
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is(public.is_keeper(), false, 'INV-15: 회원의 is_keeper()는 false');
insert into tap (line) select is((select count(*)::int from public.profiles), 1, 'RLS: 회원은 자기 profiles 행만 본다');
insert into tap (line) select throws_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('x', 'x', 1, 'https://picsum.photos/seed/x/600/800', 'x', 'nature', 'x', 1) $$,
  '42501', null, 'AC-06-5: 비관리자 products insert 거부');
insert into tap (line) select is_empty(
  $$ update public.products set stock = 99 where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'AC-06-5: 비관리자 products update 0행');
insert into tap (line) select lives_ok(
  $$ update public.profiles set nickname = '새 이름' where id = 'a0000000-0000-4000-8000-00000000000a' $$,
  'RLS: 회원은 자기 nickname을 고친다');
insert into tap (line) select throws_ok(
  $$ update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'INV-15: 회원은 role을 고칠 수 없다(컬럼 권한)');
insert into tap (line) select is_empty(
  $$ update public.profiles set nickname = '남의 이름' where id = 'a0000000-0000-4000-8000-00000000000b' returning id $$,
  'RLS: 다른 회원의 nickname은 0행');
insert into tap (line) select is((select count(*)::int from public.cart_items), 1, 'RLS: 회원은 자기 장바구니를 본다');
insert into tap (line) select is((select count(*)::int from public.orders), 1, 'RLS: 회원은 자기 주문을 본다');
insert into tap (line) select is((select count(*)::int from public.order_items), 1, 'RLS: 회원은 자기 주문 줄을 본다');
insert into tap (line) select is((select count(*)::int from public.payments), 1, 'RLS: 회원은 자기 주문의 결제를 본다');
insert into tap (line) select is((select count(*)::int from public.shipping_addresses), 1, 'RLS: 회원은 자기 배송지를 본다');
insert into tap (line) select throws_ok(
  $$ insert into public.cart_items (member_id, product_id, quantity)
     values ('a0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000001', 1) $$,
  '42501', null, 'RLS: 다른 회원의 장바구니에 담을 수 없다');
insert into tap (line) select throws_ok(
  $$ update public.orders set status = 'paid' where id = 'd0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'ADR-002: 회원은 주문 상태를 직접 바꿀 수 없다(RPC만)');
insert into tap (line) select throws_ok(
  $$ insert into public.payments (order_id, pg_order_id, amount)
     values ('d0000000-0000-4000-8000-000000000001', 'ubhack', 1) $$,
  '42501', null, 'NFR-19: 회원은 결제 행을 직접 만들 수 없다');
reset role;

-- 회원 B (다른 회원 데이터 0행, AC-09-4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.orders), 0, 'AC-09-4: 다른 회원의 주문은 0행');
insert into tap (line) select is((select count(*)::int from public.order_items), 0, 'AC-09-4: 다른 회원의 주문 줄은 0행');
insert into tap (line) select is((select count(*)::int from public.payments), 0, 'AC-09-4: 다른 회원의 결제는 0행');
insert into tap (line) select is((select count(*)::int from public.cart_items), 0, 'RLS: 다른 회원의 장바구니는 0행');
insert into tap (line) select is((select count(*)::int from public.shipping_addresses), 0, 'RLS: 다른 회원의 배송지는 0행');
reset role;

-- 책방지기 K
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is(public.is_keeper(), true, 'ADR-003: 책방지기의 is_keeper()는 true');
insert into tap (line) select is((select count(*)::int from public.profiles where id in (
    'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000c')),
  3, 'RLS: 책방지기는 profiles 전체를 본다');
insert into tap (line) select lives_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('새 책', '작가', 12000, 'https://picsum.photos/seed/new/600/800', '설명', 'local', '노트', 3) $$,
  'AC-06-1: 책방지기는 책을 등록한다');
insert into tap (line) select isnt_empty(
  $$ update public.products set stock = 2 where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'AC-06-2: 책방지기는 책을 고친다');
insert into tap (line) select is_empty(
  $$ delete from public.products where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'D-023: 책방지기도 products delete 0행(정책 없음)');
insert into tap (line) select is((select count(*)::int from public.orders where id = 'd0000000-0000-4000-8000-000000000001'),
  1, 'RLS: 책방지기는 회원 주문을 본다');
insert into tap (line) select is((select count(*)::int from public.payments where id = 'e0000000-0000-4000-8000-000000000001'),
  1, 'RLS: 책방지기는 결제를 본다');
insert into tap (line) select is((select count(*)::int from public.shipping_addresses), 1, 'RLS: 책방지기는 배송지를 본다');
insert into tap (line) select is((select count(*)::int from public.cart_items), 0, 'RLS: 책방지기는 장바구니를 보지 않는다');
reset role;

-- book-covers 버킷 (AR-DB §6)
insert into tap (line) select ok((select public from storage.buckets where id = 'book-covers'), 'AR-DB §6: book-covers 버킷은 공개');
insert into tap (line) select is((select file_size_limit from storage.buckets where id = 'book-covers'), 5242880::bigint,
  'AR-DB §6: book-covers 5MB 제한');
insert into tap (line) select is(
  (select array_agg(policyname::text order by policyname) from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'book_covers_%'),
  array['book_covers_insert_keeper', 'book_covers_select_all', 'book_covers_update_keeper'],
  'AR-DB §6: book-covers 정책은 select 모두, insert·update 책방지기');

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
