-- Influencer dashboard RPC (aggregated stats for current user)
-- Returns recruit count + payout ledger aggregates for influencer payouts.
-- Safe to run multiple times.

create or replace function public.get_my_influencer_dashboard_stats()
returns table (
  profile_id uuid,
  username text,
  referral_code text,
  recruits_count bigint,
  ready_to_pay numeric,
  pending_review numeric,
  paid numeric,
  on_hold_dispute numeric,
  next_release_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  my_profile_id uuid;
begin
  -- Identify caller's profile.
  select p.id, p.username, p.referral_code
    into my_profile_id, username, referral_code
  from public.profiles p
  where p.user_id = auth.uid()
     or p.id = auth.uid()
  limit 1;

  if my_profile_id is null then
    return;
  end if;

  profile_id := my_profile_id;

  select count(*)
    into recruits_count
  from public.profiles pr
  where pr.recruited_by_influencer_id = my_profile_id;

  ready_to_pay := 0;
  pending_review := 0;
  paid := 0;
  on_hold_dispute := 0;
  next_release_at := null;

  if to_regclass('public.payout_ledger') is not null then
    select
      coalesce(sum(case when l.status = 'READY_TO_PAY' then l.influencer_earnings else 0 end), 0),
      coalesce(sum(case when l.status = 'PENDING_HOLD' then l.influencer_earnings else 0 end), 0),
      coalesce(sum(case when l.status = 'PAID' then l.influencer_earnings else 0 end), 0),
      coalesce(sum(case when l.status = 'ON_HOLD_DISPUTE' then l.influencer_earnings else 0 end), 0),
      min(case when l.status = 'PENDING_HOLD' then l.hold_release_at end)
    into ready_to_pay, pending_review, paid, on_hold_dispute, next_release_at
    from public.payout_ledger l
    where l.influencer_id = my_profile_id;
  end if;

  return next;
end;
$$;

grant execute on function public.get_my_influencer_dashboard_stats() to authenticated;
