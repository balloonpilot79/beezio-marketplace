import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import type { SampleProduct } from '../data/sampleProducts';
import { buildPricedProduct } from '../utils/pricing';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { getCJProductDetail } from './cjDropshipping';

export interface MarketplaceProduct extends SampleProduct {}

type ProductRow = Database['public']['Tables']['products']['Row'];

type ProductRowWithJoins = ProductRow & {
  profiles?: {
    full_name?: string | null;
  } | null;
  categories?: {
    name?: string | null;
  } | null;
};

const PLACEHOLDER_IMAGE = '/api/placeholder/300/200';
const PUBLIC_BUCKET_BASE = `${supabaseUrl}/storage/v1/object/public/product-images`;

// Normalize any stored path (full URL, bucket-prefixed path, or bare filename) to a usable public URL
const resolveImageUrl = (path?: string | null) => {
  if (!path) return PLACEHOLDER_IMAGE;

  // If we already have a full URL, just use it
  if (path.startsWith('http')) {
    return path;
  }

  // Clean up common variants that include bucket/public prefixes
  let cleaned = path
    .replace(/^public\//, '')
    .replace(/^product-images\//, '')
    .replace(/^storage\/v1\/object\/public\//, '')
    .replace(/^object\/public\//, '')
    .replace(/^\/+/, '');

  // If someone stored "product-images/..." keep the inner path
  cleaned = cleaned.replace(/^product-images\//, '');

  const { data } = supabase.storage.from('product-images').getPublicUrl(cleaned);
  if (data?.publicUrl) {
    return data.publicUrl;
  }

  // Fallback manual construction
  return `${PUBLIC_BUCKET_BASE}/${cleaned}`;
};

const mapProductRowToMarketplaceProduct = (row: ProductRowWithJoins): MarketplaceProduct | null => {
  if (!row.id || !row.title) {
    return null;
  }

  const primaryImage =
    (row as any).image ||
    (row as any).image_url ||
    (row as any).thumbnail ||
    row.images?.[0];

  const baseProduct: MarketplaceProduct = {
    id: row.id,
    name: row.title,
    price: row.price ?? 0,
    seller_ask: (row as any).seller_ask ?? (row as any).seller_ask_price ?? (row as any).seller_amount ?? row.price ?? 0,
    currency: (row as any).currency ?? 'USD',
    image: resolveImageUrl(primaryImage),
    images: row.images?.map(resolveImageUrl) ?? (primaryImage ? [resolveImageUrl(primaryImage)] : undefined),
    lineage: (row as any).lineage,
    dropship_provider: (row as any).dropship_provider,
    rating: 4.8,
    category: row.categories?.name ?? 'Marketplace',
    description: sanitizeDescriptionForDisplay(row.description ?? '', (row as any).lineage),
    seller: row.profiles?.full_name ?? 'Marketplace Seller',
    sellerId: row.seller_id ?? undefined,
    reviews: row.views_count ?? 0,
    commission_rate: row.commission_rate ?? 0,
    commission_type: row.commission_type ?? 'percentage',
    flat_commission_amount: row.flat_commission_amount ?? 0,
    affiliate_commission_type: (row as any).affiliate_commission_type,
    affiliate_commission_value: (row as any).affiliate_commission_value,
    shipping_price: (row as any).shipping_price ?? row.shipping_cost ?? 0,
    shipping_cost: (row as any).shipping_price ?? row.shipping_cost ?? 0,
    stock_quantity: row.stock_quantity ?? undefined,
    created_at: row.created_at ?? new Date().toISOString()
  };

  return buildPricedProduct(baseProduct);
};

const baseSelectWithCategories = `*, profiles:seller_id ( full_name ), categories:category_id ( name )`;
const baseSelectNoCategories = `*, profiles:seller_id ( full_name )`;

const extractMissingColumnName = (message: string): string | null => {
  const match = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
  if (match?.[1]) return match[1];
  const match2 = message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
  if (match2?.[1]) return match2[1];
  return null;
};

const messageIndicatesCategoryJoinIssue = (message: string): boolean => {
  const m = message.toLowerCase();
  return m.includes('category_id') || m.includes('relationship') || m.includes('categories');
};

const fetchProductsWithSelfHealing = async (params: {
  limit?: number;
  productId?: string;
}): Promise<{ data: any[] | any | null; error: any }> => {
  const selectCandidates = [baseSelectWithCategories, baseSelectNoCategories];
  const defaultFilters = params.productId
    ? []
    : [
        { column: 'is_active', value: true },
        { column: 'is_promotable', value: true },
        { column: 'affiliate_enabled', value: true },
      ];

  let lastError: any = null;

  for (const select of selectCandidates) {
    let filters = [...defaultFilters];

    for (let attempt = 0; attempt < 8; attempt++) {
      let query = supabase.from('products').select(select);

      if (params.productId) {
        query = query.eq('id', params.productId);
      } else {
        query = query.order('created_at', { ascending: false });
        if (typeof params.limit === 'number') {
          query = query.limit(params.limit);
        }
      }

      filters.forEach((f) => {
        query = query.eq(f.column as any, f.value);
      });

      const { data, error } = params.productId ? await (query as any).maybeSingle() : await (query as any);

      if (!error) {
        return { data, error: null };
      }

      lastError = error;

      const message = String((error as any)?.message || '');
      const missing = extractMissingColumnName(message);

      if (missing && filters.some((f) => f.column === missing)) {
        filters = filters.filter((f) => f.column !== missing);
        continue;
      }

      // Some schemas won't support the categories join (missing `category_id` or FK).
      if (select === baseSelectWithCategories && messageIndicatesCategoryJoinIssue(message)) {
        break;
      }

      return { data: null, error };
    }
  }

  return { data: null, error: lastError };
};

export const fetchMarketplaceProducts = async (limit?: number): Promise<MarketplaceProduct[]> => {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await fetchProductsWithSelfHealing({ limit });

  if (error) {
    console.error('fetchMarketplaceProducts: Supabase error', error);
    throw error;
  }

  return (Array.isArray(data) ? data : [])
    .map(mapProductRowToMarketplaceProduct)
    .filter((product): product is MarketplaceProduct => Boolean(product));
};

export const fetchProductById = async (productId: string): Promise<MarketplaceProduct | null> => {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await fetchProductsWithSelfHealing({ productId });

  if (error) {
    console.error('fetchProductById: Supabase error', error);
    return null;
  }

  if (!data || Array.isArray(data)) {
    return null;
  }

  return mapProductRowToMarketplaceProduct(data as ProductRowWithJoins);
};

export const enrichCjProductImagesIfNeeded = async (params: {
  productId: string;
  existingImages?: string[] | null;
  fallbackSingleImage?: string | null;
}): Promise<string[] | null> => {
  if (!isSupabaseConfigured) return null;

  const existing = Array.isArray(params.existingImages) ? params.existingImages.filter(Boolean) : [];
  if (existing.length >= 2) return null;

  try {
    const { data: mapping, error: mappingError } = await supabase
      .from('cj_product_mappings')
      .select('cj_product_id')
      .eq('beezio_product_id', params.productId)
      .maybeSingle();

    if (mappingError) {
      console.warn('enrichCjProductImagesIfNeeded: mapping lookup failed (non-blocking):', mappingError);
      return null;
    }

    const pid = (mapping as any)?.cj_product_id;
    if (!pid) return null;

    let detail: any = null;
    try {
      detail = await getCJProductDetail(String(pid));
    } catch (e) {
      console.warn('enrichCjProductImagesIfNeeded: CJ detail fetch failed (non-blocking):', e);
      detail = null;
    }

    const imagesFromDetail = Array.isArray(detail?.productImageList) ? detail.productImageList : [];
    const fallback = String(params.fallbackSingleImage ?? '').trim();
    const finalImagesRaw = [...imagesFromDetail, ...(fallback ? [fallback] : [])]
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const url of finalImagesRaw) {
      if (seen.has(url)) continue;
      seen.add(url);
      deduped.push(url);
      if (deduped.length >= 10) break;
    }

    if (!deduped.length) return null;

    const { error: updateError } = await supabase.from('products').update({ images: deduped }).eq('id', params.productId);
    if (updateError) {
      console.warn('enrichCjProductImagesIfNeeded: product update failed (non-blocking):', updateError);
      return deduped;
    }

    return deduped;
  } catch (e) {
    console.warn('enrichCjProductImagesIfNeeded: unexpected failure (non-blocking):', e);
    return null;
  }
};

export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_REGEX.test(trimmed);
};

const parseLooseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const ATTRIBUTE_PART_SPLIT = /[|,;\/]+/;

// The CJ import pipeline sometimes stores raw CJ variants in `products.variants` JSONB.
// This helper mirrors the server-side attribute parsing so the UI can render Size/Color selectors
// even when normalized `product_variants` rows are missing or unavailable.
const parseLegacyVariantAttributes = (variant: any): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const looseFragments: string[] = [];

  const hydrate = (source?: string) => {
    if (!source) return;
    const cleaned = String(source).replace(/[\r\n]+/g, ' ').trim();
    if (!cleaned) return;
    const parts = cleaned
      .split(ATTRIBUTE_PART_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const separatorIndex = part.search(/[:=]/);
      if (separatorIndex >= 0) {
        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key && value) {
          attributes[key] = value;
          return;
        }
      }
      looseFragments.push(part);
    });
  };

  hydrate(variant?.variantKey);
  hydrate(variant?.variantNameEn);
  hydrate(variant?.name);
  hydrate(variant?.title);

  if (variant?.attributes && typeof variant.attributes === 'object' && !Array.isArray(variant.attributes)) {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (!key) return;
      const str = String(value ?? '').trim();
      if (!str) return;
      attributes[String(key)] = str;
    });
  }

  if (looseFragments.length > 0) {
    looseFragments.forEach((fragment, index) => {
      const fallbackKey = `Option ${index + 1}`;
      if (!attributes[fallbackKey]) {
        attributes[fallbackKey] = fragment;
      }
    });
  }

  if (Object.keys(attributes).length === 0) {
    const fallbackLabel = String(variant?.variantNameEn || variant?.name || variant?.title || '').trim();
    if (fallbackLabel) {
      attributes['Variant'] = fallbackLabel;
    }
  }

  return attributes;
};

