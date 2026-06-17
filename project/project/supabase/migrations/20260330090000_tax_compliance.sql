create extension if not exists pgcrypto;

create table if not exists public.tax_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text,
  business_name text,
  tax_classification text,
  tax_country text not null default 'US',
  form_status text not null default 'missing',
  form_type text not null default 'none',
  tax_id_last4 text,
  delivery_email text,
  street_address text,
  city text,
  state_region text,
  postal_code text,
  country text not null default 'US',
  independent_contractor_ack_at timestamptz,
  independent_contractor_version text,
  electronic_delivery_ack_at timestamptz,
  backup_withholding_ack boolean not null default false,
  certification_signed_at timestamptz,
  certification_name text,
  ytd_paid_cents bigint not null default 0,
  last_1099_tax_year integer,
  last_1099_issued_at timestamptz,
  admin_review_status text not null default 'not_reviewed',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_profiles_form_status_check check (form_status in ('missing', 'pending', 'submitted', 'verified', 'needs_attention')),
  constraint tax_profiles_form_type_check check (form_type in ('none', 'w9', 'w8-ben', 'w8-bene')),
  constraint tax_profiles_tax_classification_check check (
    tax_classification is null or tax_classification in (
      'individual',
      'sole_proprietor',
      'single_member_llc',
      'partnership',
      'c_corp',
      's_corp',
      'non_us_individual',
      'non_us_business'
    )
  ),
  constraint tax_profiles_admin_review_status_check check (admin_review_status in ('not_reviewed', 'ready', 'needs_follow_up', 'filed')),
  constraint tax_profiles_tax_id_last4_check check (tax_id_last4 is null or tax_id_last4 ~ '^[0-9]{4}$')
);

create table if not exists public.tax_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_type text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  details jsonb,
  created_at timestamptz not null default now(),
  constraint tax_agreements_type_check check (agreement_type in ('independent_contractor', 'electronic_delivery', 'backup_withholding'))
);

alter table public.tax_agreements add column if not exists document_version text;
alter table public.tax_agreements add column if not exists details jsonb;
alter table public.tax_agreements add column if not exists created_at timestamptz;
alter table public.tax_agreements add column if not exists accepted_at timestamptz;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tax_agreements'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%agreement_type%'
  loop
    execute format('alter table public.tax_agreements drop constraint if exists %I', constraint_name);
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tax_agreements'
      and column_name = 'signed_at'
  ) then
    execute 'update public.tax_agreements
             set accepted_at = coalesce(accepted_at, signed_at, now()),
                 created_at = coalesce(created_at, signed_at, now()),
                 document_version = coalesce(document_version, ''legacy''),
                 details = coalesce(details, ''{}''::jsonb)
             where accepted_at is null
                or created_at is null
                or document_version is null
                or details is null';
  else
    update public.tax_agreements
    set accepted_at = coalesce(accepted_at, now()),
        created_at = coalesce(created_at, now()),
        document_version = coalesce(document_version, 'legacy'),
        details = coalesce(details, '{}'::jsonb)
    where accepted_at is null
       or created_at is null
       or document_version is null
       or details is null;
  end if;
end $$;

update public.tax_agreements
set
  details = coalesce(details, '{}'::jsonb) || jsonb_build_object('legacy_agreement_type', agreement_type),
  agreement_type = case lower(trim(coalesce(agreement_type, '')))
    when 'independent_contractor' then 'independent_contractor'
    when 'independent contractor' then 'independent_contractor'
    when '1099' then 'electronic_delivery'
    when 'electronic_delivery' then 'electronic_delivery'
    when 'electronic delivery' then 'electronic_delivery'
    when 'tax_withholding' then 'backup_withholding'
    when 'tax withholding' then 'backup_withholding'
    when 'backup_withholding' then 'backup_withholding'
    when 'backup withholding' then 'backup_withholding'
    else 'independent_contractor'
  end
where agreement_type is distinct from case lower(trim(coalesce(agreement_type, '')))
  when 'independent_contractor' then 'independent_contractor'
  when 'independent contractor' then 'independent_contractor'
  when '1099' then 'electronic_delivery'
  when 'electronic_delivery' then 'electronic_delivery'
  when 'electronic delivery' then 'electronic_delivery'
  when 'tax_withholding' then 'backup_withholding'
  when 'tax withholding' then 'backup_withholding'
  when 'backup_withholding' then 'backup_withholding'
  when 'backup withholding' then 'backup_withholding'
  else 'independent_contractor'
end;

alter table public.tax_agreements alter column accepted_at set default now();
alter table public.tax_agreements alter column accepted_at set not null;
alter table public.tax_agreements alter column created_at set default now();
alter table public.tax_agreements alter column created_at set not null;
alter table public.tax_agreements alter column document_version set default '2026.03';
alter table public.tax_agreements alter column document_version set not null;

do $$
declare
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tax_agreements'
      and c.conname = 'tax_agreements_type_check'
  ) then
    alter table public.tax_agreements
      add constraint tax_agreements_type_check
      check (agreement_type in ('independent_contractor', 'electronic_delivery', 'backup_withholding'));
  end if;
