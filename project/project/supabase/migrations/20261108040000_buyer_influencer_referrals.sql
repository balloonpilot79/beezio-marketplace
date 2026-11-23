-- Buyer influencer referrals: additive storage; existing seller/affiliate flows unchanged.
create table if not exists public.buyer_influencer_referrals (
  buyer_profile_id uuid primary key references public.profiles(id) on delete restrict,
  influencer_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint buyer_influencer_no_self_referral check (buyer_profile_id <> influencer_profile_id)
);
create index if not exists buyer_influencer_referrals_influencer_idx
  on public.buyer_influencer_referrals(influencer_profile_id);
alter table public.buyer_influencer_referrals enable row level security;
revoke all on public.buyer_influencer_referrals from anon, authenticated;
grant select, insert on public.buyer_influencer_referrals to service_role;

create or replace function public.prevent_buyer_influencer_reassignment()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Buyer influencer attribution is permanent';
end;
$$;
drop trigger if exists buyer_influencer_referral_immutable on public.buyer_influencer_referrals;
create trigger buyer_influencer_referral_immutable
before update or delete on public.buyer_influencer_referrals
for each row execute function public.prevent_buyer_influencer_reassignment();

create table if not exists public.buyer_influencer_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  buyer_profile_id uuid not null references public.profiles(id),
  influencer_profile_id uuid not null references public.profiles(id),
  amount_cents integer not null default 25 check (amount_cents = 25),
  status text not null default 'pending' check (status in ('pending','held','available','paid','reversed')),
  hold_release_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(order_id)
);
create index if not exists buyer_influencer_commissions_influencer_idx
 on public.buyer_influencer_commissions(influencer_profile_id,status);
alter table public.buyer_influencer_commissions enable row level security;
revoke all on public.buyer_influencer_commissions from anon, authenticated;
grant select, insert, update on public.buyer_influencer_commissions to service_role;
