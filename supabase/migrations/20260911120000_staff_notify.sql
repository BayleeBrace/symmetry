-- Staff push notification choices: which kinds each staff member wants.
-- A missing key means "yes", so everyone gets everything until they switch
-- something off under Settings, Notifications.
alter table public.staff_members
  add column if not exists notify jsonb not null default '{}'::jsonb;