end $$;

create table if not exists public.tax_1099_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year integer not null,
  gross_payout_cents bigint not null default 0,
  status text not null default 'draft',
  document_url text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_1099_reports_status_check check (status in ('draft', 'prepared', 'issued', 'delivered')),
  constraint tax_1099_reports_user_year_unique unique (user_id, tax_year)
);

alter table public.tax_1099_reports add column if not exists gross_payout_cents bigint;
alter table public.tax_1099_reports add column if not exists document_url text;
alter table public.tax_1099_reports add column if not exists issued_at timestamptz;
alter table public.tax_1099_reports add column if not exists created_at timestamptz;
alter table public.tax_1099_reports add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tax_1099_reports'
      and column_name = 'total_payments'
  ) then
    execute 'update public.tax_1099_reports
             set gross_payout_cents = coalesce(gross_payout_cents, round(total_payments * 100)::bigint),
                 created_at = coalesce(created_at, issued_at, now()),
                 updated_at = coalesce(updated_at, issued_at, now())
             where gross_payout_cents is null
                or created_at is null
                or updated_at is null';
  else
    update public.tax_1099_reports
    set gross_payout_cents = coalesce(gross_payout_cents, 0),
        created_at = coalesce(created_at, issued_at, now()),
        updated_at = coalesce(updated_at, issued_at, now())
    where gross_payout_cents is null
       or created_at is null
       or updated_at is null;
  end if;
end $$;

alter table public.tax_1099_reports alter column gross_payout_cents set default 0;
alter table public.tax_1099_reports alter column gross_payout_cents set not null;
alter table public.tax_1099_reports alter column created_at set default now();
alter table public.tax_1099_reports alter column created_at set not null;
alter table public.tax_1099_reports alter column updated_at set default now();
alter table public.tax_1099_reports alter column updated_at set not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tax_1099_reports'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.tax_1099_reports drop constraint if exists %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tax_1099_reports'
      and c.conname = 'tax_1099_reports_status_check'
  ) then
    alter table public.tax_1099_reports
      add constraint tax_1099_reports_status_check
      check (status in ('draft', 'prepared', 'issued', 'delivered'));
  end if;
end $$;

create index if not exists tax_profiles_form_status_idx on public.tax_profiles(form_status, admin_review_status);
create index if not exists tax_profiles_last_1099_idx on public.tax_profiles(last_1099_tax_year);
create index if not exists tax_agreements_user_idx on public.tax_agreements(user_id, agreement_type, accepted_at desc);
create index if not exists tax_1099_reports_year_idx on public.tax_1099_reports(tax_year, status);

alter table public.tax_profiles enable row level security;
alter table public.tax_agreements enable row level security;
alter table public.tax_1099_reports enable row level security;

grant select, insert, update on public.tax_profiles to authenticated;
grant select, insert on public.tax_agreements to authenticated;
grant select on public.tax_1099_reports to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_profiles'
      and policyname = 'tax_profiles_self_select'
  ) then
    create policy tax_profiles_self_select
      on public.tax_profiles
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_profiles'
      and policyname = 'tax_profiles_self_upsert'
  ) then
    create policy tax_profiles_self_upsert
      on public.tax_profiles
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_profiles'
      and policyname = 'tax_profiles_self_update'
  ) then
    create policy tax_profiles_self_update
      on public.tax_profiles
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'tax_agreements_self_select'
  ) then
    create policy tax_agreements_self_select
      on public.tax_agreements
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'tax_agreements_self_insert'
  ) then
    create policy tax_agreements_self_insert
      on public.tax_agreements
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_1099_reports'
      and policyname = 'tax_1099_reports_self_select'
  ) then
    create policy tax_1099_reports_self_select
      on public.tax_1099_reports
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_profiles'
      and policyname = 'tax_profiles_admin_all'
  ) then
    create policy tax_profiles_admin_all
      on public.tax_profiles
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and lower(coalesce(p.primary_role::text, p.role::text)) = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and lower(coalesce(p.primary_role::text, p.role::text)) = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_agreements'
      and policyname = 'tax_agreements_admin_select'
  ) then
    create policy tax_agreements_admin_select
      on public.tax_agreements
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and lower(coalesce(p.primary_role::text, p.role::text)) = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tax_1099_reports'
      and policyname = 'tax_1099_reports_admin_all'
  ) then
    create policy tax_1099_reports_admin_all
      on public.tax_1099_reports
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and lower(coalesce(p.primary_role::text, p.role::text)) = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and lower(coalesce(p.primary_role::text, p.role::text)) = 'admin'
        )
      );
  end if;
end $$;

create or replace function public.set_tax_compliance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tax_profiles_updated_at on public.tax_profiles;
create trigger trg_tax_profiles_updated_at
  before update on public.tax_profiles
  for each row execute procedure public.set_tax_compliance_updated_at();

drop trigger if exists trg_tax_1099_reports_updated_at on public.tax_1099_reports;
create trigger trg_tax_1099_reports_updated_at
  before update on public.tax_1099_reports
  for each row execute procedure public.set_tax_compliance_updated_at();