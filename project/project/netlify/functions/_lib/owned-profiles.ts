type MinimalUser = {
  id?: string | null;
  email?: string | null;
  user_metadata?: any;
};

const addIds = (bucket: Set<string>, rows: any[] | null | undefined) => {
  (rows || []).forEach((row) => {
    const id = String((row as any)?.id || '').trim();
    if (id) bucket.add(id);
  });
};

const addCandidate = (bucket: Set<string>, value: unknown) => {
  const text = String(value || '').trim();
  if (text) bucket.add(text);
};

const queryMaybeMany = async (queryFactory: () => any) => {
  try {
    const { data } = await queryFactory();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export async function resolveOwnedProfileIdsForUser(params: {
  supabaseAdmin: any;
  user: MinimalUser;
}): Promise<string[]> {
  const { supabaseAdmin, user } = params;
  const authUserId = String(user?.id || '').trim();
  const ownerIds = new Set<string>();

  if (authUserId) {
    ownerIds.add(authUserId);

    const directMatches = await queryMaybeMany(() =>
      supabaseAdmin
        .from('profiles')
        .select('id,user_id,email')
        .or(`id.eq.${authUserId},user_id.eq.${authUserId}`)
        .limit(50)
    );
    addIds(ownerIds, directMatches);
    directMatches.forEach((row: any) => {
      addCandidate(ownerIds, row?.user_id);
    });

    const byUserId = await queryMaybeMany(() =>
      supabaseAdmin
        .from('profiles')
        .select('id,user_id,email')
        .eq('user_id', authUserId)
        .limit(50)
    );
    addIds(ownerIds, byUserId);
    byUserId.forEach((row: any) => {
      addCandidate(ownerIds, row?.user_id);
    });

    const byId = await queryMaybeMany(() =>
      supabaseAdmin
        .from('profiles')
        .select('id,user_id,email')
        .eq('id', authUserId)
        .limit(50)
    );
    addIds(ownerIds, byId);
    byId.forEach((row: any) => {
      addCandidate(ownerIds, row?.user_id);
    });
  }

  return Array.from(ownerIds);
}
