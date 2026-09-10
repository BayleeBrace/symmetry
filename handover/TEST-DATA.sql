-- Test clients and trims for trying the staff app.
-- Run once in the Supabase SQL editor. Remove them later with TEST-DATA-REMOVE.sql.
--
-- Ten clients with realistic names and between one and five past visits each
-- (done, paid by card or cash, one no show), then four trims a day on every
-- chair for the rest of today and the next ten days. Every record carries
-- "Test record" in its preferences, which is how the removal script finds
-- them. Emails and mobiles are left blank so no message can ever go out to a
-- real person from these records. If the test clients are already in, run
-- TEST-DATA-REMOVE.sql first so they are not added twice.
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
  o int;
  c int;
  cids uuid[] := '{}';
  j int;
  q int;
  n int := 0;
  nowm int;
  today date := (now() at time zone 'Europe/London')::date;
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
    cids := cids || cid;

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
      d := today - 7 * (i % 6 + 1) - (k - 1) * (21 + (i % 3) * 7);
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

  end loop;

  -- Upcoming trims: the rest of today and the next ten days, every chair, four
  -- a day, inside shop hours and each chair's shift, spread across the test
  -- clients. Trims earlier today are already done, so today's sales and the
  -- visit history have figures in them. Anything the diary refuses (a taken
  -- slot, a block) is skipped with a notice rather than stopping the script.
  nowm := extract(hour from (now() at time zone 'Europe/London'))::int * 60
        + extract(minute from (now() at time zone 'Europe/London'))::int;
  n := 0;
  for k in 0..10 loop
    d := today + k;
    for j in 1..array_length(chairs, 1) loop
      b := chairs[j];
      select oh.open_minute, oh.close_minute into o, c
        from public.opening_hours oh where oh.iso_weekday = extract(isodow from d);
      if exists (select 1 from public.barber_schedules bs
                  where bs.barber_id = b and bs.iso_weekday = extract(isodow from d)) then
        select greatest(o, bs.open_minute), least(c, bs.close_minute) into o, c
          from public.barber_schedules bs
         where bs.barber_id = b and bs.iso_weekday = extract(isodow from d) and bs.open_minute is not null;
      end if;
      if o is null or c is null then
        continue;
      end if;
      for q in 0..3 loop
        m := o + 30 + q * 90 + 15 * ((j + q) % 2);
        n := n + 1;
        cid := cids[1 + n % array_length(cids, 1)];
        s := case when n % 3 = 0 and cut is not null then cut else fade end;
        select sp.duration, sp.price_pence into dur, price
          from public.service_prices sp where sp.barber_id = b and sp.service_id = s and sp.active;
        dur := coalesce(dur, 30);
        price := coalesce(price, 2200);
        if m + dur > c then
          continue;
        end if;
        if k = 0 and m <= nowm then
          st := 'done';
          pb := case when n % 2 = 0 then 'card' else 'cash' end;
        else
          st := 'booked';
          pb := null;
        end if;
        begin
          insert into public.booking_groups (customer_id, manage_token_hash)
          values (cid, encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'))
          returning id into gid;
          insert into public.bookings (group_id, barber_id, service_id, local_date, start_minute, duration, price_pence, status, source, paid_by)
          values (gid, b, s, d, m, dur, price, st::public.booking_status, 'import', pb)
          on conflict do nothing;
        exception when others then
          raise notice 'Skipped a trim on % at % minutes: %', d, m, sqlerrm;
        end;
      end loop;
    end loop;
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
