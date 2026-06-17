import { supabase } from '../lib/supabase';

export type RecruitableRole = 'seller' | 'affiliate';

export async function assignInfluencerReferral(params: {
  recruitedProfileId: string;
  recruitedRole: RecruitableRole;
  influencerProfileId: string;
}) {
  const recruitedProfileId = String(params.recruitedProfileId || '').trim();
  const recruitedRole = String(params.recruitedRole || '').trim().toLowerCase() as RecruitableRole;
  const influencerProfileId = String(params.influencerProfileId || '').trim();

  if (!recruitedProfileId || !influencerProfileId || recruitedProfileId === influencerProfileId) return;
  if (recruitedRole !== 'seller' && recruitedRole !== 'affiliate') return;

  await supabase.from('influencer_referrals').upsert(
    {
      recruited_profile_id: recruitedProfileId,
      recruited_role: recruitedRole,
      influencer_profile_id: influencerProfileId,
    },
    { onConflict: 'recruited_profile_id,recruited_role' }
  );

  await supabase
    .from('profiles')
    .update({ recruited_by_influencer_id: influencerProfileId })
    .eq('id', recruitedProfileId)
    .is('recruited_by_influencer_id', null);
}

export async function getInfluencerReferralForProfile(params: {
  recruitedProfileId: string;
  preferredRole?: RecruitableRole | null;
}) {
  const recruitedProfileId = String(params.recruitedProfileId || '').trim();
  const preferredRole = params.preferredRole ? String(params.preferredRole).trim().toLowerCase() as RecruitableRole : null;
  if (!recruitedProfileId) return null;

  const roleOrder: RecruitableRole[] = preferredRole
    ? [preferredRole, ...(preferredRole === 'seller' ? ['affiliate'] : ['seller'])]
    : ['seller', 'affiliate'];

  for (const role of roleOrder) {
    const { data } = await supabase
      .from('influencer_referrals')
      .select('influencer_profile_id, recruited_role')
      .eq('recruited_profile_id', recruitedProfileId)
      .eq('recruited_role', role)
      .maybeSingle();
    const influencerId = String((data as any)?.influencer_profile_id || '').trim();
    if (influencerId) return { influencerProfileId: influencerId, recruitedRole: role };
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('recruited_by_influencer_id')
    .eq('id', recruitedProfileId)
    .maybeSingle();
  const fallback = String((profileRow as any)?.recruited_by_influencer_id || '').trim();
  return fallback ? { influencerProfileId: fallback, recruitedRole: preferredRole || null } : null;
}
