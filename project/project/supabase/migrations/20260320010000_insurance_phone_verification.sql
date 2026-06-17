create table if not exists public.insurance_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  phone_normalized text not null,
  status text not null default 'pending',
  twilio_sid text,
  verification_channel text not null default 'sms',
  verified_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_phone_verifications_phone_created_idx
  on public.insurance_phone_verifications(phone_normalized, created_at desc);

drop trigger if exists set_insurance_phone_verifications_updated_at on public.insurance_phone_verifications;
create trigger set_insurance_phone_verifications_updated_at
before update on public.insurance_phone_verifications
for each row
execute function public.set_timestamp_updated_at();

alter table public.insurance_leads
  add column if not exists phone_verification_id uuid references public.insurance_phone_verifications(id) on delete set null,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists consent_to_contact boolean not null default false;

update public.insurance_leads
set consent_to_contact = coalesce((payload_json ->> 'consent_to_contact')::boolean, false)
where consent_to_contact is false;

alter table public.insurance_phone_verifications enable row level security;

drop policy if exists "insurance phone verifications admin read" on public.insurance_phone_verifications;
create policy "insurance phone verifications admin read"
on public.insurance_phone_verifications
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (p.primary_role = 'admin' or p.role = 'admin')
  )
);
