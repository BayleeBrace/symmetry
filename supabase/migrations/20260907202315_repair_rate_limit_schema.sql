begin;

-- Some early installs used hits/window_started_at. Keep those columns intact,
-- while adding the canonical columns expected by the booking backend.
alter table public.rate_limits
  add column if not exists count integer not null default 1,
  add column if not exists expires_at timestamptz not null default now();

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
  n integer;
begin
  if p_key is null or length(p_key) <> 64 or p_limit < 1 or p_seconds < 1 then
    return false;
  end if;

  insert into public.rate_limits as limits (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_seconds))
  on conflict (key) do update
  set
    count = case
      when limits.expires_at < now() then 1
      else limits.count + 1
    end,
    expires_at = case
      when limits.expires_at < now()
        then now() + make_interval(secs => p_seconds)
      else limits.expires_at
    end
  returning count into n;

  return n <= p_limit;
end;
$$;

revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role;
revoke all on function public.take_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer)
  to service_role;

commit;
