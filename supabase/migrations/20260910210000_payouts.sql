-- Payouts: what each barber keeps, and a record of every amount paid out.
-- Bank details are optional, entered by the owner, and only used to fill the
-- bulk-payment file for the shop's bank.
create table if not exists public.payout_rules (
  barber_id uuid primary key references public.barbers(id) on delete cascade,
  share_percent smallint not null default 100 check (share_percent between 0 and 100),
  weekly_rent_pence integer not null default 0 check (weekly_rent_pence >= 0),
  keeps_cash boolean not null default true,
  bank_name text not null default '',
  bank_sort_code text not null default '' check (bank_sort_code = '' or bank_sort_code ~ '^[0-9]{6}$'),
  bank_account text not null default '' check (bank_account = '' or bank_account ~ '^[0-9]{8}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete restrict,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  sales_pence integer not null default 0,
  card_pence integer not null default 0,
  cash_pence integer not null default 0,
  amount_pence integer not null,
  note text not null default '' check (length(note) <= 200),
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users(id) on delete set null,
  unique (barber_id, period_start, period_end)
);
create index if not exists payouts_barber_idx on public.payouts(barber_id, period_start desc);

-- The boys keep the cash they take, so cash comes off what the shop transfers.
alter table public.payout_rules alter column keeps_cash set default true;
alter table public.payout_rules enable row level security;
alter table public.payouts enable row level security;
revoke all on public.payout_rules from anon, authenticated;
revoke all on public.payouts from anon, authenticated;
