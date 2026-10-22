-- 편지 구독 테스트 (AR-GATE §2 순위 2~4: 회차 전이·멱등성·RLS, AR-API §6.2) — TKT-DB-03
-- 결과 표 형식(AR-DB §8): 판정은 `not ok` 0줄, 마지막 줄 `1..N`. 파일 전체를 rollback한다.
begin;
create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
create temp table ctx (key text primary key, id uuid);
grant insert, select on tap, ctx to anon, authenticated, service_role;
grant usage on sequence tap_n_seq to anon, authenticated, service_role;
select no_plan();

-- 준비 (postgres): 회원 A·B, 책방지기 K, 매칭할 책 P(재고 2)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'member-a@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-b@test.local', '{}'),
  ('a0000000-0000-4000-8000-00000000000c', 'keeper@test.local', '{}');
update public.profiles set role = 'keeper' where id = 'a0000000-0000-4000-8000-00000000000c';
insert into public.products (id, name, author, price, image_url, description, theme, keeper_note, stock)
values ('c0000000-0000-4000-8000-000000000031', '블라인드 책', '작가', 18000,
        'https://picsum.photos/seed/ub-blind/600/800', '설명', 'local', '노트', 2);

-- 회원 A: 편지 띄우기 (SEQ-04)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  $$ select public.create_round('짧은 편지', '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전"}'::jsonb) $$,
  'P0001', 'VALIDATION', 'D-025: 편지가 10자 미만이면 회차를 만들지 않는다');
insert into ctx select 'round1', (public.create_round('책방지기님, 요즘 숲길을 자주 걸어요. 어울리는 책을 부탁드려요.',
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'pending_payment', '§6.2: 새 회차는 pending_payment');
insert into tap (line) select throws_ok(
  $$ select public.create_round('두 번째 편지를 보내 봅니다. 괜찮을까요?', '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전"}'::jsonb) $$,
  'P0001', 'ROUND_IN_PROGRESS', 'INV-12: 진행 중 회차가 있으면 새 편지를 보낼 수 없다');
insert into tap (line) select isnt_empty(
  format('update public.reader_letters set body = %L where round_id = %L returning round_id',
    '책방지기님, 요즘 숲길을 자주 걸어요. 고친 편지예요.', (select id from ctx where key = 'round1')),
  '§4: 결제 대기 중에는 자기 편지를 고칠 수 있다');
insert into ctx select 'pay1', (public.create_payment(null, (select id from ctx where key = 'round1'))).id;
insert into tap (line) select is((select amount from public.payments where id = (select id from ctx where key = 'pay1')),
  30000, 'D-003: 회차 결제 금액은 30,000원');
reset role;

-- 책방지기: 결제 전 편지는 보이지 않는다 (INV-18)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.reader_letters where round_id = (select id from ctx where key = 'round1')),
  0, 'INV-18: 결제 확정 전 편지는 책방지기에게 보이지 않는다');
reset role;

