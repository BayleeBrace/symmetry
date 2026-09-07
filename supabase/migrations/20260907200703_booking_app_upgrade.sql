-- Apply once AFTER the initial migration, first to a development database.
-- Capture this upgrade as a migration with Supabase CLI after connected verification.
begin;
create table public.shop_settings (
 id boolean primary key default true check (id), cancellation_hours integer not null default 6 check(cancellation_hours between 0 and 168),
 late_percent integer not null default 50 check(late_percent between 0 and 100), no_show_percent integer not null default 100 check(no_show_percent between 0 and 100),
 policy_confirmed boolean not null default false, version text not null default '2026-09-07'
);
insert into public.shop_settings(id) values(true);
alter table public.booking_groups add column policy_snapshot jsonb, add column policy_accepted_at timestamptz, add column stripe_customer text, add column stripe_payment_method text;
alter table public.customers add column preferences text not null default '' check(length(preferences)<=1000);
alter table public.bookings add column fee_pence integer not null default 0, add column fee_status text not null default 'none' check(fee_status in ('none','review','charging','charged','waived','failed')), add column payment_intent text, add column late_minutes integer not null default 0;
create table public.barber_schedules (barber_id uuid references public.barbers(id), iso_weekday smallint check(iso_weekday between 1 and 7), open_minute smallint, close_minute smallint, primary key(barber_id,iso_weekday), check((open_minute is null and close_minute is null) or (open_minute>=0 and close_minute<=1440 and close_minute>open_minute)));
create table public.booking_attempts (id uuid primary key, token_hash text unique not null, payload jsonb not null, stripe_session text, group_id uuid references public.booking_groups(id), created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 hour');
create table public.booking_events (id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id), group_id uuid references public.booking_groups(id), kind text not null, actor uuid, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.notification_jobs (id uuid primary key default gen_random_uuid(), dedupe_key text unique not null, group_id uuid references public.booking_groups(id), booking_id uuid references public.bookings(id), kind text not null, channel text not null check(channel in ('email','sms','push')), payload jsonb not null default '{}', due_at timestamptz not null default now(), status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')), attempts integer not null default 0, locked_at timestamptz, provider_id text, last_error text);
create index notification_due_idx on public.notification_jobs(due_at) where status='pending';
create table if not exists public.rate_limits (key text primary key, count integer not null, expires_at timestamptz not null);
alter table public.waitlist_requests add column email text, add column phone text, add column token_hash text unique, add column verified boolean not null default false;
alter table public.waitlist_requests alter column customer_id drop not null;
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), group_id uuid references public.booking_groups(id), staff_user uuid references auth.users(id), endpoint text unique not null, subscription jsonb not null, check ((group_id is null) <> (staff_user is null)));
-- Data access is through authenticated, explicitly authorized server routes.
do $$ declare t text; begin foreach t in array array['shop_settings','barber_schedules','booking_attempts','booking_events','notification_jobs','rate_limits','push_subscriptions'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); end loop; end $$;
-- Staff writes also go through guarded routes; remove broad direct update grants.
revoke update on public.bookings from authenticated;
revoke insert,update,delete on public.diary_blocks from authenticated;

create or replace function public.take_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$ declare n integer; begin
 insert into public.rate_limits(key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds)) on conflict(key) do update set count=case when public.rate_limits.expires_at<now() then 1 else public.rate_limits.count+1 end, expires_at=case when public.rate_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else public.rate_limits.expires_at end returning count into n;
 return n<=p_limit; end $$;

-- One lock order for both reservations and blocks, including moves between barbers.
create function private.validate_diary() returns trigger language plpgsql set search_path='' as $$
declare o integer; c integer; policy jsonb; begin
 perform pg_advisory_xact_lock(749219);
 if TG_TABLE_NAME='bookings' then
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
create trigger validate_booking before insert or update on public.bookings for each row execute function private.validate_diary();
create trigger validate_block before insert or update on public.diary_blocks for each row execute function private.validate_diary();
alter table public.diary_blocks drop constraint diary_blocks_duration_check;
alter table public.diary_blocks add check(duration between 5 and 1440);

create function private.record_booking_event() returns trigger language plpgsql set search_path='' as $$ declare e uuid; kind text; ch text; due timestamptz; begin
 kind:=case when TG_OP='INSERT' then 'confirmed' when new.status='cancelled' and old.status<>'cancelled' then 'cancelled' when new.status='no_show' and old.status<>'no_show' then 'no_show' when new.local_date<>old.local_date or new.start_minute<>old.start_minute or new.barber_id<>old.barber_id or new.service_id<>old.service_id then 'moved' when new.late_minutes<>old.late_minutes then 'running_late' else 'updated' end;
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
create trigger booking_event after insert or update on public.bookings for each row execute function private.record_booking_event();

