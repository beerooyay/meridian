begin;

create table if not exists public.ratelimit (
  bucket text not null,
  key text not null,
  hits integer not null default 0,
  window bigint not null,
  primary key (bucket, key)
);

revoke all on public.ratelimit from anon, authenticated;

create or replace function public.ratelimit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  now_epoch bigint := extract(epoch from now())::bigint;
  row_window bigint;
  row_hits integer;
begin
  select window, hits into row_window, row_hits
  from public.ratelimit
  where bucket = p_bucket and key = p_key
  for update;

  if row_window is null or now_epoch >= row_window then
    insert into public.ratelimit (bucket, key, hits, window)
    values (p_bucket, p_key, 1, now_epoch + p_seconds)
    on conflict (bucket, key) do update
      set hits = 1, window = now_epoch + p_seconds;
    return true;
  end if;

  if row_hits >= p_limit then
    return false;
  end if;

  update public.ratelimit
  set hits = hits + 1
  where bucket = p_bucket and key = p_key;

  return true;
end;
$$;

grant execute on function public.ratelimit(text, text, integer, integer) to service_role;

commit;
