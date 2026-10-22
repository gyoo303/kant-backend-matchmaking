-- TKT-DB-02: 장바구니·배송지·주문·결제 테이블, order_number_seq, 주문 분기 RPC
-- 기준: docs/02-arch/03-db-schema.md §3·§4·§5(5.1·5.2)·§9, 04-interfaces-api.md §2·§6.1·§6.3, ADR-002·004
-- 회차(subscription_rounds) 관련: payments.round_id FK와 공용 RPC의 회차 분기는 0030에서 추가한다(§5.1).
-- RPC 오류는 raise exception using errcode = 'P0001', message = '<ErrorCode>' (04 §2).

-- ENT-03 CartItem
create table public.cart_items (
  member_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, product_id)                  -- AC-07-3 줄 중복 0
);

-- ENT-04 ShippingAddress (회원당 1행)
create table public.shipping_addresses (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 50),
  phone text not null check (phone ~ '^[0-9-]{9,13}$'),
  address text not null check (char_length(address) between 1 and 200),
  updated_at timestamptz not null default now()
);

-- §5.2 주문 번호 순번 (create_order만 쓴다)
create sequence public.order_number_seq;

-- ENT-05 Order (+ 배송지·가격 사본, D-004)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  member_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'pending_payment',
  total_amount integer not null check (total_amount >= 0),
  ship_recipient_name text not null,
  ship_phone text not null,
  ship_address text not null,
  cancel_rejected_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity >= 1),
  primary key (order_id, product_id)
);

-- ENT-06 Payment (주문·회차 공용). round_id FK는 0030에서 추가 (§5.1)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete restrict,
  round_id uuid,
  pg_order_id text not null unique,                    -- 토스 orderId
  pg_payment_key text unique,                          -- RISK-01 중복 확정 차단
  amount integer not null check (amount > 0),          -- 서버 계산 금액(NFR-19)
  status public.payment_status not null default 'ready',
  failure_code text,
  approved_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((order_id is null) <> (round_id is null))
);
create unique index payments_one_settled_per_order on public.payments (order_id)
  where status in ('paid', 'refunding', 'refunded');
create unique index payments_one_settled_per_round on public.payments (round_id)
  where status in ('paid', 'refunding', 'refunded');

create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger shipping_addresses_set_updated_at before update on public.shipping_addresses
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- §4 RLS (기본 거부, 정책 표 그대로)
alter table public.cart_items enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

-- cart_items: 회원 own select·insert·update·delete, 책방지기 정책 없음
create policy cart_items_select_own on public.cart_items
  for select to authenticated using (member_id = (select auth.uid()));
create policy cart_items_insert_own on public.cart_items
  for insert to authenticated with check (member_id = (select auth.uid()));
create policy cart_items_update_own on public.cart_items
  for update to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));
create policy cart_items_delete_own on public.cart_items
  for delete to authenticated using (member_id = (select auth.uid()));

-- shipping_addresses: 회원 own select·insert·update (delete는 탈퇴 RPC), 책방지기 select
create policy shipping_addresses_select_own on public.shipping_addresses
  for select to authenticated using (member_id = (select auth.uid()));
create policy shipping_addresses_select_keeper on public.shipping_addresses
  for select to authenticated using ((select public.is_keeper()));
create policy shipping_addresses_insert_own on public.shipping_addresses
  for insert to authenticated with check (member_id = (select auth.uid()));
create policy shipping_addresses_update_own on public.shipping_addresses
  for update to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

-- orders·order_items: 회원 own select, 책방지기 select(member_id가 있는 주문만), 쓰기는 RPC만
create policy orders_select_own on public.orders
  for select to authenticated using (member_id = (select auth.uid()));
create policy orders_select_keeper on public.orders
  for select to authenticated using ((select public.is_keeper()) and member_id is not null);

create policy order_items_select_own on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and o.member_id = (select auth.uid())));
create policy order_items_select_keeper on public.order_items
  for select to authenticated using ((select public.is_keeper()) and exists (
    select 1 from public.orders o where o.id = order_id and o.member_id is not null));

