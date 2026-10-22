-- TKT-DB-01 RLS·가입 트리거 테스트 (GATE-07, AR-GATE §2 순위 4)
-- 원격 DB에서 돈다(ADR-005). 파일 전체를 rollback하므로 테스트 사용자·행은 남지 않는다.
-- 실행: npx supabase test db --linked
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- GATE-07: public 스키마의 모든 테이블 RLS 활성
select is_empty(
  $$ select relname from pg_class
     where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity $$,
  'GATE-07: public 모든 테이블 RLS 활성'
);

-- 준비 (postgres 권한): 회원 A·B, 책방지기 K, 테스트 책 1권
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{"name": "카카오 회원"}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{"full_name": "책방지기"}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';

insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock)
values ('c0000000-0000-4000-8000-000000000001', '테스트 책', '테스트 작가', 1000,
        'https://picsum.photos/seed/ub-test/600/800', '테스트 설명', 'nature', '테스트 노트', 1);

-- 가입 트리거 (D-A06, ADR-003)
select is((select nickname from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  '카카오 회원', 'D-A06: 가입 트리거가 제공자 이름을 닉네임으로 쓴다');
select is((select nickname from public.profiles where id = 'a0000000-0000-4000-8000-00000000000b'),
  '독자', 'D-A06: 제공자 이름이 없으면 닉네임은 독자');
select is((select role::text from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a'),
  'member', 'ADR-003: 가입 직후 권한은 member');

-- 비로그인 (anon)
set local role anon;
select is((select count(*)::int from public.products where id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'AC-02-1: 비로그인도 책을 조회한다');
select is((select count(*)::int from public.profiles), 0, 'RLS: 비로그인은 profiles 0행');
select throws_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('x', 'x', 1, 'https://picsum.photos/seed/x/600/800', 'x', 'nature', 'x', 1) $$,
  '42501', null, 'RLS: 비로그인 products insert 거부');
reset role;

-- 회원 A
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select is(public.is_keeper(), false, 'INV-15: 회원의 is_keeper()는 false');
select is((select count(*)::int from public.profiles), 1, 'RLS: 회원은 자기 profiles 행만 본다');
select throws_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('x', 'x', 1, 'https://picsum.photos/seed/x/600/800', 'x', 'nature', 'x', 1) $$,
  '42501', null, 'AC-06-5: 비관리자 products insert 거부');
select is_empty(
  $$ update public.products set stock = 99 where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'AC-06-5: 비관리자 products update 0행');
select lives_ok(
  $$ update public.profiles set nickname = '새 이름' where id = 'a0000000-0000-4000-8000-00000000000a' $$,
  'RLS: 회원은 자기 nickname을 고친다');
select throws_ok(
  $$ update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000a' $$,
  '42501', null, 'INV-15: 회원은 role을 고칠 수 없다(컬럼 권한)');
select is_empty(
  $$ update public.profiles set nickname = '남의 이름' where id = 'a0000000-0000-4000-8000-00000000000b' returning id $$,
  'RLS: 다른 회원의 nickname은 0행');
reset role;

-- 책방지기 K
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select is(public.is_keeper(), true, 'ADR-003: 책방지기의 is_keeper()는 true');
select is((select count(*)::int from public.profiles where id in (
    'a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000c')),
  3, 'RLS: 책방지기는 profiles 전체를 본다');
select lives_ok(
  $$ insert into public.products (name, author, price, image_url, description, theme, keeper_note, stock)
     values ('새 책', '작가', 12000, 'https://picsum.photos/seed/new/600/800', '설명', 'local', '노트', 3) $$,
  'AC-06-1: 책방지기는 책을 등록한다');
select isnt_empty(
  $$ update public.products set stock = 2 where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'AC-06-2: 책방지기는 책을 고친다');
select is_empty(
  $$ delete from public.products where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'D-023: 책방지기도 products delete 0행(정책 없음)');
reset role;

-- book-covers 버킷 (AR-DB §6)
select ok((select public from storage.buckets where id = 'book-covers'), 'AR-DB §6: book-covers 버킷은 공개');
select is((select file_size_limit from storage.buckets where id = 'book-covers'), 5242880::bigint,
  'AR-DB §6: book-covers 5MB 제한');
select is(
  (select array_agg(policyname::text order by policyname) from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'book_covers_%'),
  array['book_covers_insert_keeper', 'book_covers_select_all', 'book_covers_update_keeper'],
  'AR-DB §6: book-covers 정책은 select 모두, insert·update 책방지기');

select * from finish();
rollback;