-- 서버: 금액 불일치 (AC-11-10) → 정상 확정 → 중복 확정 (AC-08-6)
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
insert into tap (line) select throws_ok(
  format('select public.confirm_payment(%L, %L, 10000)',
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_round_1'),
  'P0001', 'AMOUNT_MISMATCH', 'AC-11-10: 승인 금액이 30,000원이 아니면 확정하지 않는다');
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'pending_payment', 'AC-11-10: 금액이 다르면 회차는 결제 대기 그대로');
insert into tap (line) select is(
  public.confirm_payment(
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_round_1', 30000) ->> 'kind',
  'round', 'SEQ-03: 회차 결제 확정');
insert into tap (line) select is(
  public.confirm_payment(
    (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay1')), 'pk_round_1', 30000) ->> 'already',
  'true', 'AC-08-6: 회차 결제를 두 번 확정해도 already');
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'arrived', '§6.2: pending_payment → arrived');
insert into tap (line) select is((select count(*)::int from public.subscriptions
    where member_id = 'a0000000-0000-4000-8000-00000000000a' and status = 'active'),
  1, 'D-003: 첫 회차 확정 때 활성 구독이 생긴다');
insert into tap (line) select ok((select subscription_id is not null from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'D-024: 회차가 구독에 연결된다');
reset role;

-- 회원 A: 확정 뒤에는 편지를 고칠 수 없다
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is_empty(
  format('update public.reader_letters set body = %L where round_id = %L returning round_id',
    '확정 뒤에 고치려는 편지입니다.', (select id from ctx where key = 'round1')),
  '§4: 결제 확정 뒤에는 편지를 고칠 수 없다');
reset role;

-- 회원 B: 남의 편지·회차·구독은 0행 (AC-11-9)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.reader_letters), 0, 'AC-11-9: 다른 회원의 손편지는 0행');
insert into tap (line) select is((select count(*)::int from public.subscription_rounds), 0, 'INV-19: 다른 회원의 회차는 0행');
insert into tap (line) select is((select count(*)::int from public.subscriptions), 0, 'INV-19: 다른 회원의 구독은 0행');
insert into tap (line) select is((select count(*)::int from public.payments), 0, 'INV-19: 다른 회원의 회차 결제는 0행');
reset role;

-- 책방지기: 편지 열람 (SEQ-05), 서재 작업
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.reader_letters where round_id = (select id from ctx where key = 'round1')),
  1, 'INV-18: 결제 확정된 편지는 책방지기에게 보인다');
select public.open_round((select id from ctx where key = 'round1'));
select public.open_round((select id from ctx where key = 'round1'));
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'reading', 'AC-13-2·3: arrived → reading, 두 번 열어도 reading');
insert into tap (line) select throws_ok(
  format('select public.ship_round(%L::uuid, %L, %L)', (select id from ctx where key = 'round1'), '123456', '숲 냄새가 나는 책'),
  'P0001', 'MISSING_SHIPMENT_FIELDS', 'SEQ-06: 책·답장이 없으면 발송할 수 없다');
insert into tap (line) select lives_ok(
  format('insert into public.round_contents (round_id, product_id, reply_letter) values (%L, %L, %L)',
    (select id from ctx where key = 'round1'), 'c0000000-0000-4000-8000-000000000031', '편지 고마워요. 이 책을 골랐어요.'),
  'AC-14-1: 책방지기는 읽는 중 회차에 책·답장을 담는다');
reset role;

-- 회원 A: 언박싱 전에는 내용이 보이지 않는다 (AC-16-6, NFR-08) / 취소 요청 표시
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.round_contents), 0, 'AC-16-6: 언박싱 전 회차의 책·답장은 0행');
insert into tap (line) select is((select count(*)::int from public.unboxing_codes), 0, 'INV-08: 회원은 언박싱 코드를 볼 수 없다');
insert into tap (line) select ok(
  public.request_cancel('round', (select id from ctx where key = 'round1')) is null, '§5.1: 회차 취소 요청은 null을 돌려준다');
insert into tap (line) select ok(
  (select cancel_requested_at is not null from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'D-029: 회차 취소 요청 표시가 남는다');
reset role;

-- 책방지기: 취소 요청 중 발송 거부 (AC-20-3)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.ship_round(%L::uuid, %L, %L)', (select id from ctx where key = 'round1'), '123456', '숲 냄새가 나는 책'),
  'P0001', 'CANCEL_REQUESTED', 'AC-20-3: 취소 요청 중 회차는 발송할 수 없다');
reset role;