-- payments: 회원 own select(주문 소유 기준, 회차 기준은 0030에서 정책을 다시 만든다), 책방지기 select
create policy payments_select_own on public.payments
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and o.member_id = (select auth.uid())));
create policy payments_select_keeper on public.payments
  for select to authenticated using ((select public.is_keeper()));

-- 쓰기 정책이 없는 테이블의 테이블 권한도 거둔다(RPC만 쓴다)
revoke insert, update, delete on public.orders, public.order_items, public.payments from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

-- §5 RPC — 주문 분기 (security definer, search_path = '', 첫 줄 권한 검사, CONV-12)

-- SEQ-02: 장바구니(재고>0 줄) → orders + order_items(가격 사본), 합계 서버 계산
create function public.create_order(p_ship jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_name text := btrim(p_ship ->> 'recipientName');
  v_phone text := btrim(p_ship ->> 'phone');
  v_address text := btrim(p_ship ->> 'address');
  v_total integer;
  v_order public.orders;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  -- 결제 확정 때 기본 배송지 upsert가 실패하지 않도록 shipping_addresses와 같은 규칙으로 검사
  if v_name is null or not (char_length(v_name) between 1 and 50)
     or v_phone is null or v_phone !~ '^[0-9-]{9,13}$'
     or v_address is null or not (char_length(v_address) between 1 and 200) then
    raise exception using errcode = 'P0001', message = 'VALIDATION';
  end if;

  select sum(c.quantity * p.price) into v_total
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.member_id = v_member and p.stock > 0;
  if v_total is null then
    raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK';
  end if;

  insert into public.orders (order_number, member_id, total_amount, ship_recipient_name, ship_phone, ship_address)
  values (
    'UB' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-'
      || lpad((nextval('public.order_number_seq') % 10000)::text, 4, '0'),
    v_member, v_total, v_name, v_phone, v_address
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
  select v_order.id, p.id, p.name, p.price, c.quantity
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.member_id = v_member and p.stock > 0;

  return v_order;
end;
$$;

-- SEQ-03 1단계: 결제 준비. 금액은 주문 합계(서버 값), pg_order_id는 DB가 만든다 (04 §7)
create function public.create_payment(p_order_id uuid, p_round_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_order public.orders;
  v_payment public.payments;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if p_round_id is not null or p_order_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차 결제는 0030
  end if;

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
end;
$$;

-- SEQ-03 5단계: 결제 확정(서버 전용). 금액 대조 → 재고 차감·장바구니 정리·기본 배송지 upsert·paid
-- 이미 paid면 {already: true} (AC-08-6). 실패(OUT_OF_STOCK·AMOUNT_MISMATCH)는 전체 롤백 → 서버가 PG 보상 취소
create function public.confirm_payment(p_pg_order_id text, p_payment_key text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
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
    return jsonb_build_object('already', true, 'kind', 'order', 'orderId', v_payment.order_id);
  end if;
  if v_payment.status <> 'ready' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;
  if p_amount is distinct from v_payment.amount then
    raise exception using errcode = 'P0001', message = 'AMOUNT_MISMATCH';   -- AC-08-8, NFR-19
  end if;
  if v_payment.order_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차 결제는 0030
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_order.status <> 'pending_payment' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  -- INV-05: 재고가 모자라면 한 권도 차감하지 않고 전체 롤백 (AC-08-5)
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
end;
$$;

-- SEQ-03 실패 분기(서버 전용): ready → failed. ready가 아니면 변화 없음
create function public.fail_payment(p_pg_order_id text, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  update public.payments set status = 'failed', failure_code = p_code
  where pg_order_id = p_pg_order_id and status = 'ready';
end;
$$;

-- SEQ-08 취소 요청: paid → cancel_requested (cancel_rejected_at 초기화). 이미 요청 중이면 그대로
create function public.request_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.order_status;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if p_kind is distinct from 'order' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차는 0030
  end if;

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
end;
$$;

-- SEQ-08 취소 요청 철회: cancel_requested → paid. 이미 paid면 그대로
create function public.withdraw_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.order_status;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if p_kind is distinct from 'order' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차는 0030
  end if;

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
end;
$$;

-- SEQ-08 거절(책방지기): cancel_requested → paid + cancel_rejected_at (AC-09-6)
create function public.reject_cancel(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_kind is distinct from 'order' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차는 0030
  end if;

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
end;
$$;

-- SEQ-08 환불 시작(책방지기): 취소 요청 주문의 결제 paid → refunding. 두 번째 호출은 ALREADY_PROCESSING (AC-10-5)
create function public.begin_refund(p_kind text, p_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_kind is distinct from 'order' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차는 0030
  end if;

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

  update public.payments set status = 'refunding' where id = v_payment.id
  returning * into v_payment;
  return v_payment;
end;
$$;

-- SEQ-08 환불 성공(서버 전용): refunding → refunded, 주문 refunded, 재고 복구. 이미 refunded면 변화 없음
create function public.complete_refund(p_payment_id uuid)
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
  if v_payment.status <> 'refunding' or v_payment.order_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차 환불은 0030
  end if;

  update public.orders set status = 'refunded'
  where id = v_payment.order_id and status = 'cancel_requested';
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  update public.products p set stock = p.stock + oi.quantity
  from public.order_items oi
  where oi.order_id = v_payment.order_id and p.id = oi.product_id;

  update public.payments set status = 'refunded', refunded_at = now() where id = v_payment.id;
end;
$$;

-- SEQ-08 환불 실패(서버 전용): refunding → paid. 주문은 그대로 (AC-10-3)
create function public.fail_refund(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  update public.payments set status = 'paid' where id = p_payment_id and status = 'refunding';
end;
$$;

-- SEQ-02 발송(책방지기): paid → shipped. 취소 요청이면 CANCEL_REQUESTED (AC-10-4), 이미 shipped면 그대로
create function public.ship_order(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  update public.orders set status = 'shipped', shipped_at = now()
  where id = p_order_id and status = 'paid';
  if found then
    return 'shipped';
  end if;

  select status into v_status from public.orders where id = p_order_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_status = 'shipped' then
    return v_status;
  end if;
  if v_status = 'cancel_requested' then
    raise exception using errcode = 'P0001', message = 'CANCEL_REQUESTED';
  end if;
  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;

-- D-037 결제 대기 주문 취소(회원): pending_payment → cancelled. 이미 cancelled면 그대로
create function public.cancel_pending(p_kind text, p_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.order_status;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if p_kind is distinct from 'order' then
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';   -- 회차는 0030
  end if;

  update public.orders set status = 'cancelled'
  where id = p_id and member_id = v_member and status = 'pending_payment';
  if found then
    return 'cancelled';
  end if;

  select status into v_status from public.orders where id = p_id and member_id = v_member;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_status = 'cancelled' then
    return v_status;
  end if;
  raise exception using errcode = 'P0001', message = 'INVALID_STATE';
end;
$$;

-- 실행 권한: 회원·책방지기 RPC는 authenticated, 서버 전용 RPC는 service_role만
revoke all on function
  public.create_order(jsonb), public.create_payment(uuid, uuid),
  public.request_cancel(text, uuid), public.withdraw_cancel(text, uuid), public.cancel_pending(text, uuid),
  public.reject_cancel(text, uuid), public.begin_refund(text, uuid), public.ship_order(uuid),
  public.confirm_payment(text, text, integer), public.fail_payment(text, text),
  public.complete_refund(uuid), public.fail_refund(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_order(jsonb), public.create_payment(uuid, uuid),
  public.request_cancel(text, uuid), public.withdraw_cancel(text, uuid), public.cancel_pending(text, uuid),
  public.reject_cancel(text, uuid), public.begin_refund(text, uuid), public.ship_order(uuid)
to authenticated;

grant execute on function
  public.confirm_payment(text, text, integer), public.fail_payment(text, text),
  public.complete_refund(uuid), public.fail_refund(uuid)
to service_role;
