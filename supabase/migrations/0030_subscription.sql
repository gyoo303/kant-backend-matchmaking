-- TKT-DB-03: 구독·회차·편지류·코드·메모·안부, 회차 RPC, payments.round_id FK·공용 RPC 회차 분기, postcards 버킷
-- 기준: docs/02-arch/03-db-schema.md §3·§4·§5(5.1)·§6·§9, 04-interfaces-api.md §6.2·SEQ-04~09
-- 공용 RPC는 0020과 같은 시그니처로 create or replace 한다(주문 분기는 그대로, 회차 분기 추가). 실행 권한은 유지된다.

-- ENT-07 Subscription
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles (id) on delete set null,
  status public.subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check ((status = 'ended') = (ended_at is not null))
);
create unique index subscriptions_one_active on public.subscriptions (member_id) where status = 'active';

-- ENT-08 SubscriptionRound (회원에게 보이는 회차 정보만)
create table public.subscription_rounds (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  status public.round_status not null default 'pending_payment',
  amount integer not null default 30000 check (amount = 30000),            -- D-003
  ship_recipient_name text not null,
  ship_phone text not null,
  ship_address text not null,
  teaser text check (teaser is null or char_length(teaser) between 1 and 100),
  cancel_requested_at timestamptz,                                         -- 취소 요청 표시(D-029)
  cancel_rejected_at timestamptz,
  paid_at timestamptz,
  opened_at timestamptz,
  shipped_at timestamptz,
  unboxed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'pending_payment' or status = 'cancelled' or subscription_id is not null),
  check (cancel_requested_at is null or status in ('arrived', 'reading'))
);
create unique index rounds_one_in_progress on public.subscription_rounds (member_id)
  where status in ('pending_payment', 'arrived', 'reading');                -- INV-12

-- ENT-09 ReaderLetter
create table public.reader_letters (
  round_id uuid primary key references public.subscription_rounds (id) on delete cascade,
  member_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 10 and 2000),        -- D-025
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ENT-10 블라인드 대상: 매칭 책·답장·엽서 (NFR-08)
create table public.round_contents (
  round_id uuid primary key references public.subscription_rounds (id) on delete cascade,
  product_id uuid references public.products (id) on delete restrict,
  reply_letter text check (reply_letter is null or char_length(reply_letter) between 1 and 3000),
  postcard_path text,
  updated_at timestamptz not null default now()
);