-- 회원 A: 철회 → 다시 요청
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select public.withdraw_cancel('round', (select id from ctx where key = 'round1'));
insert into tap (line) select ok(
  (select cancel_requested_at is null from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'D-029: 회차 취소 요청 철회');
select public.request_cancel('round', (select id from ctx where key = 'round1'));
reset role;

-- 책방지기: 거절 → 발송 (힌트 없으면 거부, 두 번 눌러도 코드 1개)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
select public.reject_cancel('round', (select id from ctx where key = 'round1'));
insert into tap (line) select ok(
  (select cancel_requested_at is null and cancel_rejected_at is not null
   from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'D-029: 회차 취소 거절은 표시를 풀고 거절 시각을 남긴다');
insert into tap (line) select throws_ok(
  format('select public.ship_round(%L::uuid, %L, %L)', (select id from ctx where key = 'round1'), '123456', ' '),
  'P0001', 'MISSING_SHIPMENT_FIELDS', 'SEQ-06: 힌트가 비면 발송할 수 없다');
insert into tap (line) select is(
  public.ship_round((select id from ctx where key = 'round1'), '123456', '숲 냄새가 나는 책')::text,
  '123456', 'AC-15-1: 발송하면 코드가 발급된다');
insert into tap (line) select is(
  public.ship_round((select id from ctx where key = 'round1'), '654321', '숲 냄새가 나는 책')::text,
  '123456', 'AC-15-4: 발송을 두 번 눌러도 코드는 처음 것 하나');
insert into tap (line) select is((select stock from public.products where id = 'c0000000-0000-4000-8000-000000000031'),
  1, 'AC-15-4: 재고는 한 번만 줄어든다(2→1)');
insert into tap (line) select is((select teaser from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  '숲 냄새가 나는 책', 'SEQ-06: 발송할 때 힌트를 저장한다');
reset role;

-- 회원 A: 발송된 회차는 취소 요청 불가 (AC-20-2)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select throws_ok(
  format('select public.request_cancel(%L, %L::uuid)', 'round', (select id from ctx where key = 'round1')),
  'P0001', 'INVALID_STATE', 'AC-20-2: 발송된 회차는 취소 요청할 수 없다');
reset role;

-- 회원 B: A의 코드를 넣어도 열리지 않는다 (AC-16-4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select is(
  public.unbox_round((select id from ctx where key = 'round1'), '123456'), false, 'AC-16-4: 다른 회원은 맞는 코드로도 열 수 없다');
reset role;

-- 회원 A: 언박싱 (SEQ-07)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into tap (line) select is(
  public.unbox_round((select id from ctx where key = 'round1'), '000000'), false, 'AC-16-3: 틀린 코드는 false');
insert into tap (line) select is(
  public.unbox_round((select id from ctx where key = 'round1'), '123456'), true, 'AC-16-1: 맞는 코드로 상자를 연다');
insert into tap (line) select is(
  public.unbox_round((select id from ctx where key = 'round1'), '123456'), true, 'SEQ-07: 다시 넣어도 true(멱등)');
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round1')),
  'unboxed', '§6.2: shipped → unboxed');
insert into tap (line) select is((select count(*)::int from public.round_contents), 1, 'INV-07: 언박싱 뒤에는 책·답장이 보인다');
insert into tap (line) select lives_ok(
  format('insert into public.shelf_memos (round_id, member_id, body) values (%L, %L, %L)',
    (select id from ctx where key = 'round1'), 'a0000000-0000-4000-8000-00000000000a', '숲길에서 다시 읽고 싶은 책'),
  'AC-17-1: 언박싱한 책에 서가 메모를 남긴다');
reset role;

-- 회원 B·책방지기: 메모는 작성 회원만 (AC-17-5, INV-19)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.shelf_memos), 0, 'AC-17-5: 다른 회원의 메모는 0행');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.shelf_memos), 0, 'INV-19: 책방지기도 서가 메모를 보지 않는다');
insert into tap (line) select is((select count(*)::int from public.unboxing_codes where round_id = (select id from ctx where key = 'round1')),
  1, 'INV-08: 책방지기는 언박싱 코드를 본다');
reset role;

