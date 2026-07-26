import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { computeFixedTierPricing } from '../../shared/customerPrice';

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

async function getAuthedUser(params: { supabaseUrl: string; anonKey: string; authHeader: string }) {
  const supabaseAuthed = createClient(params.supabaseUrl, params.anonKey, {
    global: { headers: { Authorization: params.authHeader } },
  });
  const { data, error } = await supabaseAuthed.auth.getUser();
  if (error || !data?.user) return { user: null, error: error?.message || 'Unauthorized' };
  return { user: data.user, error: null };
}

type CreateProductBody = {
  title: string;
  description?: string | null;
  sku?: string | null;
  price: number;
  stock_quantity?: number;
  images?: string[];
  category_id?: string | null;
  affiliate_enabled?: boolean;
  supplier_cost_amount?: number;
  seller_markup_amount?: number;
  seller_payout_amount?: number;
  affiliate_payout_amount?: number;
  shipping_reserve_amount?: number;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = requireEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser({ supabaseUrl, anonKey, authHeader });
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });
    const emailConfirmedAt = String((user as any)?.email_confirmed_at || (user as any)?.confirmed_at || '').trim();
    if (!String((user as any)?.email || '').trim() || !emailConfirmedAt) {
      return json(403, { error: 'Confirm your email before creating products.', code: 'EMAIL_NOT_VERIFIED' });
    }

    const payload = (event.body ? JSON.parse(event.body) : {}) as Partial<CreateProductBody>;
    const title = String(payload.title || '').trim();
    const submittedPrice = Number(payload.price);
    if (!title) return json(400, { error: 'Missing title' });
    const supplierCost = Math.max(0, Number(payload.supplier_cost_amount || 0));
    const sellerMarkup = Math.max(0, Number(payload.seller_markup_amount || 0));
    const explicitSellerPayout = Number(payload.seller_payout_amount);
    const sellerPayout = Number.isFinite(explicitSellerPayout) && explicitSellerPayout > 0
      ? explicitSellerPayout
      : supplierCost + sellerMarkup > 0
        ? supplierCost + sellerMarkup
        : submittedPrice;
    const affiliatePayout = Math.max(0, Number(payload.affiliate_payout_amount || 0));
    const shippingReserve = Math.max(0, Number(payload.shipping_reserve_amount || 0));
    if (!Number.isFinite(sellerPayout) || sellerPayout <= 0) {
      return json(400, { error: 'Enter a valid supplier cost and seller markup/profit.' });
    }
    const pricing = computeFixedTierPricing({
      supplierCost,
      sellerMarkup: supplierCost + sellerMarkup > 0 ? sellerMarkup : sellerPayout,
      sellerPayout,
      affiliatePayout,
      shippingIncluded: shippingReserve,
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(10);
    if (profileError) return json(500, { error: 'Failed to load profile', details: profileError.message });

    const rows = Array.isArray(profileRows) ? profileRows : (profileRows ? [profileRows] : []);
    const matched =
      rows.find((r: any) => String(r?.user_id || '') === String(user.id)) ||
      rows.find((r: any) => String(r?.id || '') === String(user.id)) ||
      rows[0];
    const sellerProfileId = matched?.id ? String(matched.id) : null;
    if (!sellerProfileId) return json(400, { error: 'Missing profile for user' });

    const insertPayload: any = {
      title,
      description: payload.description ? String(payload.description) : null,
      sku: payload.sku ? String(payload.sku) : null,
      price: pricing.finalAdvertisedPrice,
      calculated_customer_price: pricing.finalAdvertisedPrice,
      seller_amount: pricing.sellerPayout,
      seller_ask: pricing.sellerPayout,
      seller_ask_price: pricing.sellerPayout,
      supplier_cost_amount: pricing.supplierCost,
      seller_markup_amount: pricing.sellerMarkup,
      affiliate_payout_amount: pricing.affiliatePayout,
      shipping_reserve_amount: pricing.shippingIncluded,
      influencer_allocation_amount: pricing.influencerAllocation,
      platform_fee: pricing.platformFee,
      paypal_processing_allowance: pricing.paypalProcessingAllowance,
      stock_quantity: Math.max(0, Math.floor(Number(payload.stock_quantity ?? 1))),
      images: Array.isArray(payload.images) ? payload.images.map(String).filter(Boolean) : [],
      category_id: payload.category_id ? String(payload.category_id) : null,
      seller_id: sellerProfileId,
      affiliate_enabled: Boolean(payload.affiliate_enabled ?? true),
      status: (payload.affiliate_enabled ?? true) ? 'active' : 'store_only',
      is_promotable: Boolean(payload.affiliate_enabled ?? true),
      is_active: true,
      commission_rate: 0,
      affiliate_commission_rate: 0,
      commission_type: 'flat_rate',
      affiliate_commission_type: 'flat',
      affiliate_commission_value: pricing.affiliatePayout,
      flat_commission_amount: pricing.affiliatePayout,
      requires_shipping: true,
      shipping_price: pricing.shippingIncluded,
      shipping_cost: pricing.shippingIncluded,
      shipping_options: [{
        name: 'Free Shipping',
        cost: 0,
        estimated_days: '3-5 business days',
        included_in_price: true,
        seller_shipping_cost: pricing.shippingIncluded,
      }],
    };

    // Some schemas include extra financial columns; leave them null/omitted to avoid schema mismatch.
    const { data: created, error: createError } = await supabaseAdmin
      .from('products')
      .insert(insertPayload)
      .select('id')
      .single();

    if (createError || !created?.id) {
      return json(500, { error: createError?.message || 'Failed to create product' });
    }

    return json(200, { id: String((created as any).id) });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};