-- ENT-11 UnboxingCode (책방지기만 열람)
create table public.unboxing_codes (
  round_id uuid primary key references public.subscription_rounds (id) on delete cascade,
  code char(6) not null check (code ~ '^[0-9]{6}$'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index unboxing_codes_active_unique on public.unboxing_codes (code) where used_at is null;

-- ENT-12 ShelfMemo (INV-16: 1권 1개)
create table public.shelf_memos (
  round_id uuid primary key references public.subscription_rounds (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 100),
  updated_at timestamptz not null default now()
);

-- ENT-13 FarewellNote
create table public.farewell_notes (
  subscription_id uuid primary key references public.subscriptions (id) on delete cascade,
  member_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create trigger subscription_rounds_set_updated_at before update on public.subscription_rounds
  for each row execute function public.set_updated_at();
create trigger reader_letters_set_updated_at before update on public.reader_letters
  for each row execute function public.set_updated_at();
create trigger round_contents_set_updated_at before update on public.round_contents
  for each row execute function public.set_updated_at();
create trigger shelf_memos_set_updated_at before update on public.shelf_memos
  for each row execute function public.set_updated_at();

-- §5.1: payments.round_id FK (0020에서 컬럼만 만들었다)
alter table public.payments
  add constraint payments_round_id_fkey foreign key (round_id)
  references public.subscription_rounds (id) on delete restrict;

-- §4 RLS (기본 거부, 정책 표 그대로)
alter table public.subscriptions enable row level security;
alter table public.subscription_rounds enable row level security;
alter table public.reader_letters enable row level security;
alter table public.round_contents enable row level security;
alter table public.unboxing_codes enable row level security;
alter table public.shelf_memos enable row level security;
alter table public.farewell_notes enable row level security;

-- subscriptions·subscription_rounds: 회원 own select, 책방지기 select, 쓰기는 RPC
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (member_id = (select auth.uid()));
create policy subscriptions_select_keeper on public.subscriptions
  for select to authenticated using ((select public.is_keeper()));
create policy subscription_rounds_select_own on public.subscription_rounds
  for select to authenticated using (member_id = (select auth.uid()));
create policy subscription_rounds_select_keeper on public.subscription_rounds
  for select to authenticated using ((select public.is_keeper()));

-- reader_letters: 회원 own select, 결제 대기 중 본문 수정(body 컬럼만), 책방지기는 결제 확정 후만 select (INV-18)
create policy reader_letters_select_own on public.reader_letters
  for select to authenticated using (member_id = (select auth.uid()));
create policy reader_letters_update_own_pending on public.reader_letters
  for update to authenticated
  using (member_id = (select auth.uid()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status = 'pending_payment'))
  with check (member_id = (select auth.uid()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status = 'pending_payment'));
create policy reader_letters_select_keeper on public.reader_letters
  for select to authenticated using ((select public.is_keeper()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status <> 'pending_payment'));

-- round_contents: 회원은 own 회차가 unboxed일 때만 select (NFR-08), 책방지기 select·insert·update(쓰기는 arrived·reading일 때만)
create policy round_contents_select_own_unboxed on public.round_contents
  for select to authenticated using (exists (
    select 1 from public.subscription_rounds r
    where r.id = round_id and r.member_id = (select auth.uid()) and r.status = 'unboxed'));
create policy round_contents_select_keeper on public.round_contents
  for select to authenticated using ((select public.is_keeper()));
create policy round_contents_insert_keeper on public.round_contents
  for insert to authenticated with check ((select public.is_keeper()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status in ('arrived', 'reading')));
create policy round_contents_update_keeper on public.round_contents
  for update to authenticated
  using ((select public.is_keeper()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status in ('arrived', 'reading')))
  with check ((select public.is_keeper()) and exists (
    select 1 from public.subscription_rounds r where r.id = round_id and r.status in ('arrived', 'reading')));

-- unboxing_codes: 책방지기 select만 (회원 정책 없음, unbox_round RPC로만 대조)
create policy unboxing_codes_select_keeper on public.unboxing_codes
  for select to authenticated using ((select public.is_keeper()));

-- shelf_memos: 작성 회원만(INV-19), 쓰기는 own 회차가 unboxed일 때만. 책방지기 정책 없음
create policy shelf_memos_select_own on public.shelf_memos
  for select to authenticated using (member_id = (select auth.uid()));
create policy shelf_memos_insert_own_unboxed on public.shelf_memos
  for insert to authenticated with check (member_id = (select auth.uid()) and exists (
    select 1 from public.subscription_rounds r
    where r.id = round_id and r.member_id = (select auth.uid()) and r.status = 'unboxed'));
create policy shelf_memos_update_own_unboxed on public.shelf_memos
  for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()) and exists (
    select 1 from public.subscription_rounds r
    where r.id = round_id and r.member_id = (select auth.uid()) and r.status = 'unboxed'));
create policy shelf_memos_delete_own on public.shelf_memos
  for delete to authenticated using (member_id = (select auth.uid()));

-- farewell_notes: 회원 own select, 책방지기 select, 쓰기는 end_subscription RPC
create policy farewell_notes_select_own on public.farewell_notes
  for select to authenticated using (member_id = (select auth.uid()));
create policy farewell_notes_select_keeper on public.farewell_notes
  for select to authenticated using ((select public.is_keeper()));

-- §5.1: payments 회원 select를 주문·회차 소유 기준으로 다시 만든다
drop policy payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.member_id = (select auth.uid()))
    or exists (select 1 from public.subscription_rounds r where r.id = round_id and r.member_id = (select auth.uid())));

-- 테이블 권한: RPC만 쓰는 테이블은 쓰기 권한을 거둔다. reader_letters는 body 컬럼 update만 남긴다
revoke insert, update, delete on public.subscriptions, public.subscription_rounds,
  public.unboxing_codes, public.farewell_notes from anon, authenticated;
