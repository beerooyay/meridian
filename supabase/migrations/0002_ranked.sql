begin;

alter table public.runs drop constraint run_scope;
alter table public.runs add constraint run_scope check (scope ~ '^[a-z0-9][a-z0-9:-]{0,63}$');
alter table public.dailies drop constraint daily_scope;
alter table public.dailies add constraint daily_scope check (scope ~ '^[a-z0-9][a-z0-9:-]{0,63}$');

create or replace function public.guardrun() returns trigger
language plpgsql set search_path = '' as $$
declare
  d public.dailies%rowtype;
  answered integer;
  hits integer;
  points bigint;
begin
  if tg_op = 'INSERT' and new.state <> 'issued' then
    raise exception 'run must be issued';
  end if;
  if tg_op = 'UPDATE' and (
    new.uid <> old.uid or new.game <> old.game or new.mode <> old.mode or new.scope <> old.scope or
    new.qcount <> old.qcount or new.holes is distinct from old.holes or new.season is distinct from old.season or
    new.day is distinct from old.day or new.seed <> old.seed or new.config <> old.config or
    new.course is distinct from old.course or new.nonce <> old.nonce or new.issued <> old.issued or
    new.expires is distinct from old.expires
  ) then
    raise exception 'run issuance is immutable';
  end if;
  if tg_op = 'UPDATE' and old.state in ('complete', 'expired', 'void') and new is distinct from old then
    raise exception 'final run is immutable';
  end if;
  if tg_op = 'UPDATE' and old.started is not null and new.started is distinct from old.started then
    raise exception 'run start is immutable';
  end if;
  if tg_op = 'UPDATE' and not (
    (old.state = 'issued' and new.state in ('issued', 'active', 'expired', 'void')) or
    (old.state = 'active' and new.state in ('active', 'complete', 'expired', 'void')) or
    (old.state = new.state and old.state in ('complete', 'expired', 'void'))
  ) then
    raise exception 'invalid run transition';
  end if;
  if new.mode = 'daily' then
    select * into d from public.dailies where day = new.day and game = new.game;
    if not found or new.scope <> d.scope or new.qcount <> d.qcount or new.holes is distinct from d.holes or
      new.seed <> d.seed or new.config <> d.config or new.course is distinct from d.course or
      new.issued < d.opens or new.issued >= d.closes or new.expires <> d.closes then
      raise exception 'invalid daily issuance';
    end if;
  end if;
  if tg_op = 'INSERT' and new.mode = 'ranked' and not exists (
    select 1 from public.seasons s
    where s.id = new.season and s.active and new.issued >= s.starts and new.issued < s.ends and new.expires <= s.ends
  ) then
    raise exception 'invalid ranked season';
  end if;
  if tg_op = 'UPDATE' and new.state = 'complete' and old.state <> 'complete' then
    select count(*), count(*) filter (where correct), coalesce(sum(points), 0)
    into answered, hits, points from public.attempts where run = new.id;
    if (new.mode = 'ranked' and answered > new.qcount) or
      (new.mode <> 'ranked' and answered <> new.qcount) or
      hits <> new.correct or points <> new.score then
      raise exception 'invalid run result';
    end if;
  end if;
  return new;
end;
$$;

create function public.rankedanswer(p_run uuid, p_uid uuid, p_q integer, p_answer jsonb, p_correct boolean)
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
  select * into r from public.runs where id = p_run for update;
  if not found or r.uid <> p_uid or r.mode <> 'ranked' then
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
  returning public.attempts.* into saved;
  return query select true, saved.q, saved.correct, saved.points, saved.ms;
end;
$$;

create function public.rankedfinish(p_run uuid, p_uid uuid)
returns table(score integer, correct integer, answered integer, elapsed bigint, proof text, finished timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  r public.runs%rowtype;
  count integer;
  hits integer;
  total bigint;
  stamp timestamptz;
  token text;
begin
  select * into r from public.runs where id = p_run for update;
  if not found or r.uid <> p_uid or r.mode <> 'ranked' then
    raise exception 'ranked run not found';
  end if;
  if r.state = 'complete' then
    return query select r.score, r.correct, coalesce((r.result ->> 'answered')::integer, 0), r.elapsed, r.proof, r.finished;
    return;
  end if;
  if r.state <> 'active' then
    raise exception 'ranked run is not active';
  end if;
  select count(*), count(*) filter (where a.correct), coalesce(sum(a.points), 0)
  into count, hits, total from public.attempts a where a.run = p_run;
  stamp := clock_timestamp();
  if count < r.qcount and stamp < r.expires then
    raise exception 'ranked run is still active';
  end if;
  stamp := least(stamp, r.expires);
  select encode(public.digest(r.id::text || ':' || r.uid::text || ':' || r.seed || ':' || r.config::text || ':' || coalesce(string_agg(a.q::text || ':' || a.answer::text || ':' || a.correct::text || ':' || a.points::text || ':' || a.ms::text, '|' order by a.q), ''), 'sha256'), 'hex')
  into token from public.attempts a where a.run = p_run;
  update public.runs set
    state = 'complete', finished = stamp, score = total::integer, correct = hits,
    result = jsonb_build_object('answered', count, 'qcount', r.qcount), proof = token
  where id = p_run returning public.runs.* into r;
  return query select r.score, r.correct, count, r.elapsed, r.proof, r.finished;
end;
$$;

create or replace function public.rollstats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  questions integer;
begin
  if new.state = 'complete' and old.state <> 'complete' then
    questions := case when new.mode = 'ranked' then coalesce((new.result ->> 'answered')::integer, 0) else new.qcount end;
    insert into public.totals (uid, runs, questions, correct, score, elapsed, updated)
    values (new.uid, 1, questions, new.correct, new.score, new.elapsed, now())
    on conflict (uid) do update set
      runs = public.totals.runs + 1,
      questions = public.totals.questions + excluded.questions,
      correct = public.totals.correct + excluded.correct,
      score = public.totals.score + excluded.score,
      elapsed = public.totals.elapsed + excluded.elapsed,
      updated = now();
    if new.mode = 'casual' then
      insert into public.casualstats (uid, game, scope, runs, questions, correct, score, elapsed, best, updated)
      values (new.uid, new.game, new.scope, 1, questions, new.correct, new.score, new.elapsed, new.score, now())
      on conflict (uid, game, scope) do update set
        runs = public.casualstats.runs + 1,
        questions = public.casualstats.questions + excluded.questions,
        correct = public.casualstats.correct + excluded.correct,
        score = public.casualstats.score + excluded.score,
        elapsed = public.casualstats.elapsed + excluded.elapsed,
        best = greatest(coalesce(public.casualstats.best, excluded.best), excluded.best),
        updated = now();
      insert into public.casualtotals (uid, runs, questions, correct, score, elapsed, updated)
      values (new.uid, 1, questions, new.correct, new.score, new.elapsed, now())
      on conflict (uid) do update set
        runs = public.casualtotals.runs + 1,
        questions = public.casualtotals.questions + excluded.questions,
        correct = public.casualtotals.correct + excluded.correct,
        score = public.casualtotals.score + excluded.score,
        elapsed = public.casualtotals.elapsed + excluded.elapsed,
        updated = now();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.rankedanswer(uuid, uuid, integer, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.rankedfinish(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rankedanswer(uuid, uuid, integer, jsonb, boolean) to service_role;
grant execute on function public.rankedfinish(uuid, uuid) to service_role;

commit;
