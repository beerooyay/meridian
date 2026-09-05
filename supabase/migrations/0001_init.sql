begin;

create extension if not exists citext;
create extension if not exists pgcrypto;

create type public.pipeline as enum ('casual', 'ranked', 'daily');
create type public.runstate as enum ('issued', 'active', 'complete', 'expired', 'void');

create table public.profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  constraint username_format check (username::text ~ '^[a-z0-9][a-z0-9_-]{2,17}$')
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts timestamptz not null,
  ends timestamptz not null,
  active boolean not null default false,
  created timestamptz not null default now(),
  constraint season_range check (ends > starts),
  constraint season_slug check (slug ~ '^[a-z0-9][a-z0-9-]{1,31}$')
);

create unique index seasons_active_one on public.seasons (active) where active;

create table public.dailies (
  day date not null,
  game text not null,
  scope text not null,
  qcount integer not null check (qcount between 1 and 1000),
  holes smallint,
  seed text not null,
  config jsonb not null,
  course jsonb,
  opens timestamptz not null,
  closes timestamptz not null,
  created timestamptz not null default now(),
  primary key (day, game),
  constraint daily_game_format check (game ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  constraint daily_scope check (scope ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  constraint daily_range check (closes > opens),
  constraint daily_config check (jsonb_typeof(config) = 'object'),
  constraint daily_course check (course is null or jsonb_typeof(course) = 'object'),
  constraint daily_shape check (
    (game = 'dogleg' and holes in (9, 18) and qcount = holes and course is not null) or
    (game <> 'dogleg' and holes is null and course is null)
  )
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  game text not null,
  mode public.pipeline not null,
  scope text not null,
  state public.runstate not null default 'issued',
  season uuid references public.seasons(id),
  day date,
  qcount integer not null check (qcount between 1 and 1000),
  holes smallint,
  seed text not null,
  config jsonb not null,
  course jsonb,
  nonce uuid not null default gen_random_uuid() unique,
  score integer,
  correct integer,
  result jsonb,
  proof text,
  issued timestamptz not null default now(),
  started timestamptz,
  expires timestamptz,
  finished timestamptz,
  elapsed bigint generated always as (
    case when started is null or finished is null then null else round(extract(epoch from (finished - started)) * 1000)::bigint end
  ) stored,
  foreign key (day, game) references public.dailies(day, game),
  constraint run_game_format check (game ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  constraint run_scope check (scope ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  constraint run_config check (jsonb_typeof(config) = 'object'),
  constraint run_course check (course is null or jsonb_typeof(course) = 'object'),
  constraint run_game check (
    (game = 'dogleg' and holes in (9, 18) and qcount = holes and course is not null) or
    (game <> 'dogleg' and holes is null and course is null)
  ),
  constraint run_mode check (
    (mode = 'casual' and season is null and day is null and expires is null) or
    (mode = 'ranked' and season is not null and day is null and expires is not null) or
    (mode = 'daily' and season is null and day is not null and expires is not null)
  ),
  constraint run_timing check (
    (started is null or started >= issued) and
    (expires is null or expires > issued) and
    (started is null or expires is null or started < expires) and
    (finished is null or started is not null and finished >= started) and
    (finished is null or expires is null or finished <= expires)
  ),
  constraint run_result check (
    (state = 'issued' and started is null and finished is null and score is null and correct is null and result is null and proof is null) or
    (state = 'active' and started is not null and finished is null and score is null and correct is null and result is null and proof is null) or
    (state = 'complete' and started is not null and finished is not null and score is not null and score >= 0 and correct is not null and correct between 0 and qcount and result is not null and jsonb_typeof(result) = 'object' and proof is not null and length(proof) > 0) or
    (state in ('expired', 'void') and finished is null and score is null and correct is null and result is null and proof is null)
  )
);

create unique index daily_run_one on public.runs (uid, game, day) where mode = 'daily';
create index runs_owner on public.runs (uid, issued desc);
create index runs_ranked on public.runs (season, game, scope, score desc, elapsed, finished) where mode = 'ranked' and state = 'complete';
create index runs_daily on public.runs (day, game, score desc, elapsed, finished) where mode = 'daily' and state = 'complete';

create table public.attempts (
  id bigint generated always as identity primary key,
  run uuid not null references public.runs(id) on delete cascade,
  q integer not null check (q > 0),
  answer jsonb not null,
  correct boolean not null,
  points integer not null check (points >= 0),
  ms integer not null check (ms >= 0),
  created timestamptz not null default now(),
  constraint attempt_one unique (run, q),
  constraint attempt_answer check (jsonb_typeof(answer) in ('object', 'array', 'string', 'number', 'boolean'))
);

create table public.casualstats (
  uid uuid not null references auth.users(id) on delete cascade,
  game text not null,
  scope text not null,
  runs bigint not null default 0 check (runs >= 0),
  questions bigint not null default 0 check (questions >= 0),
  correct bigint not null default 0 check (correct >= 0),
  score bigint not null default 0 check (score >= 0),
  elapsed bigint not null default 0 check (elapsed >= 0),
  best integer,
  updated timestamptz not null default now(),
  primary key (uid, game, scope)
);

create table public.casualtotals (
  uid uuid primary key references auth.users(id) on delete cascade,
  runs bigint not null default 0 check (runs >= 0),
  questions bigint not null default 0 check (questions >= 0),
  correct bigint not null default 0 check (correct >= 0),
  score bigint not null default 0 check (score >= 0),
  elapsed bigint not null default 0 check (elapsed >= 0),
  updated timestamptz not null default now()
);

create table public.totals (
  uid uuid primary key references auth.users(id) on delete cascade,
  runs bigint not null default 0 check (runs >= 0),
  questions bigint not null default 0 check (questions >= 0),
  correct bigint not null default 0 check (correct >= 0),
  score bigint not null default 0 check (score >= 0),
  elapsed bigint not null default 0 check (elapsed >= 0),
  updated timestamptz not null default now()
);

create function public.newuser() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  handle text;
begin
  handle := lower(trim(new.raw_user_meta_data ->> 'username'));
  if handle is null or handle !~ '^[a-z0-9][a-z0-9_-]{2,17}$' then
    raise exception 'invalid username';
  end if;
  insert into public.profiles (uid, username) values (new.id, handle);
  insert into public.casualtotals (uid) values (new.id);
  insert into public.totals (uid) values (new.id);
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users
for each row execute function public.newuser();

create function public.touchprofile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.username := lower(trim(new.username::text));
  new.updated := now();
  return new;
end;
$$;

create trigger profile_touch before update on public.profiles
for each row execute function public.touchprofile();

create function public.guardrun() returns trigger
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
    if answered <> new.qcount or hits <> new.correct or points <> new.score then
      raise exception 'invalid run result';
    end if;
  end if;
  return new;
end;
$$;

create trigger run_guard before insert or update on public.runs
for each row execute function public.guardrun();

create function public.guardattempt() returns trigger
language plpgsql set search_path = '' as $$
declare
  count integer;
  state public.runstate;
begin
  select r.qcount, r.state into count, state from public.runs r where r.id = new.run;
  if count is null or state <> 'active' or new.q > count then
    raise exception 'invalid question';
  end if;
  return new;
end;
$$;

create trigger attempt_guard before insert or update on public.attempts
for each row execute function public.guardattempt();

create function public.rollstats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'complete' and old.state <> 'complete' then
    insert into public.totals (uid, runs, questions, correct, score, elapsed, updated)
    values (new.uid, 1, new.qcount, new.correct, new.score, new.elapsed, now())
    on conflict (uid) do update set
      runs = public.totals.runs + 1,
      questions = public.totals.questions + excluded.questions,
      correct = public.totals.correct + excluded.correct,
      score = public.totals.score + excluded.score,
      elapsed = public.totals.elapsed + excluded.elapsed,
      updated = now();
    if new.mode = 'casual' then
      insert into public.casualstats (uid, game, scope, runs, questions, correct, score, elapsed, best, updated)
      values (new.uid, new.game, new.scope, 1, new.qcount, new.correct, new.score, new.elapsed, new.score, now())
      on conflict (uid, game, scope) do update set
        runs = public.casualstats.runs + 1,
        questions = public.casualstats.questions + excluded.questions,
        correct = public.casualstats.correct + excluded.correct,
        score = public.casualstats.score + excluded.score,
        elapsed = public.casualstats.elapsed + excluded.elapsed,
        best = greatest(coalesce(public.casualstats.best, excluded.best), excluded.best),
        updated = now();
      insert into public.casualtotals (uid, runs, questions, correct, score, elapsed, updated)
      values (new.uid, 1, new.qcount, new.correct, new.score, new.elapsed, now())
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

create trigger stats_roll after update on public.runs
for each row execute function public.rollstats();

create view public.dailylist as
select day, game, scope, qcount, holes, opens, closes
from public.dailies;

create view public.casualboard as
select p.username::text as username, s.game, s.scope, s.runs, s.questions, s.correct, s.score, s.elapsed, s.best,
  round(s.score::numeric / s.runs, 2) as average
from public.casualstats s join public.profiles p on p.uid = s.uid
where s.runs > 0;

create view public.rankedboard as
select r.season, s.slug, r.game, r.scope, p.username::text as username, count(*)::bigint as runs,
  max(r.score)::integer as best, round(avg(r.score), 2) as average, min(r.elapsed)::bigint as fastest
from public.runs r
join public.profiles p on p.uid = r.uid
join public.seasons s on s.id = r.season
where r.mode = 'ranked' and r.state = 'complete'
group by r.season, s.slug, r.game, r.scope, p.uid, p.username;

create view public.dailyboard as
select r.day, r.game, r.scope, p.username::text as username, r.score, r.correct, r.elapsed, r.finished
from public.runs r join public.profiles p on p.uid = r.uid
where r.mode = 'daily' and r.state = 'complete';

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.dailies enable row level security;
alter table public.runs enable row level security;
alter table public.attempts enable row level security;
alter table public.casualstats enable row level security;
alter table public.casualtotals enable row level security;
alter table public.totals enable row level security;

create policy profile_read on public.profiles for select to authenticated using (uid = auth.uid());
create policy profile_update on public.profiles for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
create policy runs_read on public.runs for select to authenticated using (uid = auth.uid());
create policy attempts_read on public.attempts for select to authenticated using (
  exists (select 1 from public.runs r where r.id = run and r.uid = auth.uid())
);
create policy casualstats_read on public.casualstats for select to authenticated using (uid = auth.uid());
create policy casualtotals_read on public.casualtotals for select to authenticated using (uid = auth.uid());
create policy totals_read on public.totals for select to authenticated using (uid = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.seasons to anon, authenticated;
grant select, update (username) on public.profiles to authenticated;
grant select (id, uid, game, mode, scope, state, season, day, qcount, holes, score, correct, issued, started, expires, finished, elapsed) on public.runs to authenticated;
grant select on public.attempts, public.casualstats, public.casualtotals, public.totals to authenticated;
grant select on public.dailylist, public.casualboard, public.rankedboard, public.dailyboard to anon, authenticated;

commit;
