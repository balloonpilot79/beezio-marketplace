import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';

type RequestBody = {
  limit?: number;
  search?: string;
};

const asText = (value: unknown) => String(value || '').trim();
const asMoney = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

type InfluencerRelationship = {
  role: 'profile_default' | 'seller' | 'affiliate';
  influencer_id: string;
  influencer_name: string;
  influencer_email: string;
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgUnquoted = msg.match(/column\s+([a-z0-9_.]+)\s+does\s+not\s+exist/i);
  if (pgUnquoted?.[1]) {
    const columnName = pgUnquoted[1].split('.').pop();
    if (columnName) return columnName;
  }
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const selectWithFallback = async (queryFactory: (selected: string[]) => PromiseLike<any>, fields: string[]) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await queryFactory(selected);
    if (!error) return { data: (data as any[]) || [], selected, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], selected, error: lastError };
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<RequestBody>(event.body);
    const limit = Math.max(100, Math.min(5000, Number(body?.limit) || 2000));
    const search = asText(body?.search).toLowerCase();
    const supabaseAdmin = createSupabaseAdmin();

    const profileFields = [
      'id',
      'user_id',
      'full_name',
      'email',
      'role',
      'primary_role',
      'created_at',
      'username',
      'store_name',
      'recruited_by_influencer_id',
    ];

    const productFields = [
      'id',
      'seller_id',
      'title',
      'price',
      'created_at',
      'is_active',
      'is_promotable',
    ];

    const profilesResult = await selectWithFallback(
      (selected) =>
        supabaseAdmin
          .from('profiles')
          .select(selected.join(','))
          .order('created_at', { ascending: false })
          .limit(limit),
      profileFields
    );
    if (profilesResult.error) {
      return json(500, { error: String((profilesResult.error as any)?.message || 'Failed to load profiles') });
    }

    const profiles = (profilesResult.data as any[]) || [];
    const profileIds = Array.from(
      new Set(
        profiles.flatMap((profile) => [asText(profile?.id), asText(profile?.user_id)]).filter(Boolean)
      )
    );

    const [paypalAccountsResult, productsResult, referralsResult] = await Promise.all([
      profileIds.length
        ? supabaseAdmin
            .from('paypal_accounts')
            .select('user_id, role, paypal_email')
            .in('user_id', profileIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      selectWithFallback(
        (selected) =>
          supabaseAdmin
            .from('products')
            .select(selected.join(','))
            .order('created_at', { ascending: false })
            .limit(Math.max(limit * 4, 2000)),
        productFields
      ),
      profileIds.length
        ? supabaseAdmin
            .from('influencer_referrals')
            .select('recruited_profile_id, recruited_role, influencer_profile_id')
            .in('recruited_profile_id', profileIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if ((paypalAccountsResult as any).error) {
      return json(500, { error: String(((paypalAccountsResult as any).error as any)?.message || 'Failed to load PayPal accounts') });
    }
    if (productsResult.error) {
      return json(500, { error: String((productsResult.error as any)?.message || 'Failed to load products') });
    }
    if ((referralsResult as any).error) {
      return json(500, { error: String((((referralsResult as any).error) as any)?.message || 'Failed to load influencer referrals') });
    }

    const recruiterIds = Array.from(
      new Set(
        [
          ...profiles.map((profile) => asText(profile?.recruited_by_influencer_id)),
          ...(((referralsResult as any).data as any[]) || []).map((row: any) => asText(row?.influencer_profile_id)),
        ].filter(Boolean)
      )
    );

    const recruiterProfilesResult = recruiterIds.length
      ? await selectWithFallback(
          (selected) =>
            supabaseAdmin
              .from('profiles')
              .select(selected.join(','))
              .in('id', recruiterIds),
          ['id', 'full_name', 'email']
        )
      : { data: [] as any[], selected: [] as string[], error: null };

    if (recruiterProfilesResult.error) {
      return json(500, { error: String((recruiterProfilesResult.error as any)?.message || 'Failed to load recruiter profiles') });
    }

    const paypalByUser = new Map<string, Array<{ role: string; paypal_email: string }>>();
    for (const row of ((paypalAccountsResult as any).data as any[]) || []) {
      const userId = asText(row?.user_id);
      const paypalEmail = asText(row?.paypal_email);
      if (!userId || !paypalEmail) continue;
      const current = paypalByUser.get(userId) || [];
      current.push({
        role: asText(row?.role).toLowerCase(),
        paypal_email: paypalEmail,
      });
      paypalByUser.set(userId, current);
    }

    const productsBySeller = new Map<string, any[]>();
    for (const product of (productsResult.data as any[]) || []) {
      const sellerId = asText(product?.seller_id);
      if (!sellerId) continue;
      const current = productsBySeller.get(sellerId) || [];
      current.push(product);
      productsBySeller.set(sellerId, current);
    }

    const recruiterProfileMap = new Map<string, { full_name: string; email: string }>();
    for (const recruiter of (recruiterProfilesResult.data as any[]) || []) {
      const recruiterId = asText(recruiter?.id);
      if (!recruiterId) continue;
      recruiterProfileMap.set(recruiterId, {
        full_name: asText(recruiter?.full_name),
        email: asText(recruiter?.email),
      });
    }

    const referralMap = new Map<string, InfluencerRelationship[]>();
    for (const referral of (((referralsResult as any).data as any[]) || [])) {
      const recruitedProfileId = asText(referral?.recruited_profile_id);
      const recruitedRole = asText(referral?.recruited_role).toLowerCase();
      const influencerId = asText(referral?.influencer_profile_id);
      if (!recruitedProfileId || !influencerId) continue;
      const recruiterProfile = recruiterProfileMap.get(influencerId);
      const current = referralMap.get(recruitedProfileId) || [];
      current.push({
        role: recruitedRole === 'seller' ? 'seller' : 'affiliate',
        influencer_id: influencerId,
        influencer_name: recruiterProfile?.full_name || recruiterProfile?.email || influencerId,
        influencer_email: recruiterProfile?.email || '',
      });
      referralMap.set(recruitedProfileId, current);
    }

    let users = profiles.map((profile) => {
      const id = asText(profile?.id);
      const userId = asText(profile?.user_id);
      const productMatches = [
        ...(productsBySeller.get(id) || []),
        ...(userId && userId !== id ? productsBySeller.get(userId) || [] : []),
      ];
      const uniqueProducts = Array.from(new Map(productMatches.map((product) => [asText(product?.id), product])).values());
      const paypalAccounts = [
        ...(paypalByUser.get(id) || []),
        ...(userId && userId !== id ? paypalByUser.get(userId) || [] : []),
      ];
      const defaultRecruiterId = asText(profile?.recruited_by_influencer_id);
      const defaultRecruiterProfile = recruiterProfileMap.get(defaultRecruiterId);
      const influencerRelationships = [
        ...(defaultRecruiterId
          ? [{
              role: 'profile_default' as const,
              influencer_id: defaultRecruiterId,
              influencer_name: defaultRecruiterProfile?.full_name || defaultRecruiterProfile?.email || defaultRecruiterId,
              influencer_email: defaultRecruiterProfile?.email || '',
            }]
          : []),
        ...(referralMap.get(id) || []),
        ...(userId && userId !== id ? referralMap.get(userId) || [] : []),
      ];
      const uniqueInfluencerRelationships = Array.from(
        new Map(
          influencerRelationships.map((relationship) => [
            `${relationship.role}::${relationship.influencer_id}`,
            relationship,
          ])
        ).values()
      );

      return {
        id: id || userId,
        user_id: userId || id,
        full_name: asText(profile?.full_name),
        email: asText(profile?.email),
        role: asText(profile?.role).toLowerCase(),
        primary_role: asText(profile?.primary_role).toLowerCase(),
        username: asText(profile?.username),
        store_name: asText(profile?.store_name),
        created_at: profile?.created_at || null,
        paypal_accounts: Array.from(
          new Map(paypalAccounts.map((account) => [`${account.role}::${account.paypal_email}`, account])).values()
        ),
        recruited_by_influencer_id: defaultRecruiterId,
        influencer_relationships: uniqueInfluencerRelationships,
        selling_products: uniqueProducts.map((product) => ({
          id: asText(product?.id),
          title: asText(product?.title),
          price: asMoney(product?.price),
          created_at: product?.created_at || null,
          is_active: Boolean(product?.is_active),
          is_promotable: Boolean(product?.is_promotable),
        })),
      };
    });

    if (search) {
      users = users.filter((user) => {
        const haystack = [
          user.id,
          user.user_id,
          user.full_name,
          user.email,
          user.role,
          user.primary_role,
          user.username,
          user.store_name,
          user.recruited_by_influencer_id,
          ...user.paypal_accounts.flatMap((account: any) => [account.role, account.paypal_email]),
          ...(Array.isArray((user as any).influencer_relationships)
            ? (user as any).influencer_relationships.flatMap((relationship: InfluencerRelationship) => [
                relationship.role,
                relationship.influencer_id,
                relationship.influencer_name,
                relationship.influencer_email,
              ])
            : []),
          ...user.selling_products.flatMap((product: any) => [product.id, product.title]),
        ]
          .map((value) => asText(value).toLowerCase())
          .filter(Boolean);
        return haystack.some((value) => value.includes(search));
      });
    }

    return json(200, {
      ok: true,
      count: users.length,
      users,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