const normalizeLegacyVariantRow = (productId: string, raw: any, index: number): ProductVariant => {
  const cjVariantId = String(raw?.cj_variant_id ?? raw?.vid ?? raw?.variantId ?? raw?.variant_id ?? '').trim() || null;
  const sku =
    String(raw?.sku ?? raw?.variantSku ?? raw?.variant_sku ?? '').trim() ||
    (cjVariantId ? `CJ-${cjVariantId}` : `LEGACY-${index + 1}`);
  const rawPrice =
    parseLooseNumber(raw?.price) ??
    parseLooseNumber(raw?.variantSellPrice) ??
    parseLooseNumber(raw?.variantPrice) ??
    parseLooseNumber(raw?.sellPrice) ??
    null;
  const rawInventory = parseLooseNumber(raw?.inventory) ?? parseLooseNumber(raw?.variantStock) ?? parseLooseNumber(raw?.stock) ?? null;
  const attributes = parseLegacyVariantAttributes(raw);

  // Prefer a uuid `id` if present; otherwise use the CJ variant id / sku for UI selection.
  const idCandidate = String(raw?.id ?? '').trim();
  const id = looksLikeUuid(idCandidate) ? idCandidate : String(cjVariantId || sku);

  return {
    id,
    product_id: productId,
    provider: String(raw?.provider || (cjVariantId ? 'CJ' : 'LEGACY')),
    cj_product_id: String(raw?.cj_product_id ?? raw?.cjProductId ?? raw?.pid ?? productId),
    cj_variant_id: String(cjVariantId || ''),
    sku,
    price: rawPrice ?? 0,
    compare_at_price: parseLooseNumber(raw?.compare_at_price) ?? parseLooseNumber(raw?.compareAtPrice) ?? null,
    currency: String(raw?.currency || 'USD'),
    image_url: String(raw?.image_url ?? raw?.variantImage ?? raw?.image ?? '').trim() || null,
    attributes,
    inventory: rawInventory !== null ? Math.max(0, Math.floor(rawInventory)) : null,
    is_active: raw?.is_active === false ? false : true,
    created_at: String(raw?.created_at || new Date().toISOString()),
    updated_at: String(raw?.updated_at || new Date().toISOString()),
  } as unknown as ProductVariant;
};

