-- TKT-DB-05: 결제 대기 주문은 회원당 1건 (D-044, INV-21, AR-DB §5.3)
-- create_order의 시그니처·반환·권한은 0020과 같다(create or replace는 기존 grant를 유지한다). 본문만 바꾼다.

-- 1. 기존 데이터 정리: 회원마다 가장 최근 결제 대기 주문 1건만 남기고 나머지는 결제 전 취소 (D-044와 같은 결과)
update public.orders o
set status = 'cancelled'
where o.status = 'pending_payment'
  and o.member_id is not null
  and exists (
    select 1 from public.orders newer
    where newer.member_id = o.member_id
      and newer.status = 'pending_payment'
      and (newer.created_at, newer.id) > (o.created_at, o.id)
  );

-- 2. INV-21을 DB 제약으로
create unique index orders_one_pending_per_member on public.orders (member_id) where status = 'pending_payment';

-- 3. create_order: 결제 대기 주문이 같은 내용이면 재사용, 다르면 결제 전 취소로 대체한 뒤 새로 만든다
create or replace function public.create_order(p_ship jsonb)
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
  v_pending public.orders;
  v_same_items boolean;
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

  -- 같은 회원의 동시 호출(두 탭)을 줄 세운다. 트랜잭션이 끝나면 풀린다
  perform pg_advisory_xact_lock(hashtextextended(v_member::text, 0));

  select sum(c.quantity * p.price) into v_total
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.member_id = v_member and p.stock > 0;
  if v_total is null then
    raise exception using errcode = 'P0001', message = 'OUT_OF_STOCK';
  end if;

  select * into v_pending from public.orders
  where member_id = v_member and status = 'pending_payment'
  for update;

  if found then
    -- 같은 내용 = 배송지 3칸, 책·수량·현재 가격 집합, 합계가 모두 같음 (AR-DB §5.3)
    select not exists (
      (select oi.product_id, oi.quantity, oi.unit_price
       from public.order_items oi where oi.order_id = v_pending.id
       except
       select c.product_id, c.quantity, p.price
       from public.cart_items c join public.products p on p.id = c.product_id
       where c.member_id = v_member and p.stock > 0)
      union all
      (select c.product_id, c.quantity, p.price
       from public.cart_items c join public.products p on p.id = c.product_id
       where c.member_id = v_member and p.stock > 0
       except
       select oi.product_id, oi.quantity, oi.unit_price
       from public.order_items oi where oi.order_id = v_pending.id)
    ) into v_same_items;

    if v_same_items
       and v_pending.total_amount = v_total
       and v_pending.ship_recipient_name = v_name
       and v_pending.ship_phone = v_phone
       and v_pending.ship_address = v_address then
      return v_pending;   -- 재사용 (AC-08-9)
    end if;

    -- 대체: 이전 결제 대기 주문은 결제 전 취소 (AC-08-10). 재고는 확정 때만 줄므로 되돌릴 것이 없다
    update public.orders set status = 'cancelled' where id = v_pending.id;
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
