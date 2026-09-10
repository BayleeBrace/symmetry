-- Test clients and trims for trying the staff app.
-- Run once in the Supabase SQL editor. Remove them later with TEST-DATA-REMOVE.sql.
--
-- Ten clients with realistic names, between one and five past visits each
-- (done, paid by card or cash, one no show), and an upcoming trim for the
-- first four. Every record carries "Test record" in its preferences, which is
-- how the removal script finds them. Emails and mobiles are left blank so no
-- message can ever go out to a real person from these records.
do $$
declare
  names text[] := array[
    'Rhys Davies', 'Owen Price', 'Tom Harris', 'Jack Lewis', 'Huw Bevan',
    'Gareth Owen', 'Ioan Rees', 'Dafydd Morgan', 'Cai Thomas', 'Ellis Hughes'
  ];
  prefs text[] := array[
    'Skin fade, keep the top long.', '', 'Number two on the sides.', '',
    'Beard tidy as well when there is time.', '', '', 'Prefers early mornings.', '', ''
  ];
  chairs uuid[];
  fade uuid;
  cut uuid;
  i int;
  k int;
  cid uuid;
  gid uuid;
  b uuid;
  s uuid;
  d date;
  m int;
  dur int;
  price int;
  st text;
  pb text;
begin
  select array_agg(id order by display_order) into chairs from public.barbers where active;
  select id into fade from public.services where slug = 'fade';
  select id into cut from public.services where slug = 'cut';
  if chairs is null or fade is null then
    raise exception 'Barbers or services are missing; run the booking migrations first';
  end if;

  for i in 1..array_length(names, 1) loop
    insert into public.customers (name, email, phone_country, phone, preferences)
    values (names[i], '', 'GB', '', trim('Test record. ' || prefs[i]))
    returning id into cid;

    -- Half of them ticked the reminder box.
    if i % 2 = 0 then
      insert into public.email_marketing_consents (customer_id, granted, consent_copy, consent_version)
      values (cid, true, 'Remind me when I''m due a trim, plus occasional news from Symmetry.', '2026-09-08');
    end if;

    -- Past visits: the most recent one to six weeks ago, then every three to five weeks before that.
    for k in 1..(1 + i % 5) loop
      b := chairs[1 + (i + k) % array_length(chairs, 1)];
      s := case when (i + k) % 3 = 0 and cut is not null then cut else fade end;
      select sp.duration, sp.price_pence into dur, price
        from public.service_prices sp where sp.barber_id = b and sp.service_id = s and sp.active;
      d := current_date - 7 * (i % 6 + 1) - (k - 1) * (21 + (i % 3) * 7);
      m := 540 + 15 * ((i * 3 + k * 5) % 28);
      st := case when k = 1 and i % 4 = 0 then 'no_show' else 'done' end;
      pb := case when st = 'done' then (case when (i + k) % 2 = 0 then 'card' else 'cash' end) else null end;
      insert into public.booking_groups (customer_id, manage_token_hash)
      values (cid, encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'))
      returning id into gid;
      insert into public.bookings (group_id, barber_id, service_id, local_date, start_minute, duration, price_pence, status, source, paid_by)
      values (gid, b, s, d, m, coalesce(dur, 30), coalesce(price, 2200), st::public.booking_status, 'import', pb)
      on conflict do nothing;
    end loop;

    -- An upcoming trim for the first four, in the next week, never on a Sunday.
    -- If a real trim already has that slot, this one is simply skipped.
    if i <= 4 then
      d := current_date + 2 + i;
      if extract(isodow from d) = 7 then d := d + 1; end if;
      b := chairs[1 + i % array_length(chairs, 1)];
      select sp.duration, sp.price_pence into dur, price
        from public.service_prices sp where sp.barber_id = b and sp.service_id = fade and sp.active;
      insert into public.booking_groups (customer_id, manage_token_hash)
      values (cid, encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'))
      returning id into gid;
      insert into public.bookings (group_id, barber_id, service_id, local_date, start_minute, duration, price_pence, status, source)
      values (gid, b, fade, d, 600 + 30 * i, coalesce(dur, 30), coalesce(price, 2200), 'booked', 'import')
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- What went in.
select c.name, count(b.id) filter (where b.status = 'done') as visits,
       count(b.id) filter (where b.status = 'no_show') as no_shows,
       count(b.id) filter (where b.status = 'booked') as upcoming
  from public.customers c
  left join public.booking_groups g on g.customer_id = c.id
  left join public.bookings b on b.group_id = g.id
 where c.preferences like 'Test record%'
 group by c.name
 order by c.name;
