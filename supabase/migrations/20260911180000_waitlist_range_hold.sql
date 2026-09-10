-- Waitlist: a run of days rather than one, and offers made to one person at a
-- time. A freed slot is offered to the first person waiting; if they have not
-- booked within five minutes it goes to the next. Nobody is offered the same
-- day more than twice.
alter table public.waitlist_requests
  add column if not exists until_date date,
  add column if not exists offered_at timestamptz,
  add column if not exists offered_slot text,
  add column if not exists offer_count integer not null default 0;
