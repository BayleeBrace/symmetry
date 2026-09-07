create extension if not exists btree_gist with schema extensions;

create type public.staff_role as enum ('owner', 'barber');
create type public.booking_status as enum ('booked', 'arrived', 'done', 'no_show', 'cancelled');

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  role_label text not null,
  active boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  active boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.service_prices (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  duration smallint not null check (duration between 5 and 480),
  price_pence integer not null check (price_pence >= 0),
  active boolean not null default true,
  primary key (barber_id, service_id)
);

create table public.opening_hours (
  iso_weekday smallint primary key check (iso_weekday between 1 and 7),
  open_minute smallint,
  close_minute smallint,
  check ((open_minute is null and close_minute is null) or (open_minute >= 0 and close_minute <= 1440 and open_minute < close_minute))
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  email text not null,
  phone_country char(2) not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.booking_groups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  manage_token_hash char(64) not null unique,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.booking_groups(id) on delete restrict,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  local_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439 and start_minute % 15 = 0),
  duration smallint not null check (duration between 5 and 480),
  price_pence integer not null check (price_pence >= 0),
  status public.booking_status not null default 'booked',
  source text not null default 'web' check (source in ('web', 'staff', 'walk_in', 'import')),
  slot_range int4range generated always as (int4range(start_minute, start_minute + duration, '[)')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  exclude using gist (barber_id with =, local_date with =, slot_range with &&)
    where (status in ('booked', 'arrived')),
  exclude using gist (group_id with =, local_date with =, slot_range with &&)
    where (status in ('booked', 'arrived'))
);

create table public.diary_blocks (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  local_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439 and start_minute % 15 = 0),
  duration smallint not null check (duration between 5 and 480),
  label text not null default 'break' check (char_length(label) between 1 and 80),
  slot_range int4range generated always as (int4range(start_minute, start_minute + duration, '[)')) stored,
  created_at timestamptz not null default now(),
  exclude using gist (barber_id with =, local_date with =, slot_range with &&)
);

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  barber_id uuid unique references public.barbers(id) on delete set null,
  role public.staff_role not null default 'barber',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (role = 'owner' or barber_id is not null)
);

create table public.waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  preferred_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (customer_id, barber_id, service_id, preferred_date)
);

create table public.email_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  granted boolean not null,
  consent_copy text not null,
  consent_version text not null,
  recorded_at timestamptz not null default now()
);

create index bookings_date_status_idx on public.bookings (local_date, status);
create index bookings_group_idx on public.bookings (group_id);
create index diary_blocks_date_idx on public.diary_blocks (local_date, barber_id);
create index waitlist_active_date_idx on public.waitlist_requests (preferred_date) where active;
create index customers_auth_user_idx on public.customers (auth_user_id) where auth_user_id is not null;

insert into public.barbers (slug, name, role_label, display_order) values
  ('sean', 'Sean', 'owner, barber', 1),
  ('travis', 'Travis', 'senior barber', 2),
  ('dylan', 'Dylan', 'junior barber', 3);

insert into public.services (slug, name, display_order) values
  ('fade', 'fade / skin fade', 1), ('fade-beard', 'fade / skin fade with beard', 2),
  ('cut', 'standard cut', 3), ('cut-beard', 'standard cut with beard', 4),
  ('under-16', 'under 16’s fade', 5), ('under-13', 'under 13’s cut', 6),
  ('over-60', 'over 60’s trim', 7), ('one-length', 'one length', 8),
  ('line-beard', 'line up and beard trim', 9);

with price_data(barber_slug, service_slug, price_pence, duration) as (values
  ('dylan','fade',1700,50),('travis','fade',2200,45),('sean','fade',2400,40),
  ('dylan','fade-beard',2000,60),('travis','fade-beard',2500,50),('sean','fade-beard',2700,45),
  ('dylan','cut',1400,35),('travis','cut',1700,30),('sean','cut',1800,30),
  ('dylan','cut-beard',1700,45),('travis','cut-beard',2000,35),('sean','cut-beard',2100,30),
  ('dylan','under-16',1500,45),('travis','under-16',1800,40),('sean','under-16',1850,35),
  ('dylan','under-13',1000,40),('travis','under-13',1500,30),('sean','under-13',1550,25),
  ('dylan','over-60',1000,40),('travis','over-60',1200,25),('sean','over-60',1200,25),
  ('dylan','one-length',1000,20),('travis','one-length',1200,15),('sean','one-length',1200,15),
  ('dylan','line-beard',800,20),('travis','line-beard',1000,15),('sean','line-beard',1000,15)
)
insert into public.service_prices (barber_id, service_id, price_pence, duration)
select b.id, s.id, p.price_pence, p.duration from price_data p
join public.barbers b on b.slug = p.barber_slug join public.services s on s.slug = p.service_slug;

insert into public.opening_hours values
  (1,null,null),(2,540,1080),(3,660,1140),(4,660,1140),(5,540,1080),(6,480,900),(7,null,null);

