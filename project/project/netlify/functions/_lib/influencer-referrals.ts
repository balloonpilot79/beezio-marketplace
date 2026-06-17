export async function resolveRecruiterInfluencerId(
  supabaseAdmin: any,
  profileId: string | null,
  recruitedRole?: 'seller' | 'affiliate'
): Promise<string | null> {
  if (!profileId) return null;

  if (recruitedRole) {
    const { data: roleScoped } = await supabaseAdmin
      .from('influencer_referrals')
      .select('influencer_profile_id')
      .eq('recruited_profile_id', profileId)
      .eq('recruited_role', recruitedRole)
      .maybeSingle();

    const roleScopedId = String((roleScoped as any)?.influencer_profile_id || '').trim();
    if (roleScopedId) return roleScopedId;
  }

  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('recruited_by_influencer_id')
    .eq('id', profileId)
    .maybeSingle();

  const fallback = String((profileRow as any)?.recruited_by_influencer_id || '').trim();
  return fallback || null;
}