revoke insert, update, delete on public.reader_letters from anon, authenticated;
grant update (body) on public.reader_letters to authenticated;
revoke delete on public.round_contents from anon, authenticated;

-- §6 Storage: postcards (비공개, 이미지 MIME, 10MB, 책방지기만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postcards', 'postcards', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy postcards_select_keeper on storage.objects
  for select to authenticated using (bucket_id = 'postcards' and (select public.is_keeper()));
create policy postcards_insert_keeper on storage.objects
  for insert to authenticated with check (bucket_id = 'postcards' and (select public.is_keeper()));
create policy postcards_update_keeper on storage.objects
  for update to authenticated
  using (bucket_id = 'postcards' and (select public.is_keeper()))
  with check (bucket_id = 'postcards' and (select public.is_keeper()));
create policy postcards_delete_keeper on storage.objects
  for delete to authenticated using (bucket_id = 'postcards' and (select public.is_keeper()));

-- §5 회차 RPC

-- SEQ-04: 편지 + 회차 pending_payment (배송지 사본). 진행 중 회차가 있으면 ROUND_IN_PROGRESS (INV-12)
create function public.create_round(p_letter text, p_ship jsonb)
returns public.subscription_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_body text := btrim(p_letter);
  v_name text := btrim(p_ship ->> 'recipientName');
  v_phone text := btrim(p_ship ->> 'phone');
  v_address text := btrim(p_ship ->> 'address');
  v_round public.subscription_rounds;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if v_body is null or not (char_length(v_body) between 10 and 2000)
     or v_name is null or not (char_length(v_name) between 1 and 50)
     or v_phone is null or v_phone !~ '^[0-9-]{9,13}$'
     or v_address is null or not (char_length(v_address) between 1 and 200) then
    raise exception using errcode = 'P0001', message = 'VALIDATION';
  end if;

  begin
    insert into public.subscription_rounds (member_id, ship_recipient_name, ship_phone, ship_address)
    values (v_member, v_name, v_phone, v_address)
    returning * into v_round;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'ROUND_IN_PROGRESS';
  end;

  insert into public.reader_letters (round_id, member_id, body) values (v_round.id, v_member, v_body);
  return v_round;
end;
$$;

-- SEQ-05: 편지 열람(책방지기) arrived → reading. 이미 reading이면 변화 없음
create function public.open_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  update public.subscription_rounds set status = 'reading', opened_at = now()
  where id = p_round_id and status = 'arrived';
end;
$$;

-- SEQ-06: 발송·코드 발급(책방지기). 이미 shipped면 기존 코드 반환 (AC-15-4)
create function public.ship_round(p_round_id uuid, p_code char(6), p_teaser text)
returns char(6)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.subscription_rounds;
  v_contents public.round_contents;
  v_teaser text := btrim(p_teaser);
  v_code char(6);
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select * into v_round from public.subscription_rounds where id = p_round_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_round.status = 'shipped' then
    select code into v_code from public.unboxing_codes where round_id = p_round_id;
    return v_code;
  end if;
  if v_round.status not in ('arrived', 'reading') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- INV-04
  end if;
  if v_round.cancel_requested_at is not null then
    raise exception using errcode = 'P0001', message = 'CANCEL_REQUESTED';   -- INV-20, AC-20-3
  end if;

  select * into v_contents from public.round_contents where round_id = p_round_id;
  if not found or v_contents.product_id is null or v_contents.reply_letter is null
     or v_teaser is null or not (char_length(v_teaser) between 1 and 100) then
    raise exception using errcode = 'P0001', message = 'MISSING_SHIPMENT_FIELDS';
  end if;

  update public.products set stock = stock - 1 where id = v_contents.product_id and stock >= 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK';   -- AC-15-5
  end if;

  begin
    insert into public.unboxing_codes (round_id, code) values (p_round_id, p_code);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'CODE_COLLISION';   -- 서버가 새 코드로 다시 부른다
  end;

  update public.subscription_rounds
  set status = 'shipped', shipped_at = now(), teaser = v_teaser
  where id = p_round_id;
  return p_code;
end;
$$;

-- SEQ-07: 언박싱(회원). 소유자·shipped·코드 일치 → unboxed. 그 밖에는 모두 false (AC-16-3·4, NFR-18)
create function public.unbox_round(p_round_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_round public.subscription_rounds;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select * into v_round from public.subscription_rounds
  where id = p_round_id and member_id = v_member
  for update;
  if not found then
    return false;
  end if;
  if v_round.status = 'unboxed' then
    return exists (select 1 from public.unboxing_codes where round_id = p_round_id and code = p_code);
  end if;
  if v_round.status <> 'shipped' then
    return false;
  end if;

  update public.unboxing_codes set used_at = now()
  where round_id = p_round_id and code = p_code and used_at is null;
  if not found then
    return false;
  end if;

  update public.subscription_rounds set status = 'unboxed', unboxed_at = now() where id = p_round_id;
  return true;
end;
$$;

-- SEQ-09: 구독 마무리(회원). 구독 ended, 결제 대기 회차 cancelled, 안부가 있으면 저장 (INV-13·14)
create function public.end_subscription(p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_note text := nullif(btrim(p_note), '');
  v_subscription public.subscriptions;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception using errcode = 'P0001', message = 'VALIDATION';
  end if;

  select * into v_subscription from public.subscriptions
  where member_id = v_member and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  update public.subscriptions set status = 'ended', ended_at = now() where id = v_subscription.id;
  update public.subscription_rounds set status = 'cancelled'
  where member_id = v_member and status = 'pending_payment';
  if v_note is not null then
    insert into public.farewell_notes (subscription_id, member_id, body)
    values (v_subscription.id, v_member, v_note);
  end if;
end;
$$;

revoke all on function
  public.create_round(text, jsonb), public.open_round(uuid), public.ship_round(uuid, char, text),
  public.unbox_round(uuid, text), public.end_subscription(text)
from public, anon, authenticated;
grant execute on function
  public.create_round(text, jsonb), public.open_round(uuid), public.ship_round(uuid, char, text),
  public.unbox_round(uuid, text), public.end_subscription(text)
to authenticated;

-- §5.1 공용 RPC 회차 분기 (create or replace, 시그니처·권한 그대로)

create or replace function public.create_payment(p_order_id uuid, p_round_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_order public.orders;
  v_round public.subscription_rounds;
  v_payment public.payments;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if (p_order_id is null) = (p_round_id is null) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if p_order_id is not null then
    select * into v_order from public.orders
    where id = p_order_id and member_id = v_member
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_order.status <> 'pending_payment' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    insert into public.payments (order_id, pg_order_id, amount)
    values (p_order_id, 'ub' || replace(gen_random_uuid()::text, '-', ''), v_order.total_amount)
    returning * into v_payment;
    return v_payment;
  end if;

  select * into v_round from public.subscription_rounds
  where id = p_round_id and member_id = v_member
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_round.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;
  insert into public.payments (round_id, pg_order_id, amount)
  values (p_round_id, 'ub' || replace(gen_random_uuid()::text, '-', ''), v_round.amount)
  returning * into v_payment;
  return v_payment;
end;
$$;

create or replace function public.confirm_payment(p_pg_order_id text, p_payment_key text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_round public.subscription_rounds;
  v_subscription_id uuid;
  v_item record;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select * into v_payment from public.payments where pg_order_id = p_pg_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    if v_payment.order_id is not null then
      return jsonb_build_object('already', true, 'kind', 'order', 'orderId', v_payment.order_id);
    end if;
    return jsonb_build_object('already', true, 'kind', 'round', 'roundId', v_payment.round_id);
  end if;
  if v_payment.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;
  if p_amount is distinct from v_payment.amount then
    raise exception using errcode = 'P0001', message = 'AMOUNT_MISMATCH';   -- AC-08-8, AC-11-10, NFR-19
  end if;

  -- 주문 분기 (0020과 같다)
  if v_payment.order_id is not null then
    select * into v_order from public.orders where id = v_payment.order_id for update;
    if v_order.status <> 'pending_payment' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;

    for v_item in select product_id, quantity from public.order_items where order_id = v_order.id loop
      update public.products set stock = stock - v_item.quantity
      where id = v_item.product_id and stock >= v_item.quantity;
      if not found then
        raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK';
      end if;
    end loop;

    delete from public.cart_items
    where member_id = v_order.member_id
      and product_id in (select product_id from public.order_items where order_id = v_order.id);

    if v_order.member_id is not null then
      insert into public.shipping_addresses (member_id, recipient_name, phone, address)
      values (v_order.member_id, v_order.ship_recipient_name, v_order.ship_phone, v_order.ship_address)
      on conflict (member_id) do update
        set recipient_name = excluded.recipient_name, phone = excluded.phone, address = excluded.address;
    end if;

    update public.orders set status = 'paid', paid_at = now() where id = v_order.id;
    update public.payments
    set status = 'paid', pg_payment_key = p_payment_key, approved_at = now()
    where id = v_payment.id;
    return jsonb_build_object('already', false, 'kind', 'order', 'orderId', v_order.id);
  end if;

  -- 회차 분기: 활성 구독 연결(없으면 생성, D-003·D-024) → arrived, 기본 배송지 upsert
  select * into v_round from public.subscription_rounds where id = v_payment.round_id for update;
  if v_round.status <> 'pending_payment' or v_round.member_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  select id into v_subscription_id from public.subscriptions
  where member_id = v_round.member_id and status = 'active';
  if v_subscription_id is null then
    insert into public.subscriptions (member_id) values (v_round.member_id) returning id into v_subscription_id;
  end if;

  update public.subscription_rounds
  set status = 'arrived', subscription_id = v_subscription_id, paid_at = now()
  where id = v_round.id;

  insert into public.shipping_addresses (member_id, recipient_name, phone, address)
  values (v_round.member_id, v_round.ship_recipient_name, v_round.ship_phone, v_round.ship_address)
  on conflict (member_id) do update
    set recipient_name = excluded.recipient_name, phone = excluded.phone, address = excluded.address;

  update public.payments
  set status = 'paid', pg_payment_key = p_payment_key, approved_at = now()
  where id = v_payment.id;
  return jsonb_build_object('already', false, 'kind', 'round', 'roundId', v_round.id);
end;
$$;

-- 회차 취소 요청: arrived·reading에서 cancel_requested_at 설정. 회차 분기는 null을 돌려준다(§5.1)
create or replace function public.request_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.order_status;
  v_round public.subscription_rounds;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_kind = 'order' then
    update public.orders set status = 'cancel_requested', cancel_rejected_at = null
    where id = p_id and member_id = v_member and status = 'paid';
    if found then
      return 'cancel_requested';
    end if;
    select status into v_status from public.orders where id = p_id and member_id = v_member;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_status = 'cancel_requested' then
      return v_status;
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if p_kind = 'round' then
    select * into v_round from public.subscription_rounds where id = p_id and member_id = v_member for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_round.status not in ('arrived', 'reading') then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- AC-20-2
    end if;
    update public.subscription_rounds
    set cancel_requested_at = coalesce(cancel_requested_at, now()), cancel_rejected_at = null
    where id = p_id;
    return null;
  end if;

  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;

-- 회차 취소 요청 철회: cancel_requested_at 해제. 회차 분기는 null
create or replace function public.withdraw_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.order_status;
  v_round public.subscription_rounds;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_kind = 'order' then
    update public.orders set status = 'paid'
    where id = p_id and member_id = v_member and status = 'cancel_requested';
    if found then
      return 'paid';
    end if;
    select status into v_status from public.orders where id = p_id and member_id = v_member;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_status = 'paid' then
      return v_status;
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if p_kind = 'round' then
    select * into v_round from public.subscription_rounds where id = p_id and member_id = v_member for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_round.status not in ('arrived', 'reading') then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    update public.subscription_rounds set cancel_requested_at = null where id = p_id;
    return null;
  end if;

  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;

-- 회차 취소 거절(책방지기): 표시 해제 + cancel_rejected_at. 회차 분기는 null
create or replace function public.reject_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_round public.subscription_rounds;
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if p_kind = 'order' then
    update public.orders set status = 'paid', cancel_rejected_at = now()
    where id = p_id and status = 'cancel_requested';
    if found then
      return 'paid';
    end if;
    select * into v_order from public.orders where id = p_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_order.status = 'paid' and v_order.cancel_rejected_at is not null then
      return v_order.status;
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if p_kind = 'round' then
    select * into v_round from public.subscription_rounds where id = p_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_round.cancel_requested_at is null and v_round.cancel_rejected_at is not null then
      return null;   -- 이미 거절됨
    end if;
    if v_round.cancel_requested_at is null then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    update public.subscription_rounds set cancel_requested_at = null, cancel_rejected_at = now() where id = p_id;
    return null;
  end if;

  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;

-- 회차 환불 시작(책방지기): 취소 요청 표시가 있는 arrived·reading 회차의 결제 paid → refunding (AC-20-1·4)
create or replace function public.begin_refund(p_kind text, p_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_round public.subscription_rounds;
  v_payment public.payments;
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  if p_kind = 'order' then
    select * into v_order from public.orders where id = p_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    select * into v_payment from public.payments
    where order_id = p_id and status in ('paid', 'refunding', 'refunded')
    for update;
    if found and v_payment.status in ('refunding', 'refunded') then
      raise exception using errcode = 'P0001', message = 'ALREADY_PROCESSING';
    end if;
    if not found or v_order.status <> 'cancel_requested' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
  elsif p_kind = 'round' then
    select * into v_round from public.subscription_rounds where id = p_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    select * into v_payment from public.payments
    where round_id = p_id and status in ('paid', 'refunding', 'refunded')
    for update;
    if found and v_payment.status in ('refunding', 'refunded') then
      raise exception using errcode = 'P0001', message = 'ALREADY_PROCESSING';
    end if;
    if not found or v_round.cancel_requested_at is null or v_round.status not in ('arrived', 'reading') then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  update public.payments set status = 'refunding' where id = v_payment.id
  returning * into v_payment;
  return v_payment;
end;
$$;

-- 환불 성공(서버 전용). 회차 분기: 회차 cancelled(취소 요청 표시 해제), 재고는 발송 전이라 복구할 것이 없다
create or replace function public.complete_refund(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_payment.status = 'refunded' then
    return;
  end if;
  if v_payment.status <> 'refunding' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if v_payment.order_id is not null then
    update public.orders set status = 'refunded'
    where id = v_payment.order_id and status = 'cancel_requested';
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    update public.products p set stock = p.stock + oi.quantity
    from public.order_items oi
    where oi.order_id = v_payment.order_id and p.id = oi.product_id;
  else
    update public.subscription_rounds set status = 'cancelled', cancel_requested_at = null
    where id = v_payment.round_id and status in ('arrived', 'reading');
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
  end if;

  update public.payments set status = 'refunded', refunded_at = now() where id = v_payment.id;
end;
$$;

-- 회차 [편지 거두기]: pending_payment → cancelled. 회차 분기도 'cancelled'를 돌려준다(두 enum에 같은 값)
create or replace function public.cancel_pending(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_order_status public.order_status;
  v_round_status public.round_status;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_kind = 'order' then
    update public.orders set status = 'cancelled'
    where id = p_id and member_id = v_member and status = 'pending_payment';
    if found then
      return 'cancelled';
    end if;
    select status into v_order_status from public.orders where id = p_id and member_id = v_member;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_order_status = 'cancelled' then
      return v_order_status;
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  if p_kind = 'round' then
    update public.subscription_rounds set status = 'cancelled'
    where id = p_id and member_id = v_member and status = 'pending_payment';
    if found then
      return 'cancelled';
    end if;
    select status into v_round_status from public.subscription_rounds where id = p_id and member_id = v_member;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if v_round_status = 'cancelled' then
      return 'cancelled';
    end if;
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;