create function public.change_customer_booking(p_group uuid,p_booking uuid,p_action text,p_date date default null,p_time integer default null,p_barber text default null,p_service text default null,p_accept_fee boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings; g public.booking_groups; pol jsonb; late boolean; bid uuid; sid uuid; dur integer; price integer; fee integer; begin
 perform pg_advisory_xact_lock(749219);
 select * into b from public.bookings where id=p_booking and group_id=p_group for update;
 if not found or b.status<>'booked' then raise exception 'This trim can no longer be changed'; end if;
 if b.local_date+make_interval(mins=>b.start_minute)<=now() at time zone 'Europe/London' then raise exception 'Contact the shop about a trim that has started'; end if;
 select * into g from public.booking_groups where id=p_group;
 pol:=g.policy_snapshot;
 late:=(b.local_date+make_interval(mins=>b.start_minute)) at time zone 'Europe/London' < now()+make_interval(hours=>coalesce((pol->>'cancellation_hours')::integer,6));
 fee:=round(b.price_pence*coalesce((pol->>'late_percent')::numeric,0)/100);
 if p_action='cancel' then
   if late and fee>0 and not p_accept_fee then raise exception 'Please accept the late cancellation fee'; end if;
   update public.bookings set status='cancelled',fee_pence=case when late then fee else 0 end,fee_status=case when late and fee>0 then 'review' else 'none' end,updated_at=now() where id=b.id;
 elsif p_action='reschedule' then
   if late then raise exception 'Within the cancellation window, contact the shop to move your trim'; end if;
   select br.id,s.id,sp.duration,sp.price_pence into bid,sid,dur,price from public.barbers br join public.service_prices sp on sp.barber_id=br.id join public.services s on s.id=sp.service_id where br.slug=p_barber and s.slug=p_service and br.active and s.active and sp.active;
   if bid is null then raise exception 'Choose an available barber and service'; end if;
   update public.bookings set local_date=p_date,start_minute=p_time,barber_id=bid,service_id=sid,duration=dur,price_pence=price,updated_at=now() where id=b.id;
 else raise exception 'Unknown change'; end if;
 return jsonb_build_object('ok',true,'feePence',case when late then fee else 0 end);
end $$;

create function public.finalize_card_booking(p_attempt uuid,p_customer text,p_method text) returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.customers set preferences=coalesce(p->'customer'->>'preferences','') where id=(select customer_id from public.booking_groups where id=g);
 update public.booking_attempts set group_id=g,payload='{}' where id=a.id;
 return g;
end $$;

create function public.claim_notification_jobs() returns setof public.notification_jobs language sql security definer set search_path='' as $$
 update public.notification_jobs set status='sending',attempts=attempts+1,locked_at=now() where id in (select id from public.notification_jobs where status='pending' and due_at<=now() order by due_at for update skip locked limit 10) returning *;
$$;

-- Secure server calls only, including all newly created functions.
revoke all on function public.take_rate_limit(text,integer,integer),public.change_customer_booking(uuid,uuid,text,date,integer,text,text,boolean),public.finalize_card_booking(uuid,text,text),public.claim_notification_jobs() from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,integer,integer),public.change_customer_booking(uuid,uuid,text,date,integer,text,text,boolean),public.finalize_card_booking(uuid,text,text),public.claim_notification_jobs() to service_role;
alter function public.create_booking_group(text,text,text,text,boolean,text,jsonb) rename to create_booking_group_unlocked;
revoke all on function public.create_booking_group_unlocked(text,text,text,text,boolean,text,jsonb) from public,anon,authenticated,service_role;
create function public.create_booking_group(p_customer_name text,p_email text,p_phone_country text,p_phone text,p_marketing boolean,p_manage_token_hash text,p_appointments jsonb) returns uuid language plpgsql security definer set search_path='' as $$ begin perform pg_advisory_xact_lock(749219);return public.create_booking_group_unlocked(p_customer_name,p_email,p_phone_country,p_phone,p_marketing,p_manage_token_hash,p_appointments);end $$;
revoke all on function public.create_booking_group(text,text,text,text,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_booking_group(text,text,text,text,boolean,text,jsonb) to service_role;
grant all on public.shop_settings,public.barber_schedules,public.booking_attempts,public.booking_events,public.notification_jobs,public.rate_limits,public.push_subscriptions to service_role;
commit;