create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.is_staff_for(target_barber uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members sm
    where sm.user_id = (select auth.uid()) and sm.active
      and (sm.role = 'owner' or sm.barber_id = target_barber)
  );
$$;
revoke all on function private.is_staff_for(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff_for(uuid) to authenticated;

alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.service_prices enable row level security;
alter table public.opening_hours enable row level security;
alter table public.customers enable row level security;
alter table public.booking_groups enable row level security;
alter table public.bookings enable row level security;
alter table public.diary_blocks enable row level security;
alter table public.staff_members enable row level security;
alter table public.waitlist_requests enable row level security;
alter table public.email_marketing_consents enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.barbers, public.services, public.service_prices, public.opening_hours to anon, authenticated;
grant select, update on public.bookings to authenticated;
grant select, insert, update, delete on public.diary_blocks to authenticated;
grant select on public.staff_members to authenticated;

create policy "active barbers are public" on public.barbers for select to anon, authenticated using (active);
create policy "active services are public" on public.services for select to anon, authenticated using (active);
create policy "active prices are public" on public.service_prices for select to anon, authenticated using (active);
create policy "opening hours are public" on public.opening_hours for select to anon, authenticated using (true);
create policy "staff read their diary" on public.bookings for select to authenticated using (private.is_staff_for(barber_id));
create policy "staff update their diary" on public.bookings for update to authenticated using (private.is_staff_for(barber_id)) with check (private.is_staff_for(barber_id));
create policy "staff read their blocks" on public.diary_blocks for select to authenticated using (private.is_staff_for(barber_id));
create policy "staff create their blocks" on public.diary_blocks for insert to authenticated with check (private.is_staff_for(barber_id));
create policy "staff update their blocks" on public.diary_blocks for update to authenticated using (private.is_staff_for(barber_id)) with check (private.is_staff_for(barber_id));
create policy "staff delete their blocks" on public.diary_blocks for delete to authenticated using (private.is_staff_for(barber_id));
create policy "staff see their membership" on public.staff_members for select to authenticated using (user_id = (select auth.uid()));

create function public.create_booking_group(
  p_customer_name text,
  p_email text,
  p_phone_country text,
  p_phone text,
  p_marketing boolean,
  p_manage_token_hash text,
  p_appointments jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid := gen_random_uuid();
  v_group uuid := gen_random_uuid();
  v_item jsonb;
  v_barber uuid;
  v_service uuid;
  v_date date;
  v_start smallint;
  v_duration smallint;
  v_price integer;
  v_open smallint;
  v_close smallint;
begin
  if jsonb_typeof(p_appointments) <> 'array' or jsonb_array_length(p_appointments) not between 1 and 12 then
    raise exception 'invalid appointments';
  end if;

  insert into public.customers (id, name, email, phone_country, phone)
  values (v_customer, p_customer_name, lower(p_email), upper(p_phone_country), p_phone);
  insert into public.booking_groups (id, customer_id, manage_token_hash)
  values (v_group, v_customer, p_manage_token_hash);

  for v_item in select value from jsonb_array_elements(p_appointments)
  loop
    v_date := (v_item->>'date')::date;
    v_start := (v_item->>'time')::smallint;
    select b.id, s.id, sp.duration, sp.price_pence into v_barber, v_service, v_duration, v_price
      from public.barbers b join public.service_prices sp on sp.barber_id = b.id
      join public.services s on s.id = sp.service_id
      where b.slug = v_item->>'barber' and s.slug = v_item->>'service'
        and b.active and s.active and sp.active;
    if not found then raise exception 'invalid barber or service'; end if;
    select oh.open_minute, oh.close_minute into v_open, v_close from public.opening_hours oh
      where oh.iso_weekday = extract(isodow from v_date)::smallint;
    if v_date < (now() at time zone 'Europe/London')::date or v_date > (now() at time zone 'Europe/London')::date + 120
      or v_open is null or v_start % 15 <> 0 or v_start < v_open or v_start + v_duration > v_close then
      raise exception 'invalid booking time';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_barber::text || v_date::text, 0));
    if exists (select 1 from public.diary_blocks db where db.barber_id = v_barber and db.local_date = v_date and db.slot_range && int4range(v_start, v_start + v_duration, '[)')) then
      raise exception 'time not available';
    end if;
    insert into public.bookings (group_id, barber_id, service_id, local_date, start_minute, duration, price_pence)
    values (v_group, v_barber, v_service, v_date, v_start, v_duration, v_price);
  end loop;

  if p_marketing then
    insert into public.email_marketing_consents (customer_id, granted, consent_copy, consent_version)
    values (v_customer, true, 'Email me occasional news, offers and product launches from Symmetry.', '2026-09-06');
  end if;
  return v_group;
end;
$$;
revoke all on function public.create_booking_group(text,text,text,text,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_booking_group(text,text,text,text,boolean,text,jsonb) to service_role;

comment on function public.create_booking_group is 'Server-only, atomic booking creation. Revalidates service, price, duration, hours and conflicts.';
