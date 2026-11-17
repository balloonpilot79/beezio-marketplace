export type AccountInviter = {
  id: string;
  name: string;
  code: string | null;
  roles: string[];
};

// The signed-in client's RLS scopes these reads to the account's own referrals.
// Read display fields only; never fetch the inviter's private contact details.
export async function loadAccountInviters(db: any, profileId: string): Promise<AccountInviter[]> {
  if (!profileId) return [];
  const { data: assignments, error } = await db.from('influencer_referrals')
    .select('influencer_profile_id,recruited_role').eq('recruited_profile_id', profileId);
  if (error) throw error;
  const rolesByInviter = new Map<string, Set<string>>();
  for (const row of assignments || []) {
    const id = String(row.influencer_profile_id || '').trim();
    if (!id || id === profileId) continue;
    const roles = rolesByInviter.get(id) || new Set<string>();
    const role = String(row.recruited_role || '').toLowerCase();
    if (['buyer', 'seller', 'affiliate'].includes(role)) roles.add(role);
    rolesByInviter.set(id, roles);
  }
  if (!rolesByInviter.size) return [];
  const { data: profiles, error: directoryError } = await db.from('profile_directory')
    .select('id,full_name,referral_code').in('id', [...rolesByInviter.keys()]);
  if (directoryError) throw directoryError;
  const byId = new Map<string, any>((profiles || []).map((row: any) => [String(row.id), row]));
  return [...rolesByInviter].map(([id, roles]) => ({
    id,
    name: String(byId.get(id)?.full_name || '').trim() || 'a Beezio Ambassador',
    code: String(byId.get(id)?.referral_code || '').trim() || null,
    roles: ['buyer', 'seller', 'affiliate'].filter(role => roles.has(role)),
  }));
}
