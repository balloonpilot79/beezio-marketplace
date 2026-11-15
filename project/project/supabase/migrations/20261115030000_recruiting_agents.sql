create extension if not exists pgcrypto;

create table if not exists public.recruiting_agent_settings (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null default 'Alex',
  public_identity text not null default 'Alex | Beezio automated assistant',
  monthly_user_goal integer not null default 10000 check (monthly_user_goal > 0),
  daily_approval_required boolean not null default true,
  agent_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recruiting_agent_settings_singleton
  on public.recruiting_agent_settings ((true));

insert into public.recruiting_agent_settings (agent_name, public_identity)
values ('Alex', 'Alex | Beezio automated assistant')
on conflict do nothing;

create table if not exists public.recruiting_approval_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  summary text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruiting_batches_date_idx
  on public.recruiting_approval_batches (batch_date desc, created_at desc);

create table if not exists public.recruiting_prospects (
  id uuid primary key default gen_random_uuid(),
  role_target text not null check (role_target in ('seller', 'affiliate', 'ambassador', 'buyer')),
  channel text not null,
  display_name text not null,
  public_handle text,
  source_url text not null unique,
  contact_path text,
  fit_reason text not null,
  status text not null default 'qualified' check (status in ('new', 'qualified', 'drafted', 'approved', 'contacted', 'replied', 'converted', 'declined', 'do_not_contact')),
  tags text[] not null default '{}',
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruiting_prospects_status_idx
  on public.recruiting_prospects (status, created_at desc);

create table if not exists public.recruiting_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.recruiting_approval_batches(id) on delete cascade,
  prospect_id uuid not null references public.recruiting_prospects(id) on delete cascade,
  agent_name text not null default 'Alex',
  channel text not null,
  action_type text not null default 'message' check (action_type in ('message', 'post', 'reply', 'follow_up')),
  message_text text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'sent', 'failed')),
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  provider_reference text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruiting_drafts_batch_idx
  on public.recruiting_outreach_drafts (batch_id, status, created_at);

create table if not exists public.recruiting_activity_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.recruiting_approval_batches(id) on delete set null,
  prospect_id uuid references public.recruiting_prospects(id) on delete set null,
  draft_id uuid references public.recruiting_outreach_drafts(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recruiting_activity_created_idx
  on public.recruiting_activity_log (created_at desc);

create or replace function public.recruiting_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recruiting_settings_updated_at on public.recruiting_agent_settings;
create trigger recruiting_settings_updated_at before update on public.recruiting_agent_settings
for each row execute function public.recruiting_set_updated_at();
drop trigger if exists recruiting_batches_updated_at on public.recruiting_approval_batches;
create trigger recruiting_batches_updated_at before update on public.recruiting_approval_batches
for each row execute function public.recruiting_set_updated_at();
drop trigger if exists recruiting_prospects_updated_at on public.recruiting_prospects;
create trigger recruiting_prospects_updated_at before update on public.recruiting_prospects
for each row execute function public.recruiting_set_updated_at();
drop trigger if exists recruiting_drafts_updated_at on public.recruiting_outreach_drafts;
create trigger recruiting_drafts_updated_at before update on public.recruiting_outreach_drafts
for each row execute function public.recruiting_set_updated_at();

alter table public.recruiting_agent_settings enable row level security;
alter table public.recruiting_approval_batches enable row level security;
alter table public.recruiting_prospects enable row level security;
alter table public.recruiting_outreach_drafts enable row level security;
alter table public.recruiting_activity_log enable row level security;

revoke all on public.recruiting_agent_settings from anon, authenticated;
revoke all on public.recruiting_approval_batches from anon, authenticated;
revoke all on public.recruiting_prospects from anon, authenticated;
revoke all on public.recruiting_outreach_drafts from anon, authenticated;
revoke all on public.recruiting_activity_log from anon, authenticated;

drop policy if exists "server only recruiting settings" on public.recruiting_agent_settings;
create policy "server only recruiting settings" on public.recruiting_agent_settings
for all to anon, authenticated using (false) with check (false);
drop policy if exists "server only recruiting batches" on public.recruiting_approval_batches;
create policy "server only recruiting batches" on public.recruiting_approval_batches
for all to anon, authenticated using (false) with check (false);
drop policy if exists "server only recruiting prospects" on public.recruiting_prospects;
create policy "server only recruiting prospects" on public.recruiting_prospects
for all to anon, authenticated using (false) with check (false);
drop policy if exists "server only recruiting drafts" on public.recruiting_outreach_drafts;
create policy "server only recruiting drafts" on public.recruiting_outreach_drafts
for all to anon, authenticated using (false) with check (false);
drop policy if exists "server only recruiting activity" on public.recruiting_activity_log;
create policy "server only recruiting activity" on public.recruiting_activity_log
for all to anon, authenticated using (false) with check (false);
