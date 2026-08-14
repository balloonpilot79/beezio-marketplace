alter table public.cj_seed_state drop constraint if exists cj_seed_state_target_count_check;
alter table public.cj_seed_state add constraint cj_seed_state_target_count_check check (target_count between 1 and 500);
alter table public.cj_seed_state add column if not exists tier_target_count integer not null default 25 check (tier_target_count between 1 and 100);
alter table public.cj_seed_state add column if not exists tier_counts jsonb not null default '{}'::jsonb;

update public.cj_seed_state
set target_count = 125,
    tier_target_count = 25,
    completed_at = null,
    updated_at = now()
where id = 1;
