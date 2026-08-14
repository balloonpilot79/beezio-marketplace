alter table public.cj_seed_state
  add column if not exists tier_pages jsonb not null default '{"under_25":1,"25_49":1,"50_99":1,"100_249":1,"250_499":1}'::jsonb;

update public.cj_seed_state
set tier_pages = coalesce(tier_pages, '{}'::jsonb) || jsonb_build_object(
  'under_25', coalesce((tier_pages->>'under_25')::int, 1),
  '25_49', coalesce((tier_pages->>'25_49')::int, 1),
  '50_99', coalesce((tier_pages->>'50_99')::int, 1),
  '100_249', coalesce((tier_pages->>'100_249')::int, 1),
  '250_499', coalesce((tier_pages->>'250_499')::int, 1)
), updated_at=now()
where id=1;
