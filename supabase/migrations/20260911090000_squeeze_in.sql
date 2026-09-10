-- Squeeze-ins: staff can book a trim over a time that is already taken,
-- the way Fresha does, and the calendar shows the two side by side.
-- Online bookings still cannot overlap anything; only a trim marked
-- "squeezed" by staff is allowed to share a slot.
alter table public.bookings add column if not exists squeezed boolean not null default false;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.bookings'::regclass and contype = 'x'
  loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.bookings add constraint bookings_chair_no_overlap
  exclude using gist (barber_id with =, local_date with =, slot_range with &&)
  where (status in ('booked', 'arrived') and not squeezed);
alter table public.bookings add constraint bookings_group_no_overlap
  exclude using gist (group_id with =, local_date with =, slot_range with &&)
  where (status in ('booked', 'arrived') and not squeezed);
