import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getPayPalEnv } from './_lib/paypal';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  // Postgres error example: column "foo" of relation "bar" does not exist
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  // Postgres error example: column products.foo does not exist
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  // PostgREST schema cache example: Could not find the 'foo' column of 'bar' in the schema cache
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

function isSelectableProduct(product: any) {
  const status = String(product?.status || '').trim().toLowerCase();
  if (status === 'draft' || status === 'archived') return false;
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitVisibilityState =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitVisibilityState;
}

async function getAuthedUser(params: { supabaseUrl: string; apiKey: string; authHeader: string }) {
  const supabaseAuthed = createClient(params.supabaseUrl, params.apiKey, {
    global: { headers: { Authorization: params.authHeader } },
  });
  const { data, error } = await supabaseAuthed.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null };
}

async function resolveOrCreateProfileId(supabaseAdmin: any, user: any): Promise<string> {
  const userId = String(user?.id || '').trim();
  if (!userId) throw new Error('Missing user id');

  // Resolve in the most compatible way possible (schemas vary: profiles.id=userId, or profiles.user_id=userId).
  const trySelect = async (mode: 'user_id' | 'id' | 'or'): Promise<string | null> => {
    try {
      let query = supabaseAdmin.from('profiles').select('id');
      if (mode === 'user_id') query = query.eq('user_id', userId);
      if (mode === 'id') query = query.eq('id', userId);
      if (mode === 'or') query = query.or(`id.eq.${userId},user_id.eq.${userId}`);
      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      const id = String((data as any).id || '').trim();
      return id || null;
    } catch {
      return null;
    }
  };

  const existing =
    (await trySelect('or')) ||
    (await trySelect('user_id')) ||
    (await trySelect('id'));
  if (existing) return existing;

  const email = user.email || null;
  const metadata: any = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || null;

  const insertWithColumnHealing = async (payload: any): Promise<string | null> => {
    const working = { ...payload };
    let lastError: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(working)
        .select('id')
        .maybeSingle();
      if (!error) {
        const createdId = String((data as any)?.id || '').trim();
        return createdId || null;
      }
      lastError = error;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
        delete working[missing];
        continue;
      }
      break;
    }
    // If insert failed due to duplicates, try to resolve again.
    const message = String((lastError as any)?.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      const resolved = (await trySelect('or')) || (await trySelect('user_id')) || (await trySelect('id'));
      if (resolved) return resolved;
    }
    return null;
  };

  // Try a few insert shapes to handle different profiles schemas without ON CONFLICT.
  const payloads = [
    { id: userId, user_id: userId, email, full_name: fullName },
    { id: userId, email, full_name: fullName },
    { user_id: userId, email, full_name: fullName },
  ];

  for (const payload of payloads) {
    const created = await insertWithColumnHealing(payload);
    if (created) return created;
  }

  // Last resort so we can still proceed in schemas where affiliate_id == auth user id.
  return userId;
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      body = {};
    }

    const bodyToken = String(body?._access_token || body?.access_token || '').trim();
    const headerToken = String(event.headers.authorization || event.headers.Authorization || '').trim();
    const authHeader = headerToken || (bodyToken ? (bodyToken.startsWith('Bearer ') ? bodyToken : `Bearer ${bodyToken}`) : '');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({
      supabaseUrl,
      apiKey: serviceRoleKey,
      authHeader,
    });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const productId = String(body?.product_id || '').trim();
    if (!productId) return json(400, { error: 'Missing product_id' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const requestedAffiliateId = String(body?.affiliate_id || '').trim();
    const resolvedAffiliateId = await resolveOrCreateProfileId(supabaseAdmin, user);
    let affiliateId = resolvedAffiliateId;

    if (requestedAffiliateId && requestedAffiliateId !== resolvedAffiliateId) {
      const { data: requestedProfile } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id')
        .eq('id', requestedAffiliateId)
        .maybeSingle();
      if (requestedProfile && String((requestedProfile as any)?.user_id || '') === String(user.id)) {
        affiliateId = String((requestedProfile as any).id || resolvedAffiliateId);
      }
    }

    if (!affiliateId) return json(400, { error: 'Missing affiliate profile id' });

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, seller_id, is_active, is_promotable, status')
      .eq('id', productId)
      .maybeSingle();

    if (productError) {
      return json(500, { error: 'Failed to load product', details: productError.message });
    }
    if (!product?.id) return json(404, { error: 'Product not found' });
    if (String(product?.seller_id || '') === affiliateId || String(product?.seller_id || '') === user.id) {
      const paypalEnv = await getPayPalEnv();
      const allowSelfPromoInSandbox =
        String(process.env.ALLOW_SELF_PROMO_SANDBOX || 'true').trim().toLowerCase() === 'true';
      if (!(paypalEnv === 'sandbox' && allowSelfPromoInSandbox)) {
        return json(400, { error: 'You cannot promote your own product' });
      }
    }
    const productVisible = isSelectableProduct(product);
    if (!productVisible) return json(400, { error: 'Product is inactive' });

    const affiliateIds = [affiliateId];

    const { count } = await supabaseAdmin
      .from('affiliate_products')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId);

    const displayOrder = Number.isFinite(count) ? (count as number) : 0;

    // IMPORTANT: Do not use Postgres ON CONFLICT upserts here.
    // Some deployments are missing a UNIQUE constraint on (affiliate_id, product_id),
    // which makes ON CONFLICT fail with: "no unique or exclusion constraint matching".
    // Instead: check-then-insert (best-effort) to keep the flow working everywhere.

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('affiliate_products')
      .select('id, affiliate_id')
      .in('affiliate_id', affiliateIds)
      .eq('product_id', productId)
      .limit(affiliateIds.length);

    if (existingError) {
      return json(500, { error: 'Failed to check existing affiliate product', details: existingError.message });
    }

    if (Array.isArray(existingRows) && existingRows.length >= affiliateIds.length) {
      return json(200, { ok: true, affiliate_id: affiliateId, product_id: productId, existing: true });
    }

    const existingAffiliateIds = new Set(((existingRows as any[]) || []).map((row) => String(row?.affiliate_id || '').trim()));
    const insertAffiliateIds = affiliateIds.filter((id) => !existingAffiliateIds.has(id));
    let lastInsertError: any = null;
    let insertedId: string | null = null;
    for (const id of insertAffiliateIds) {
      const insertPayload: any = {
        affiliate_id: id,
        product_id: productId,
        display_order: displayOrder,
        is_featured: Boolean(body?.is_featured),
      };
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('affiliate_products')
          .insert(insertPayload)
          .select('id')
          .maybeSingle();

        if (!insertError) {
          insertedId = insertedId || String((inserted as any)?.id || '').trim() || null;
          lastInsertError = null;
          break;
        }

        lastInsertError = insertError;
        const missing = extractMissingColumnName(String((insertError as any)?.message || ''));
        if (missing && Object.prototype.hasOwnProperty.call(insertPayload, missing)) {
          delete insertPayload[missing];
          continue;
        }
        break;
      }
    }

    if (insertAffiliateIds.length === 0 || insertedId || !lastInsertError) {
      return json(200, {
        ok: true,
        affiliate_id: affiliateId,
        product_id: productId,
        existing: insertAffiliateIds.length === 0,
        id: insertedId,
      });
    }

    // Best-effort: if insert failed but row exists now (race), treat as existing.
    try {
      const { data: afterRows } = await supabaseAdmin
        .from('affiliate_products')
        .select('id')
        .in('affiliate_id', affiliateIds)
        .eq('product_id', productId)
        .limit(1);
      if (Array.isArray(afterRows) && afterRows.length > 0) {
        return json(200, { ok: true, affiliate_id: affiliateId, product_id: productId, existing: true });
      }
    } catch {
      // ignore
    }

    return json(500, {
      error: 'Failed to add product',
      details: String(lastInsertError?.message || 'Unknown error'),
      hint: 'Check affiliate_products table exists and RLS allows inserts (or use service role).',
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
