-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free',
  quota_used int not null default 0,
  quota_limit int not null default 5,
  quota_reset date not null default (current_date + interval '1 month'),
  plan_expires_at timestamptz,
  created_at timestamptz default now()
);

-- GENERATIONS (riwayat)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_name text,
  category text,
  tone text,
  language text,
  input_features text,
  image_url text,
  output_text text,
  word_count int,
  seo_score int,
  created_at timestamptz default now()
);

-- PAYMENTS (log transaksi & langganan)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id text unique not null,
  plan text not null,
  period text not null default 'monthly',
  amount int not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.payments enable row level security;

-- POLICIES (drop dulu biar aman dijalankan ulang)
drop policy if exists "own profile" on public.profiles;
drop policy if exists "own generations" on public.generations;
drop policy if exists "own payments" on public.payments;

create policy "own profile" on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own generations" on public.generations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own payments" on public.payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- TRIGGER: buat profil otomatis saat user daftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
