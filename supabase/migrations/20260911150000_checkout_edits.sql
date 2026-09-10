-- Checkout edits: when a trim is marked done with a different service or
-- price (a fade that became a fade and beard), that is not a "moved" trim.
-- The event log records it as an update and no customer message is queued.
-- Same function as the booking app upgrade, with one condition added.
create or replace function private.record_booking_event() returns trigger language plpgsql set search_path='' as $$ declare e uuid; kind text; ch text; due timestamptz; begin
 kind:=case when TG_OP='INSERT' then 'confirmed' when new.status='cancelled' and old.status<>'cancelled' then 'cancelled' when new.status='no_show' and old.status<>'no_show' then 'no_show' when new.status in ('booked','arrived') and (new.local_date<>old.local_date or new.start_minute<>old.start_minute or new.barber_id<>old.barber_id or new.service_id<>old.service_id) then 'moved' when new.late_minutes<>old.late_minutes then 'running_late' else 'updated' end;
 insert into public.booking_events(booking_id,group_id,kind,detail) values(new.id,new.group_id,kind,jsonb_build_object('date',new.local_date,'time',new.start_minute,'status',new.status)) returning id into e;
 if kind in ('confirmed','moved','cancelled','no_show','running_late') then
 foreach ch in array array['email','sms','push'] loop insert into public.notification_jobs(dedupe_key,group_id,booking_id,kind,channel) values(e::text||ch,new.group_id,new.id,kind,ch); end loop;
 end if;
 if kind in ('confirmed','moved','cancelled','no_show') then
 update public.notification_jobs set status='cancelled' where booking_id=new.id and public.notification_jobs.kind='reminder' and status='pending';
 if new.status='booked' then
 due:=((new.local_date + make_interval(mins=>new.start_minute)) at time zone 'Europe/London')-interval '24 hours';
 if due>now() then foreach ch in array array['email','sms','push'] loop insert into public.notification_jobs(dedupe_key,group_id,booking_id,kind,channel,due_at) values(e::text||'reminder'||ch,new.group_id,new.id,'reminder',ch,due); end loop; end if;
 end if;
 end if;
 return new; end $$;
