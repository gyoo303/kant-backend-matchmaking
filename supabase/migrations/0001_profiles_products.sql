-- TKT-DB-01: enum 전체, profiles, products, is_keeper, 가입 트리거, set_updated_at, book-covers 버킷
-- 기준: docs/02-arch/03-db-schema.md §2·§3·§4·§6·§9, ADR-001·003

-- §2 Enum (전체 테이블이 쓰는 enum을 한 번에 만든다)
create type public.theme as enum ('nature', 'food', 'ecology', 'local');
create type public.member_role as enum ('member', 'keeper');
create type public.order_status as enum ('pending_payment', 'paid', 'cancel_requested', 'shipped', 'refunded', 'cancelled');
create type public.subscription_status as enum ('active', 'ended');
create type public.round_status as enum ('pending_payment', 'arrived', 'reading', 'shipped', 'unboxed', 'cancelled');
create type public.payment_status as enum ('ready', 'paid', 'refunding', 'refunded', 'failed');

-- 공통: 변경되는 테이블의 updated_at 갱신
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ENT-01 Member (+ Keeper)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '독자',
  role public.member_role not null default 'member',
  created_at timestamptz not null default now()
);

-- 책방지기 판별은 이 함수 하나로 한다 (ADR-003)
create function public.is_keeper()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'keeper'
  );
$$;

-- 가입 트리거: 닉네임은 소셜 제공자 이름, 없으면 '독자' (D-A06)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
      '독자'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ENT-02 Product
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  author text not null check (char_length(author) between 1 and 100),
  price integer not null check (price >= 0),
  image_url text not null,
  description text not null check (char_length(description) between 1 and 300),
  theme public.theme not null,
  keeper_note text not null check (char_length(keeper_note) >= 1),
  publisher_description text,
  stock integer not null check (stock >= 0),          -- INV-05
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_theme_created_idx on public.products (theme, created_at desc);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- §4 RLS (기본 거부, 정책 표 그대로)
alter table public.profiles enable row level security;
alter table public.products enable row level security;

-- profiles: 회원은 자기 행, 책방지기는 전체 select. 회원 update는 nickname 컬럼만
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_keeper on public.profiles
  for select to authenticated
  using ((select public.is_keeper()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

-- products: 누구나 select, 책방지기만 insert·update, delete 정책 없음 (D-023)
create policy products_select_all on public.products
  for select to anon, authenticated
  using (true);

create policy products_insert_keeper on public.products
  for insert to authenticated
  with check ((select public.is_keeper()));

create policy products_update_keeper on public.products
  for update to authenticated
  using ((select public.is_keeper()))
  with check ((select public.is_keeper()));

-- §6 Storage: book-covers (공개, 이미지 MIME, 5MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy book_covers_select_all on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'book-covers');

create policy book_covers_insert_keeper on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-covers' and (select public.is_keeper()));

create policy book_covers_update_keeper on storage.objects
  for update to authenticated
  using (bucket_id = 'book-covers' and (select public.is_keeper()))
  with check (bucket_id = 'book-covers' and (select public.is_keeper()));
