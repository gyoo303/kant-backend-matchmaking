-- TKT-DB-04: 주소록 다운로드 기록, 발송 대상 목록, 관리자 홈 숫자, 회원 탈퇴
-- 기준: docs/02-arch/03-db-schema.md §3·§4·§5·§7·§9, ADR-007, PM-DOMAIN §7, INV-17

-- ENT-14 ShippingList 다운로드 기록 (ADR-007, RISK-09)
create table public.shipping_list_downloads (
  id uuid primary key default gen_random_uuid(),
  keeper_id uuid references public.profiles (id) on delete set null,
  row_count integer not null check (row_count >= 1),
  created_at timestamptz not null default now()
);

alter table public.shipping_list_downloads enable row level security;

-- §4: 책방지기 insert·select만 (회원·비로그인 정책 없음)
create policy shipping_list_downloads_select_keeper on public.shipping_list_downloads
  for select to authenticated using ((select public.is_keeper()));
create policy shipping_list_downloads_insert_keeper on public.shipping_list_downloads
  for insert to authenticated
  with check ((select public.is_keeper()) and keeper_id = (select auth.uid()));

revoke update, delete on public.shipping_list_downloads from anon, authenticated;

-- SEQ-11, INV-17: 발송 대기 건(paid 주문, 취소 요청 표시가 없는 arrived·reading 회차)의 결제 시점 배송지
create function public.list_shipping_targets()
returns table (
  kind text,                 -- 'order' | 'round'
  target_id uuid,
  order_number text,         -- 회차는 null
  recipient_name text,
  phone text,
  address text,
  books text,                -- 주문: '책 이름 × 수량' 목록, 회차: 매칭한 책 이름(아직 없으면 null)
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';   -- AC-19-3
  end if;

  return query
  select 'order'::text, o.id, o.order_number, o.ship_recipient_name, o.ship_phone, o.ship_address,
         (select string_agg(oi.product_name || ' × ' || oi.quantity, ', ' order by oi.product_name)
          from public.order_items oi where oi.order_id = o.id),
         o.paid_at
  from public.orders o
  where o.status = 'paid' and o.member_id is not null
  union all
  select 'round'::text, r.id, null::text, r.ship_recipient_name, r.ship_phone, r.ship_address,
         (select p.name from public.round_contents rc join public.products p on p.id = rc.product_id
          where rc.round_id = r.id),
         r.paid_at
  from public.subscription_rounds r
  where r.status in ('arrived', 'reading') and r.cancel_requested_at is null and r.member_id is not null
  order by 8;
end;
$$;

-- SCR-20 오늘 할 일 수: 도착한 편지, 발송 대기 주문, 취소 요청(주문 + 회차 표시)
create function public.keeper_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_keeper()) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'arrivedLetters', (select count(*) from public.subscription_rounds where status = 'arrived'),
    'ordersToShip', (select count(*) from public.orders where status = 'paid' and member_id is not null),
    'cancelRequests',
      (select count(*) from public.orders where status = 'cancel_requested' and member_id is not null)
      + (select count(*) from public.subscription_rounds where cancel_requested_at is not null and member_id is not null)
  );
end;
$$;

-- SEQ-10, AR-DB §7: 탈퇴. 사적인 글·배송지·장바구니 삭제, 결제 대기 건 취소, 거래 기록은 연결만 끊고 보관
-- 반환: { postcardPaths: [...] } — 서버가 Storage 엽서 삭제 → auth.admin.deleteUser(uid)(→ profiles cascade) → 로그아웃
create function public.withdraw_member()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_paths jsonb;
begin
  if v_member is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  -- 1. 거부: 발송 전 결제 완료 주문, 결제 확정된 진행 중 회차 (AC-05-7·9)
  if exists (select 1 from public.orders where member_id = v_member and status in ('paid', 'cancel_requested'))
     or exists (select 1 from public.subscription_rounds where member_id = v_member and status in ('arrived', 'reading')) then
    raise exception using errcode = 'P0001', message = 'WITHDRAW_BLOCKED';
  end if;

  -- 2. 결제 대기 주문·회차 → cancelled (AC-05-8)
  update public.orders set status = 'cancelled' where member_id = v_member and status = 'pending_payment';
  update public.subscription_rounds set status = 'cancelled' where member_id = v_member and status = 'pending_payment';

  -- 3. 사적인 글·배송지·장바구니 삭제 (엽서 경로는 먼저 모은다)
  select coalesce(jsonb_agg(rc.postcard_path), '[]'::jsonb) into v_paths
  from public.round_contents rc
  join public.subscription_rounds r on r.id = rc.round_id
  where r.member_id = v_member and rc.postcard_path is not null;

  delete from public.round_contents rc
  using public.subscription_rounds r
  where r.id = rc.round_id and r.member_id = v_member;
  delete from public.reader_letters
  where member_id = v_member
     or round_id in (select id from public.subscription_rounds where member_id = v_member);
  delete from public.shelf_memos where member_id = v_member;
  delete from public.farewell_notes
  where member_id = v_member
     or subscription_id in (select id from public.subscriptions where member_id = v_member);
  delete from public.shipping_addresses where member_id = v_member;
  delete from public.cart_items where member_id = v_member;

  -- 4. 거래 기록은 회원 연결만 끊는다(payments는 주문·회차를 거쳐 소유). 활성 구독은 마무리한다
  update public.subscriptions set status = 'ended', ended_at = now()
  where member_id = v_member and status = 'active';
  update public.orders set member_id = null where member_id = v_member;
  update public.subscription_rounds set member_id = null where member_id = v_member;
  update public.subscriptions set member_id = null where member_id = v_member;

  return jsonb_build_object('postcardPaths', v_paths);
end;
$$;

revoke all on function public.list_shipping_targets(), public.keeper_counts(), public.withdraw_member()
from public, anon, authenticated;
grant execute on function public.list_shipping_targets(), public.keeper_counts(), public.withdraw_member()
to authenticated;
