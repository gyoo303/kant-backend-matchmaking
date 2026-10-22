-- TKT-BE-M3-02 (사용자 승인 2026-10-22, 절차 예외: BE가 DB 경로에 작성)
-- create_payment는 주문·회차 중 하나만 받는다(둘 중 하나는 null). 인자에 default null을 붙여
-- `supabase gen types`가 두 인자를 선택 인자로 만들게 한다. 그래야 lib/data가 타입 우회 없이 한쪽만 넘길 수 있다.
-- 본문·반환·권한은 0030_subscription.sql과 같다(create or replace는 기존 grant를 유지한다).

create or replace function public.create_payment(p_order_id uuid default null, p_round_id uuid default null)
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