const normalizeAttributesForMatch = (attributes: Record<string, string> | null | undefined) => {
  if (!attributes) return {};
  return Object.entries(attributes).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof key !== 'string' || typeof value !== 'string') return acc;
    acc[key.toLowerCase()] = value.toLowerCase();
    return acc;
  }, {});
};

export const getVariantOptions = async (productId: string): Promise<ProductVariant[]> => {
  if (!isSupabaseConfigured) return [];

  const queryNormalized = async (filterActive: boolean) => {
    let query = supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (filterActive) {
      query = query.eq('is_active', true);
    }

    return query;
  };

  // 1) Preferred: normalized `product_variants`
  try {
    const { data, error } = await queryNormalized(true);
    if (!error && Array.isArray(data) && data.length > 0) {
      return data as ProductVariant[];
    }

    // Some environments may not have `is_active` yet; retry without it.
    const message = String((error as any)?.message || '');
    if (error && /is_active/i.test(message)) {
      const retry = await queryNormalized(false);
      if (!retry.error && Array.isArray(retry.data) && retry.data.length > 0) {
        return retry.data as ProductVariant[];
      }
    }

    // If RLS blocks reads (common on public product pages), use server-side Netlify function fallback.
    if (error) {
      const m = String((error as any)?.message || '').toLowerCase();
      const likelyRls =
        m.includes('permission denied') ||
        m.includes('row-level security') ||
        m.includes('rls') ||
        m.includes('not allowed');

      if (likelyRls) {
        const response = await fetch(`/.netlify/functions/product-variants-public?productId=${encodeURIComponent(productId)}`);
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray((payload as any)?.variants)) {
          return (payload as any).variants as ProductVariant[];
        }
      }
    }
  } catch (error) {
    console.warn('getVariantOptions: normalized query failed', error);
  }

  // 2) Fallback: legacy `products.variants` JSONB (CJ raw variants or older variant formats).
  try {
    const { data, error } = await supabase
      .from('products')
      .select('variants')
      .eq('id', productId)
      .maybeSingle();

    if (error) {
      console.warn('getVariantOptions: legacy variants fetch failed', error);
      return [];
    }

    const rawVariants = (data as any)?.variants;
    if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
      return [];
    }

    return rawVariants.map((variant: any, index: number) => normalizeLegacyVariantRow(productId, variant, index));
  } catch (error) {
    console.warn('getVariantOptions: legacy fallback failed', error);
    return [];
  }
};

export const resolveVariant = (
  variants: ProductVariant[],
  selectedAttributes: Record<string, string>
): ProductVariant | null => {
  if (!variants?.length) return null;
  const normalizedSelection = Object.entries(selectedAttributes).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (!key || !value) return acc;
      acc[key.toLowerCase()] = value.toLowerCase();
      return acc;
    },
    {}
  );

  if (!Object.keys(normalizedSelection).length) {
    return variants[0] ?? null;
  }

  const matches = variants.filter((variant) => {
    const normalizedVariantAttributes = normalizeAttributesForMatch(variant.attributes);
    return Object.entries(normalizedSelection).every(([key, value]) => {
      const candidate = normalizedVariantAttributes[key];
      return candidate && candidate === value;
    });
  });

  return matches[0] ?? variants[0];
};
