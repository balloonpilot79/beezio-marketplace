create extension if not exists pgcrypto;

create table if not exists public.insurance_agent_listings (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  agency_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  website_url text,
  bio text,
  specialties text[] not null default '{}'::text[],
  states_served text[] not null default '{}'::text[],
  lead_price numeric(10,2) not null default 10.00,
  affiliate_payout numeric(10,2) not null default 8.70,
  accepts_new_leads boolean not null default true,
  is_active boolean not null default false,
  placement_rank integer not null default 100,
  hero_title text,
  hero_subtitle text,
  disclaimer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_agent_listings_lead_price_nonnegative check (lead_price >= 0),
  constraint insurance_agent_listings_affiliate_payout_nonnegative check (affiliate_payout >= 0)
);

create unique index if not exists insurance_agent_listings_agent_profile_idx
  on public.insurance_agent_listings(agent_profile_id);

create index if not exists insurance_agent_listings_active_idx
  on public.insurance_agent_listings(is_active, accepts_new_leads, placement_rank, created_at desc);

create table if not exists public.insurance_leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.insurance_agent_listings(id) on delete cascade,
  agent_profile_id uuid not null references public.profiles(id) on delete cascade,
  affiliate_id uuid references public.profiles(id) on delete set null,
  influencer_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  zip_code text,
  notes text,
  source_url text,
  ip_hash text not null,
  user_agent text,
  duplicate_reason text,
  lead_price numeric(10,2) not null,
  affiliate_payout numeric(10,2) not null default 0,
  influencer_payout numeric(10,2) not null default 0,
  paypal_fee_estimate numeric(10,2) not null default 0,
  beezio_fee_gross numeric(10,2) not null default 0,
  beezio_fee_net numeric(10,2) not null default 0,
  billing_status text not null default 'pending_manual_capture',
  quality_status text not null default 'accepted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists insurance_leads_listing_created_idx
  on public.insurance_leads(listing_id, created_at desc);

create index if not exists insurance_leads_agent_created_idx
  on public.insurance_leads(agent_profile_id, created_at desc);

create index if not exists insurance_leads_ip_hash_idx
  on public.insurance_leads(ip_hash, created_at desc);

create index if not exists insurance_leads_email_idx
  on public.insurance_leads(lower(email), created_at desc);

create table if not exists public.insurance_lead_billing_ledger (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.insurance_leads(id) on delete cascade,
  listing_id uuid not null references public.insurance_agent_listings(id) on delete cascade,
  agent_profile_id uuid not null references public.profiles(id) on delete cascade,
  affiliate_id uuid references public.profiles(id) on delete set null,
  influencer_id uuid references public.profiles(id) on delete set null,
  gross_amount numeric(10,2) not null,
  affiliate_earnings numeric(10,2) not null default 0,
  influencer_earnings numeric(10,2) not null default 0,
  paypal_fee_estimate numeric(10,2) not null default 0,
  beezio_fee_gross numeric(10,2) not null default 0,
  beezio_fee_net numeric(10,2) not null default 0,
  charge_status text not null default 'pending_manual_capture',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_lead_billing_ledger_agent_idx
  on public.insurance_lead_billing_ledger(agent_profile_id, created_at desc);

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_insurance_agent_listings_updated_at on public.insurance_agent_listings;
create trigger set_insurance_agent_listings_updated_at
before update on public.insurance_agent_listings
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists set_insurance_lead_billing_ledger_updated_at on public.insurance_lead_billing_ledger;
create trigger set_insurance_lead_billing_ledger_updated_at
before update on public.insurance_lead_billing_ledger
for each row
execute function public.set_timestamp_updated_at();

alter table public.insurance_agent_listings enable row level security;
alter table public.insurance_leads enable row level security;
alter table public.insurance_lead_billing_ledger enable row level security;

drop policy if exists "insurance listings public read active" on public.insurance_agent_listings;
create policy "insurance listings public read active"
on public.insurance_agent_listings
for select
using (is_active = true and accepts_new_leads = true);

drop policy if exists "insurance listings owner full access" on public.insurance_agent_listings;
create policy "insurance listings owner full access"
on public.insurance_agent_listings
for all
using (agent_profile_id = auth.uid() or exists (
  select 1
  from public.profiles p
  where p.id = insurance_agent_listings.agent_profile_id
    and p.user_id = auth.uid()
))
with check (agent_profile_id = auth.uid() or exists (
  select 1
  from public.profiles p
  where p.id = insurance_agent_listings.agent_profile_id
    and p.user_id = auth.uid()
));

drop policy if exists "insurance leads owner read" on public.insurance_leads;
create policy "insurance leads owner read"
on public.insurance_leads
for select
using (
  agent_profile_id = auth.uid()
  or affiliate_id = auth.uid()
  or influencer_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.id in (insurance_leads.agent_profile_id, insurance_leads.affiliate_id, insurance_leads.influencer_id)
  )
);

drop policy if exists "insurance billing owner read" on public.insurance_lead_billing_ledger;
create policy "insurance billing owner read"
on public.insurance_lead_billing_ledger
for select
using (
  agent_profile_id = auth.uid()
  or affiliate_id = auth.uid()
  or influencer_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.id in (
        insurance_lead_billing_ledger.agent_profile_id,
        insurance_lead_billing_ledger.affiliate_id,
        insurance_lead_billing_ledger.influencer_id
      )
  )
);
