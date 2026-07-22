import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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
  const pg = msg.match(/column\s+\"([^\"]+)\"\s+of\s+relation\s+\"[^\"]+\"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
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

  const existing = (await trySelect('or')) || (await trySelect('user_id')) || (await trySelect('id'));
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
    const message = String((lastError as any)?.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('unique')) {
      const resolved = (await trySelect('or')) || (await trySelect('user_id')) || (await trySelect('id'));
      if (resolved) return resolved;
    }
    return null;
  };

  const payloads = [
    { id: userId, user_id: userId, email, full_name: fullName },
    { id: userId, email, full_name: fullName },
    { user_id: userId, email, full_name: fullName },
  ];

  for (const payload of payloads) {
    const created = await insertWithColumnHealing(payload);
    if (created) return created;
  }

  return userId;
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
    const authHeader =
      headerToken || (bodyToken ? (bodyToken.startsWith('Bearer ') ? bodyToken : `Bearer ${bodyToken}`) : '');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({
      supabaseUrl,
      apiKey: serviceRoleKey,
      authHeader,
    });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });
    const emailConfirmedAt = String((user as any)?.email_confirmed_at || (user as any)?.confirmed_at || '').trim();
    if (!String((user as any)?.email || '').trim() || !emailConfirmedAt) {
      return json(403, { error: 'Confirm your email before adding marketplace products.', code: 'EMAIL_NOT_VERIFIED' });
    }

    const productId = String(body?.product_id || '').trim();
    if (!productId) return json(400, { error: 'Missing product_id' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const sellerId = await resolveOrCreateProfileId(supabaseAdmin, user);
    const sellerIds = Array.from(new Set([sellerId, user.id].map((value) => String(value || '').trim()).filter(Boolean)));

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, is_active, is_promotable, status, affiliate_enabled')
      .eq('id', productId)
      .maybeSingle();

    if (productError) return json(500, { error: 'Failed to load product', details: productError.message });
    if (!product?.id) return json(404, { error: 'Product not found' });
    const productVisible = isSelectableProduct(product) && product?.affiliate_enabled !== false;
    if (!productVisible) return json(400, { error: 'Product is inactive' });

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('seller_product_order')
      .select('id,seller_id')
      .in('seller_id', sellerIds)
      .eq('product_id', productId)
      .limit(sellerIds.length);

    if (existingError) {
      return json(500, { error: 'Failed to check existing seller product selection', details: existingError.message });
    }

    if (Array.isArray(existingRows) && existingRows.length >= sellerIds.length) {
      return json(200, { ok: true, seller_id: sellerId, product_id: productId, existing: true });
    }

    const { count } = await supabaseAdmin
      .from('seller_product_order')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId);

    const displayOrder = Number.isFinite(count) ? (count as number) : 0;

    const existingSellerIds = new Set(((existingRows as any[]) || []).map((row) => String(row?.seller_id || '').trim()));
    const insertSellerIds = sellerIds.filter((id) => !existingSellerIds.has(id));
    let lastInsertError: any = null;
    let insertedId: string | null = null;

    for (const id of insertSellerIds) {
      const insertPayload: any = {
        seller_id: id,
        product_id: productId,
        display_order: displayOrder,
        is_featured: Boolean(body?.is_featured),
      };
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('seller_product_order')
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

    if (insertSellerIds.length === 0 || insertedId || !lastInsertError) {
      return json(200, {
        ok: true,
        seller_id: sellerId,
        product_id: productId,
        existing: insertSellerIds.length === 0,
        id: insertedId,
      });
    }

    // Best-effort: if insert failed but row exists now (race), treat as existing.
    try {
      const { data: afterRows } = await supabaseAdmin
        .from('seller_product_order')
        .select('id')
        .in('seller_id', sellerIds)
        .eq('product_id', productId)
        .limit(1);
      if (Array.isArray(afterRows) && afterRows.length > 0) {
        return json(200, { ok: true, seller_id: sellerId, product_id: productId, existing: true });
      }
    } catch {
      // ignore
    }

    return json(500, {
      error: 'Failed to add product',
      details: String(lastInsertError?.message || 'Unknown error'),
      hint: 'Check seller_product_order table exists and constraints match expected schema.',
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
