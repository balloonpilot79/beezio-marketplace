import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import type { SampleProduct } from '../data/sampleProducts';

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

const mapProductRowToMarketplaceProduct = (row: ProductRowWithJoins): MarketplaceProduct | null => {
  if (!row.id || !row.title) {
    return null;
  }

  return {
    id: row.id,
    name: row.title,
    price: row.price ?? 0,
    image: row.images?.[0] || PLACEHOLDER_IMAGE,
    images: row.images ?? undefined,
    rating: 4.8,
    category: row.categories?.name ?? 'Marketplace',
    description: row.description ?? '',
    seller: row.profiles?.full_name ?? 'Marketplace Seller',
    sellerId: row.seller_id ?? undefined,
    reviews: row.views_count ?? 0,
    commission_rate: row.commission_rate ?? 0,
    commission_type: row.commission_type ?? 'percentage',
    flat_commission_amount: row.flat_commission_amount ?? 0,
    shipping_cost: row.shipping_cost ?? 0,
    stock_quantity: row.stock_quantity ?? undefined,
    created_at: row.created_at ?? new Date().toISOString()
  };
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
