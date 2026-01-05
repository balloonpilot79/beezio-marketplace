-- Tax agreements used by EmbeddedStripeOnboarding (Sign Agreements & Continue).
-- Safe to run multiple times.

create extension if not exists "pgcrypto";

create table if not exists public.tax_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('1099', 'independent_contractor', 'tax_withholding')),
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  document_version text not null default '1.0',
  created_at timestamptz not null default now()
);

-- Needed for client-side upsert({ onConflict: 'user_id,agreement_type' }).
create unique index if not exists tax_agreements_user_id_agreement_type_key
  on public.tax_agreements(user_id, agreement_type);

create index if not exists idx_tax_agreements_user_id on public.tax_agreements(user_id);
create index if not exists idx_tax_agreements_type on public.tax_agreements(agreement_type);

alter table public.tax_agreements enable row level security;

do $do$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'Users can view their own tax agreements'
  ) then
    create policy "Users can view their own tax agreements"
      on public.tax_agreements
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'Users can insert their own tax agreements'
  ) then
    create policy "Users can insert their own tax agreements"
      on public.tax_agreements
      for insert
      with check (auth.uid() = user_id);
  end if;

  -- Required for UPSERT conflict path.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'Users can update their own tax agreements'
  ) then
    create policy "Users can update their own tax agreements"
      on public.tax_agreements
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$do$;
