import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { applyCanonicalProductPricing } from '../../shared/productPricing';

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
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
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

async function resolveProfileAliases(supabaseAdmin: any, userId: string) {
  const aliases = new Set<string>([userId].filter(Boolean));

  const tryProfileLookup = async (mode: 'or' | 'id' | 'user_id') => {
    try {
      let query = supabaseAdmin.from('profiles').select('id,user_id,email,full_name');
      if (mode === 'or') query = query.or(`id.eq.${userId},user_id.eq.${userId}`);
      if (mode === 'id') query = query.eq('id', userId);
      if (mode === 'user_id') query = query.eq('user_id', userId);
      const { data } = await query.limit(5);
      (data || []).forEach((profile: any) => {
        const id = String(profile?.id || '').trim();
        const profileUserId = String(profile?.user_id || '').trim();
        if (id) aliases.add(id);
        if (profileUserId) aliases.add(profileUserId);
      });
    } catch {
      // Profiles schemas differ between deployments. Keep the auth id alias if lookup fails.
    }
  };

  await tryProfileLookup('or');
  await tryProfileLookup('id');
  await tryProfileLookup('user_id');

  return Array.from(aliases);
}

const isVisibleProduct = (product: any): boolean => {
  const status = String(product?.status || '').trim().toLowerCase();
  if (status === 'archived') return false;
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitState =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitState;
};

