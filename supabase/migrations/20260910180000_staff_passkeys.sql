-- Face ID and fingerprint sign-in for staff: one passkey per phone per person.
-- The phone keeps the private key; this table holds only the public key.
create table if not exists public.staff_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists staff_passkeys_user_idx on public.staff_passkeys(user_id);
alter table public.staff_passkeys enable row level security;
revoke all on public.staff_passkeys from anon, authenticated;
