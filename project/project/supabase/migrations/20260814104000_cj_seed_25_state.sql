create table if not exists public.cj_seed_state (
  id integer primary key default 1 check (id = 1),
  target_count integer not null default 25 check (target_count between 1 and 100),
  locked_until timestamptz,
  last_run_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_result jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cj_seed_state enable row level security;
revoke all on public.cj_seed_state from anon, authenticated;

insert into public.cj_seed_state (id, target_count)
values (1, 25)
on conflict (id) do update
set target_count = excluded.target_count,
    updated_at = now();
