import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { applyCanonicalProductPricing } from '../../shared/productPricing';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
    },
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

function isMarketplaceVisible(product: any) {
  const status = String(product?.status || '').trim().toLowerCase();
  if (status === 'draft' || status === 'archived' || status === 'store_only') {
    return false;
  }

  return product?.affiliate_enabled === true && product?.is_promotable === true && product?.is_active === true && status === 'active';
}

function looksLikeCjProduct(product: any): boolean {
  const directMarkers = [
    product?.source_platform,
    product?.source,
    product?.dropship_provider,
    product?.inventory_source,
    product?.lineage,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  if (directMarkers.some((value) => value === 'cj')) return true;
  if (String(product?.cj_product_id || '').trim() || String(product?.cj_pid || '').trim() || String(product?.cj_spu || '').trim()) return true;

  const imageList = Array.isArray(product?.images) ? product.images : [];
  return imageList.some((entry: any) => String(entry || '').toLowerCase().includes('cjdropshipping.com'));
}

function normalizeLegacyMarketplaceProduct(product: any) {
  const normalized = { ...(product || {}) };
  const commissionType = String(normalized?.commission_type || '').trim().toLowerCase();
  const affiliateCommissionType = String(normalized?.affiliate_commission_type || '').trim().toLowerCase();
  const hasExplicitFlatType =
    affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed';
  const hasStoredFlatAmount =
    Number(normalized?.flat_commission_amount || 0) > 0 ||
    (affiliateCommissionType === 'flat' && Number(normalized?.affiliate_commission_value || 0) > 0);

  if (
    hasExplicitFlatType &&
    Number(normalized?.affiliate_commission_value || 0) <= 0 &&
    Number(normalized?.flat_commission_amount || 0) <= 0 &&
    Number(normalized?.commission_rate || 0) > 0
  ) {
    normalized.affiliate_commission_type = 'flat';
    normalized.affiliate_commission_value = Number(normalized.commission_rate);
    normalized.flat_commission_amount = Number(normalized.commission_rate);
  }

  if (looksLikeCjProduct(normalized)) {
    normalized.source_platform = 'cj';
    normalized.source = normalized.source || 'cj';
    normalized.inventory_source = normalized.inventory_source || 'cj';
    normalized.lineage = normalized.lineage || 'CJ';

    if (!hasExplicitFlatType && !hasStoredFlatAmount && Number(normalized?.commission_rate || 0) > 0) {
      normalized.commission_type = 'flat_rate';
      normalized.affiliate_commission_type = 'flat';
      normalized.affiliate_commission_value = Number(normalized.commission_rate);
      normalized.flat_commission_amount = Number(normalized.commission_rate);
    }
  }

  const normalizedPercent = Number(normalized?.commission_rate || 0);
  const normalizedAffiliateRate = Number(normalized?.affiliate_commission_rate || 0);
  const normalizedAffiliateValue = Number(normalized?.affiliate_commission_value || 0);
  const normalizedFlatAmount = Number(normalized?.flat_commission_amount || 0);
  const hasAnyCommission = normalizedPercent > 0 || normalizedAffiliateRate > 0 || normalizedAffiliateValue > 0 || normalizedFlatAmount > 0;

  if (!hasAnyCommission) {
    normalized.commission_type = 'percentage';
    normalized.affiliate_commission_type = 'percent';
    normalized.commission_rate = 30;
    normalized.affiliate_commission_rate = 30;
    normalized.affiliate_commission_value = 30;
  } else if (
    (String(normalized?.affiliate_commission_type || '').trim().toLowerCase() === 'flat' ||
      String(normalized?.commission_type || '').trim().toLowerCase() === 'flat_rate' ||
      String(normalized?.commission_type || '').trim().toLowerCase() === 'fixed') &&
    normalizedPercent <= 0
  ) {
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
}

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const limitParam = String(event?.queryStringParameters?.limit || '').trim();
    const parsedLimit = Number.parseInt(limitParam, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 60;
    const queryLimit = 200;

    // Keep this intentionally conservative (public fields only).
    let selectFields =
      'id,title,description,price,stock_quantity,total_inventory,in_stock,track_inventory,inventory_source,category,category_id,images,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value,seller_id,average_rating,review_count,created_at,is_active,is_promotable,affiliate_enabled,status,lineage,dropship_provider,source_platform,source,cj_product_id,cj_pid,cj_product_code,cj_product_sku,cj_spu,display_search_code,import_status,seller_ask,seller_amount,seller_ask_price,calculated_customer_price';

    for (let attempt = 0; attempt < 16; attempt++) {
      const query = supabaseAdmin
        .from('products')
        .select(selectFields)
        .eq('is_active', true)
        .eq('is_promotable', true)
        .eq('affiliate_enabled', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(queryLimit);

      const { data, error } = await query;
      if (!error) {
        let products = Array.isArray(data) ? data : [];
        // Keep explicit hidden states out of the public marketplace, but do not
        // drop products solely because inventory metadata is incomplete or stale.
        products = products.filter((p: any) => isMarketplaceVisible(p));

        const categoryIds = Array.from(
          new Set(products.map((p: any) => String(p?.category_id || '').trim()).filter(Boolean))
        );
        const categoryMetaById = new Map<string, { name?: string; slug?: string; parent_id?: string | null }>();
        if (categoryIds.length) {
          const { data: categories } = await supabaseAdmin
            .from('categories')
            .select('id,name,slug,parent_id')
            .in('id', categoryIds.slice(0, 500));
          (categories || []).forEach((row: any) => {
            const id = String(row?.id || '').trim();
            if (!id) return;
            categoryMetaById.set(id, {
              name: String(row?.name || '').trim() || undefined,
              slug: String(row?.slug || '').trim() || undefined,
              parent_id: row?.parent_id ? String(row.parent_id).trim() : null,
            });
          });
        }

        // Attach seller names without relying on FK joins.
        const sellerIds = Array.from(new Set(products.map((p: any) => String(p?.seller_id || '').trim()).filter(Boolean)));
        const sellerMetaById = new Map<string, { full_name?: string; location?: string }>();
        if (sellerIds.length) {
          const { data: sellers } = await supabaseAdmin
            .from('profiles')
            .select('id,full_name,location')
            .in('id', sellerIds.slice(0, 500));
          (sellers || []).forEach((row: any) => {
            const id = String(row?.id || '').trim();
            if (!id) return;
            sellerMetaById.set(id, {
              full_name: String(row?.full_name || '').trim() || undefined,
              location: String(row?.location || '').trim() || undefined,
            });
          });
        }

        const normalized = products.map((p: any) => {
          const row = applyCanonicalProductPricing(normalizeLegacyMarketplaceProduct(p));
          const sellerMeta = sellerMetaById.get(String(row?.seller_id || '').trim()) || {};
          const categoryMeta = categoryMetaById.get(String(row?.category_id || '').trim()) || {};
          return {
            ...row,
            category: String(row?.category || categoryMeta.name || '').trim() || null,
            category_name: String(categoryMeta.name || row?.category || '').trim() || null,
            category_slug: String(row?.category_slug || categoryMeta.slug || '').trim() || null,
            profiles: {
              full_name: sellerMeta.full_name,
              location: sellerMeta.location,
            },
          };
        }).slice(0, limit);

        return json(200, { ok: true, products: normalized });
      }

      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      // If the error is about selecting columns that don't exist, drop them and retry.
      if (missing && selectFields.includes(missing)) {
        selectFields = selectFields
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== missing)
          .join(',');
        continue;
      }

      return json(500, { ok: false, error: 'Failed to load products', details: (error as any)?.message || String(error) });
    }

    return json(500, { ok: false, error: 'Failed to load products' });
  } catch (e) {
    return json(500, { ok: false, error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export { handler };
