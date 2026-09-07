-- Rebook reminders ("Time for a trim?"): when a customer was last nudged, and the wording they agreed to when booking.
alter table public.customers add column last_nudged_at timestamptz;

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
    values (v_customer, true, 'Remind me when I''m due a trim, plus occasional news from Symmetry.', '2026-09-08');
  end if;
  return v_group;
end;
$$;