const normalizeAffiliateProduct = (product: any) => {
  const normalized = { ...(product || {}) };
  const normalizedPercent = Number(normalized?.commission_rate || 0);
  const normalizedAffiliateRate = Number(normalized?.affiliate_commission_rate || 0);
  const normalizedAffiliateValue = Number(normalized?.affiliate_commission_value || 0);
  const normalizedFlatAmount = Number(normalized?.flat_commission_amount || 0);
  const commissionType = String(normalized?.commission_type || '').trim().toLowerCase();
  const affiliateCommissionType = String(normalized?.affiliate_commission_type || '').trim().toLowerCase();
  const hasAnyCommission = normalizedPercent > 0 || normalizedAffiliateRate > 0 || normalizedAffiliateValue > 0 || normalizedFlatAmount > 0;

  if (!hasAnyCommission) {
    normalized.commission_type = 'percentage';
    normalized.affiliate_commission_type = 'percent';
    normalized.commission_rate = 30;
    normalized.affiliate_commission_rate = 30;
    normalized.affiliate_commission_value = 30;
    return normalized;
  }

  if ((affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed') && normalizedPercent <= 0) {
    const displayFlatAmount = normalizedFlatAmount > 0
      ? normalizedFlatAmount
      : normalizedAffiliateValue > 0
        ? normalizedAffiliateValue
        : normalizedAffiliateRate > 0
          ? normalizedAffiliateRate
          : 0;
    if (displayFlatAmount > 0) {
      normalized.commission_rate = displayFlatAmount;
      if (!(normalized.affiliate_commission_rate > 0)) {
        normalized.affiliate_commission_rate = displayFlatAmount;
      }
    }
  }

  return normalized;
};

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

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
    if (!authHeader) return json(401, { ok: false, error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({ supabaseUrl, apiKey: serviceRoleKey, authHeader });
    if (!user) return json(401, { ok: false, error: 'Unauthorized', details: authErr });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const userId = String(user.id || '').trim();
    const aliases = new Set(await resolveProfileAliases(supabaseAdmin, userId));

    const requestedAffiliateId = String(body?.affiliate_id || '').trim();
    const requestedIds = Array.isArray(body?.affiliate_ids) ? body.affiliate_ids : [];
    [requestedAffiliateId, ...requestedIds].slice(0, 10).forEach((value) => {
      const id = String(value || '').trim();
      if (id) aliases.add(id);
    });

    const affiliateIds = Array.from(aliases).filter(Boolean);
    if (!affiliateIds.length) return json(200, { ok: true, rows: [], affiliate_ids: [] });

    let affiliateSelectFields = 'id,affiliate_id,product_id,is_featured,display_order,created_at';
    let affiliateRows: any[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error } = await supabaseAdmin
        .from('affiliate_products')
        .select(affiliateSelectFields)
        .in('affiliate_id', affiliateIds)
        .order('display_order', { ascending: true });

      if (!error) {
        affiliateRows = Array.isArray(data) ? data : [];
        break;
      }

      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && affiliateSelectFields.split(',').map((field) => field.trim()).includes(missing)) {
        affiliateSelectFields = affiliateSelectFields
          .split(',')
          .map((field) => field.trim())
          .filter((field) => field && field !== missing)
          .join(',');
        continue;
      }

      return json(500, { ok: false, error: 'Failed to load affiliate products', details: (error as any)?.message || String(error) });
    }

    const rowByProductId = new Map<string, any>();
    (affiliateRows || []).forEach((row: any) => {
      const productId = String(row?.product_id || '').trim();
      if (!productId) return;
      const existing = rowByProductId.get(productId);
      if (!existing) {
        rowByProductId.set(productId, row);
        return;
      }
      const existingOrder = Number.isFinite(Number(existing?.display_order)) ? Number(existing.display_order) : 999;
      const nextOrder = Number.isFinite(Number(row?.display_order)) ? Number(row.display_order) : 999;
      if (nextOrder < existingOrder || (row?.is_featured && !existing?.is_featured)) rowByProductId.set(productId, row);
    });

    const productIds = Array.from(rowByProductId.keys());
    let productsById = new Map<string, any>();

    if (productIds.length) {
      let selectFields =
        'id,title,name,description,price,seller_ask,seller_amount,seller_ask_price,seller_id,commission_rate,affiliate_commission_rate,commission_type,affiliate_commission_type,flat_commission_amount,affiliate_commission_value,category,image_url,images,is_active,is_promotable,status,created_at';
      let productRows: any[] = [];

      for (let attempt = 0; attempt < 16; attempt++) {
        const { data, error } = await supabaseAdmin.from('products').select(selectFields).in('id', productIds.slice(0, 500));
        if (!error) {
          productRows = Array.isArray(data) ? data : [];
          break;
        }
        const missing = extractMissingColumnName(String((error as any)?.message || ''));
        if (missing && selectFields.split(',').map((field) => field.trim()).includes(missing)) {
          selectFields = selectFields
            .split(',')
            .map((field) => field.trim())
            .filter((field) => field && field !== missing)
            .join(',');
          continue;
        }
        return json(500, { ok: false, error: 'Failed to load product details', details: (error as any)?.message || String(error) });
      }

      const visibleProducts = productRows.filter(isVisibleProduct);
      const sellerIds = Array.from(new Set(visibleProducts.map((product: any) => String(product?.seller_id || '').trim()).filter(Boolean)));
      const sellerNameById = new Map<string, string>();
      if (sellerIds.length) {
        const { data: sellers } = await supabaseAdmin
          .from('profiles')
          .select('id,full_name,email')
          .in('id', sellerIds.slice(0, 500));
        (sellers || []).forEach((seller: any) => {
          const id = String(seller?.id || '').trim();
          if (id) sellerNameById.set(id, String(seller?.full_name || seller?.email || 'Unknown Seller'));
        });
      }

      productsById = new Map(
        visibleProducts.map((product: any) => [
          String(product.id),
          {
            ...applyCanonicalProductPricing(normalizeAffiliateProduct(product)),
            profiles: { full_name: sellerNameById.get(String(product?.seller_id || '').trim()) || 'Unknown Seller' },
          },
        ])
      );
    }

    const rows = Array.from(rowByProductId.values())
      .map((row: any) => ({
        ...row,
        products: productsById.get(String(row?.product_id || '').trim()) || null,
      }))
      .filter((row: any) => Boolean(row.products))
      .sort((a: any, b: any) => {
        if (a?.is_featured && !b?.is_featured) return -1;
        if (!a?.is_featured && b?.is_featured) return 1;
        const orderA = Number.isFinite(Number(a?.display_order)) ? Number(a.display_order) : 999;
        const orderB = Number.isFinite(Number(b?.display_order)) ? Number(b.display_order) : 999;
        return orderA - orderB;
      });

    return json(200, { ok: true, rows, affiliate_ids: affiliateIds });
  } catch (e) {
    return json(500, { ok: false, error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
