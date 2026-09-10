-- Customer directory. Apply after booking_app_upgrade and rate-limit repair.
-- Consolidate only identical guest records with both contact details, the same
-- preferences, and no waitlist membership. Preserve source records for review.
alter table public.customers add column directory_parent_id uuid references public.customers(id);
with matches as (
 select id, first_value(id) over (
  partition by name,email,phone,phone_country,preferences order by created_at,id
 ) canonical_id from public.customers c
 where auth_user_id is null and email <> '' and phone <> ''
 and not exists(select 1 from public.waitlist_requests w where w.customer_id=c.id)
)
update public.customers c set directory_parent_id=m.canonical_id
from matches m where c.id=m.id and m.id<>m.canonical_id;
update public.booking_groups g set customer_id=c.directory_parent_id
from public.customers c where g.customer_id=c.id and c.directory_parent_id is not null;
update public.email_marketing_consents e set customer_id=c.directory_parent_id
from public.customers c where e.customer_id=c.id and c.directory_parent_id is not null;
create index if not exists customers_directory_name_idx on public.customers(lower(name), id);
create index if not exists customers_directory_identity_idx on public.customers(lower(trim(name)), lower(trim(email)), phone);
create index if not exists booking_groups_customer_idx on public.booking_groups(customer_id);
create or replace function public.create_booking_group_unlocked(
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

  -- Only reuse an exact name and both contact details. Never match by name alone.
  select id into v_customer from public.customers
  where lower(trim(name)) = lower(trim(p_customer_name))
    and lower(trim(email)) = lower(trim(p_email)) and trim(p_email) <> ''
    and phone = p_phone and p_phone <> '' and auth_user_id is null and directory_parent_id is null
  order by created_at, id limit 1;
  if v_customer is null then
    v_customer := gen_random_uuid();
    insert into public.customers (id, name, email, phone_country, phone)
    values (v_customer, trim(p_customer_name), lower(trim(p_email)), upper(p_phone_country), p_phone);
  end if;
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
revoke all on function public.create_booking_group_unlocked(text,text,text,text,boolean,text,jsonb) from public, anon, authenticated, service_role;
