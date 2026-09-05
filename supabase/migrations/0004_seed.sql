begin;

insert into public.seasons (slug, name, starts, ends, active)
values (
  'season-1',
  'season 1',
  now(),
  now() + interval '90 days',
  true
);

commit;
