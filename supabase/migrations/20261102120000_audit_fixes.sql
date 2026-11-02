-- Audit fixes. Safe to run more than once: every function is replaced whole.
--
-- 1. A returning customer who leaves the notes box empty keeps the notes the
--    team wrote. Only a non-empty note from the booking form replaces them.
--    (finalize_card_booking, as in 20260907200703_booking_app_upgrade, with
--    the preferences update guarded.)
-- 2. A normal trim never shares a chair with another active trim, squeezed or
--    not. The no-overlap constraint skips squeezed rows, so without this a
--    normal booking could be made over a squeeze-in. Raised as 23P01, the same
--    code as the constraint, so the routes' "That time is taken" handling
--    applies. Deliberate squeeze-ins (squeezed = true) are still allowed.
--    (validate_diary, as in 20260907200703_booking_app_upgrade, with the
--    check added first.)
-- 3. Trims booked together get one confirmation per channel for the whole
--    booking, not one per trim. Moves, cancellations, no-shows and running
--    late stay per trim, and so do reminders.
--    (record_booking_event, as in 20260911150000_checkout_edits, with the
--    confirmation dedupe key changed.)

create or replace function public.finalize_card_booking(p_attempt uuid,p_customer text,p_method text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.booking_attempts; g uuid; p jsonb; begin
 perform pg_advisory_xact_lock(749219);
 select * into a from public.booking_attempts where id=p_attempt for update;
 if not found then raise exception 'Booking draft not found'; end if;
 if a.group_id is not null then return a.group_id; end if;
 if a.expires_at<now() then raise exception 'Booking draft expired'; end if;
 p:=a.payload;
 if exists(select 1 from jsonb_array_elements(p->'appointments') item left join public.barbers b on b.slug=item->>'barber' left join public.services s on s.slug=item->>'service' left join public.service_prices sp on sp.barber_id=b.id and sp.service_id=s.id where sp.price_pence is null or sp.price_pence<>round((item->>'price')::numeric*100) or sp.duration<>(item->>'duration')::integer) then raise exception 'Price or duration changed during card setup'; end if;
 g:=public.create_booking_group(p->'customer'->>'name',p->'customer'->>'email',p->'customer'->>'country',p->'customer'->>'phone',(p->'customer'->>'marketing')::boolean,a.token_hash,p->'appointments');
 update public.booking_groups set policy_snapshot=p->'policy',policy_accepted_at=a.created_at,stripe_customer=p_customer,stripe_payment_method=p_method where id=g;
 if btrim(coalesce(p->'customer'->>'preferences',''))<>'' then
   update public.customers set preferences=p->'customer'->>'preferences' where id=(select customer_id from public.booking_groups where id=g);
 end if;
 update public.booking_attempts set group_id=g,payload='{}' where id=a.id;
 return g;
end $$;
revoke all on function public.finalize_card_booking(uuid,text,text) from public,anon,authenticated;
grant execute on function public.finalize_card_booking(uuid,text,text) to service_role;

create or replace function private.validate_diary() returns trigger language plpgsql set search_path='' as $$
declare o integer; c integer; policy jsonb; begin
 perform pg_advisory_xact_lock(749219);
 if TG_TABLE_NAME='bookings' then
   -- A normal trim cannot go over any active trim in that chair, squeezed ones included.
   -- On a change, a squeeze-in it already shared the chair with does not count.
   if new.status in ('booked','arrived') and not new.squeezed
      and (TG_OP='INSERT' or old.status not in ('booked','arrived') or old.squeezed or new.local_date<>old.local_date or new.start_minute<>old.start_minute or new.barber_id<>old.barber_id or new.duration<>old.duration)
      and exists(select 1 from public.bookings b where b.id<>new.id and b.barber_id=new.barber_id and b.local_date=new.local_date and b.status in ('booked','arrived') and b.slot_range && int4range(new.start_minute,new.start_minute+new.duration,'[)')
        and not (TG_OP='UPDATE' and old.status in ('booked','arrived') and not old.squeezed and b.barber_id=old.barber_id and b.local_date=old.local_date and b.slot_range && int4range(old.start_minute,old.start_minute+old.duration,'[)'))) then
     raise exception 'Time not available: another trim is in this chair' using errcode='23P01';
   end if;
   if TG_OP='UPDATE' and new.local_date=old.local_date and new.start_minute=old.start_minute and new.barber_id=old.barber_id and new.service_id=old.service_id and new.duration=old.duration then return new; end if;
   if new.status not in ('booked','arrived') then return new; end if;
   if (new.local_date + make_interval(mins=>new.start_minute)) <= (now() at time zone 'Europe/London') or new.local_date > (now() at time zone 'Europe/London')::date+120 then raise exception 'Choose a future time within 120 days'; end if;
   select open_minute,close_minute into o,c from public.opening_hours where iso_weekday=extract(isodow from new.local_date);
   if exists(select 1 from public.barber_schedules where barber_id=new.barber_id and iso_weekday=extract(isodow from new.local_date)) then
     select greatest(o,open_minute),least(c,close_minute) into o,c from public.barber_schedules where barber_id=new.barber_id and iso_weekday=extract(isodow from new.local_date) and open_minute is not null;
   end if;
   if o is null or c is null or new.start_minute<o or new.start_minute+new.duration>c then raise exception 'Outside barber working hours'; end if;
   if exists(select 1 from public.diary_blocks d where d.barber_id=new.barber_id and d.local_date=new.local_date and d.slot_range && int4range(new.start_minute,new.start_minute+new.duration,'[)')) then raise exception 'Time not available: diary block'; end if;
 else
   if exists(select 1 from public.bookings b where b.barber_id=new.barber_id and b.local_date=new.local_date and b.status in ('booked','arrived') and b.slot_range && int4range(new.start_minute,new.start_minute+new.duration,'[)')) then raise exception 'Move existing bookings before blocking this time'; end if;
 end if;
 return new;
end $$;

create or replace function private.record_booking_event() returns trigger language plpgsql set search_path='' as $$ declare e uuid; kind text; ch text; due timestamptz; begin
 kind:=case when TG_OP='INSERT' then 'confirmed' when new.status='cancelled' and old.status<>'cancelled' then 'cancelled' when new.status='no_show' and old.status<>'no_show' then 'no_show' when new.status in ('booked','arrived') and (new.local_date<>old.local_date or new.start_minute<>old.start_minute or new.barber_id<>old.barber_id or new.service_id<>old.service_id) then 'moved' when new.late_minutes<>old.late_minutes then 'running_late' else 'updated' end;
 insert into public.booking_events(booking_id,group_id,kind,detail) values(new.id,new.group_id,kind,jsonb_build_object('date',new.local_date,'time',new.start_minute,'status',new.status)) returning id into e;
 if kind in ('confirmed','moved','cancelled','no_show','running_late') then
 -- One confirmation per booking and channel, listing every trim in it; everything else per trim.
 foreach ch in array array['email','sms','push'] loop insert into public.notification_jobs(dedupe_key,group_id,booking_id,kind,channel) values(case when kind='confirmed' then 'confirmed-'||new.group_id::text||'-'||ch else e::text||ch end,new.group_id,new.id,kind,ch) on conflict (dedupe_key) do nothing; end loop;
 end if;
 if kind in ('confirmed','moved','cancelled','no_show') then
 update public.notification_jobs set status='cancelled' where booking_id=new.id and public.notification_jobs.kind='reminder' and status='pending';
 if new.status='booked' then
 due:=((new.local_date + make_interval(mins=>new.start_minute)) at time zone 'Europe/London')-interval '24 hours';
 if due>now() then foreach ch in array array['email','sms','push'] loop insert into public.notification_jobs(dedupe_key,group_id,booking_id,kind,channel,due_at) values(e::text||'reminder'||ch,new.group_id,new.id,'reminder',ch,due); end loop; end if;
 end if;
 end if;
 return new; end $$;
