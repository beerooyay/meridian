begin;

-- a lost response on the client triggers an idempotent retry of the same answer.
-- the row lock already serialises those, but under a true race two inserts can
-- reach the unique (run, q) index and the loser raised a bare unique-violation
-- that surfaced to players as "ranked request failed". make the insert absorb
-- the conflict and return the stored attempt instead of erroring.
create or replace function public.rankedanswer(p_run uuid, p_uid uuid, p_q integer, p_answer jsonb, p_correct boolean)
returns table(inserted boolean, q integer, correct boolean, points integer, ms integer)
language plpgsql security definer set search_path = '' as $$
declare
  r public.runs%rowtype;
  prior public.attempts%rowtype;
  saved public.attempts%rowtype;
  expected integer;
  stamp timestamptz;
  elapsed integer;
  award integer;
begin
  select * into r from public.runs where id = p_run and uid = p_uid for update;
  if not found or r.mode <> 'ranked' then
    raise exception 'ranked run not found';
  end if;
  select * into saved from public.attempts where run = p_run and public.attempts.q = p_q;
  if saved.id is not null then
    return query select false, saved.q, saved.correct, saved.points, saved.ms;
    return;
  end if;
  if r.state <> 'active' then
    raise exception 'ranked run is not active';
  end if;
  stamp := clock_timestamp();
  if stamp >= r.expires then
    raise exception 'ranked run expired';
  end if;
  select count(*) + 1 into expected from public.attempts where run = p_run;
  if p_q <> expected or p_q > r.qcount then
    raise exception 'question out of sequence';
  end if;
  select * into prior from public.attempts where run = p_run order by public.attempts.q desc limit 1;
  elapsed := greatest(0, round(extract(epoch from (stamp - coalesce(prior.created, r.started))) * 1000)::integer);
  award := case when p_correct then greatest(100, 1000 - elapsed / 10) else 0 end;
  insert into public.attempts (run, q, answer, correct, points, ms, created)
  values (p_run, p_q, p_answer, p_correct, award, elapsed, stamp)
  on conflict (run, q) do nothing
  returning public.attempts.* into saved;
  if saved.id is null then
    select * into saved from public.attempts where run = p_run and public.attempts.q = p_q;
    return query select false, saved.q, saved.correct, saved.points, saved.ms;
    return;
  end if;
  return query select true, saved.q, saved.correct, saved.points, saved.ms;
end;
$$;

revoke all on function public.rankedanswer(uuid, uuid, integer, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.rankedanswer(uuid, uuid, integer, jsonb, boolean) to service_role;

commit;
