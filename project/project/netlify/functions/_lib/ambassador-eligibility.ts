// Referral participation does not grant business/store access. Buyers keep
// their buyer role and use the existing ambassador accounting payee bucket.
export async function loadAmbassadorProfile(db: any, profileId: string | null) {
  if (!profileId) return null;
  const { data: profile, error } = await db.from('profiles')
    .select('id,user_id,full_name,role,primary_role').eq('id', profileId).maybeSingle();
  if (error) throw new Error(`Unable to verify ambassador: ${error.message}`);
  if (!profile) return null;
  // Preserve existing business ambassador eligibility.
  if ([profile.role, profile.primary_role].some(role => String(role || '').toLowerCase() === 'influencer')) return profile;
  const ids = [...new Set([profileId, profile.user_id].filter(Boolean))];
  const { data: role, error: roleError } = await db.from('user_roles')
    .select('user_id').in('user_id', ids).in('role', ['influencer', 'buyer'])
    .eq('is_active', true).limit(1).maybeSingle();
  if (roleError) throw new Error(`Unable to verify ambassador role: ${roleError.message}`);
  return role ? profile : null;
}
