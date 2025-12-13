import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import type { SampleProduct } from '../data/sampleProducts';
import { buildPricedProduct } from '../utils/pricing';

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
    rating: 4.8,
    category: row.categories?.name ?? 'Marketplace',
    description: row.description ?? '',
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

const baseSelect = `*, profiles:seller_id ( full_name ), categories:category_id ( name )`;

export const fetchMarketplaceProducts = async (limit?: number): Promise<MarketplaceProduct[]> => {
  if (!isSupabaseConfigured) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(baseSelect)
    .eq('is_active', true)
    .eq('affiliate_enabled', true) // Only show products opted-in for affiliate marketing
    .order('created_at', { ascending: false });

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('fetchMarketplaceProducts: Supabase error', error);
    throw error;
  }

  return (data ?? [])
    .map(mapProductRowToMarketplaceProduct)
    .filter((product): product is MarketplaceProduct => Boolean(product));
};

export const fetchProductById = async (productId: string): Promise<MarketplaceProduct | null> => {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .select(baseSelect)
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    console.error('fetchProductById: Supabase error', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapProductRowToMarketplaceProduct(data as ProductRowWithJoins);
};
