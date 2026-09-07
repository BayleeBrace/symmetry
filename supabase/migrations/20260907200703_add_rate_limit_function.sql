-- Shared rate limits for authenticated server routes. Keys are one-way hashes,
-- and only the service role can call the function.
create table public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  hits integer not null default 1 check (hits > 0),
  updated_at timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

create or replace function public.take_rate_limit(
  p_key text,
  p_limit integer,
  p_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_key is null or length(p_key) <> 64 or p_limit < 1 or p_seconds < 1 then
    return false;
  end if;

  insert into public.rate_limits as limits (
    key,
    window_started_at,
    hits,
    updated_at
  )
  values (p_key, now(), 1, now())
  on conflict (key) do update
  set
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_seconds)
        then now()
      else limits.window_started_at
    end,
    hits = case
      when limits.window_started_at <= now() - make_interval(secs => p_seconds)
        then 1
      else least(limits.hits + 1, p_limit + 1)
    end,
    updated_at = now()
  returning hits <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.take_rate_limit(text, integer, integer) from public;
revoke all on function public.take_rate_limit(text, integer, integer) from anon;
revoke all on function public.take_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;