-- 회원 A: 편지 거두기 (결제 대기 회차 취소)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'round2', (public.create_round('두 번째 편지예요. 이번엔 식문화 책이 궁금해요.',
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into tap (line) select is(
  public.cancel_pending('round', (select id from ctx where key = 'round2'))::text, 'cancelled', 'SEQ-04: 결제 대기 회차를 거둔다');
-- 회차 환불 준비: round3 편지 → 결제
insert into ctx select 'round3', (public.create_round('세 번째 편지예요. 생태 책을 부탁드려요.',
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into ctx select 'pay3', (public.create_payment(null, (select id from ctx where key = 'round3'))).id;
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select public.confirm_payment(
  (select pg_order_id from public.payments where id = (select id from ctx where key = 'pay3')), 'pk_round_3', 30000);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
select public.request_cancel('round', (select id from ctx where key = 'round3'));
reset role;

-- 책방지기: 회차 환불 2회 클릭 (AC-20-4)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is(
  (public.begin_refund('round', (select id from ctx where key = 'round3'))).status::text, 'refunding', 'AC-20-1: 회차 결제 paid → refunding');
insert into tap (line) select throws_ok(
  format('select public.begin_refund(%L, %L::uuid)', 'round', (select id from ctx where key = 'round3')),
  'P0001', 'ALREADY_PROCESSING', 'AC-20-4: 회차 [환불] 두 번째 클릭은 처리 중');
reset role;
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';
select public.complete_refund((select id from ctx where key = 'pay3'));
select public.complete_refund((select id from ctx where key = 'pay3'));
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round3')),
  'cancelled', 'AC-20-1: 환불하면 회차는 cancelled');
insert into tap (line) select is((select status::text from public.payments where id = (select id from ctx where key = 'pay3')),
  'refunded', 'AC-20-4: 회차 환불은 한 번만 처리된다');
reset role;

-- 회원 A: 환불 뒤 새 편지 → 구독 마무리 (SEQ-09)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000a", "role": "authenticated"}';
insert into ctx select 'round4', (public.create_round('환불 뒤 다시 쓰는 편지예요. 잘 부탁드려요.',
  '{"recipientName": "김독자", "phone": "010-1234-5678", "address": "대전 유성구 어은로 1"}'::jsonb)).id;
insert into tap (line) select ok((select id from ctx where key = 'round4') is not null, 'AC-20-1: 환불 뒤에는 새 편지를 쓸 수 있다');
insert into tap (line) select lives_ok($$ select public.end_subscription('그동안 고마웠어요.') $$, 'AC-18-2: 구독을 바로 마무리한다');
insert into tap (line) select is((select status::text from public.subscriptions where member_id = 'a0000000-0000-4000-8000-00000000000a'),
  'ended', 'SEQ-09: 구독 active → ended');
insert into tap (line) select is((select status::text from public.subscription_rounds where id = (select id from ctx where key = 'round4')),
  'cancelled', 'SEQ-09: 마무리하면 결제 대기 회차는 cancelled');
insert into tap (line) select is((select count(*)::int from public.farewell_notes), 1, 'AC-18-3: 작별 안부가 저장된다');
insert into tap (line) select throws_ok(
  $$ select public.end_subscription(null) $$, 'P0001', 'INVALID_STATE', 'SEQ-09: 활성 구독이 없으면 마무리할 수 없다');
insert into tap (line) select ok((select count(*)::int from public.payments) >= 2, 'INV-19: 회원은 자기 회차 결제를 본다');
reset role;

-- 회원 B·책방지기: 작별 안부 (AC-18-8)
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.farewell_notes), 0, 'AC-18-8: 다른 회원의 작별 안부는 0행');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-00000000000c", "role": "authenticated"}';
insert into tap (line) select is((select count(*)::int from public.farewell_notes), 1, 'AC-18-4: 책방지기는 작별 안부를 본다');
reset role;

-- postcards 버킷 (AR-DB §6)
insert into tap (line) select ok((select not public from storage.buckets where id = 'postcards'), 'AR-DB §6: postcards 버킷은 비공개');
insert into tap (line) select is((select file_size_limit from storage.buckets where id = 'postcards'), 10485760::bigint,
  'AC-14-3: postcards 10MB 제한');
insert into tap (line) select is(
  (select array_agg(policyname::text order by policyname) from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'postcards_%'),
  array['postcards_delete_keeper', 'postcards_insert_keeper', 'postcards_select_keeper', 'postcards_update_keeper'],
  'AR-DB §6: postcards 정책은 책방지기만 (회원 정책 없음)');

insert into tap (line) select * from finish();
select line from tap where line is not null order by n;
rollback;
