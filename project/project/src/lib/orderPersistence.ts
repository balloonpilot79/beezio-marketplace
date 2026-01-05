import { supabase } from './supabase';
import { computePayoutBreakdown } from '../utils/pricingEngine';
import { PLATFORM_FEE_PERCENT } from '../config/beezioConfig';

interface OrderLineInput {
  productId: string;
  title: string;
  sellerId: string;
  sellerName: string;
  quantity: number;
  salePrice: number; // final customer-facing price per unit
  sellerAsk: number;
  affiliateRate: number;
  payout: ReturnType<typeof computePayoutBreakdown>;
  shippingCost?: number;
}

interface OrderPersistenceParams {
  userId: string;
  storefrontId?: string | null;
  affiliateId?: string | null;
  referralAffiliateId?: string | null;
  fundraiserId?: string | null;
  summary: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  };
  lines: OrderLineInput[];
}

// Writes order and order_items to Supabase.
// NOTE: Payout/ledger rows are written server-side (Edge Functions + webhooks) and are not inserted from the client.
export async function recordOrderWithPayouts(params: OrderPersistenceParams) {
  const {
    userId,
    storefrontId = null,
    affiliateId = null,
    referralAffiliateId = null,
    fundraiserId = null,
    summary,
    lines,
  } = params;

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: userId,
      storefront_id: storefrontId,
      affiliate_id: affiliateId,
      subtotal_amount: summary.subtotal,
      shipping_amount: summary.shipping,
      tax_amount: summary.tax,
      total_amount: summary.total,
      platform_percent_at_purchase: PLATFORM_FEE_PERCENT,
      fundraiser_percent_at_purchase: lines[0]?.payout?.fundraiserAmount ? (lines[0].payout.fundraiserAmount / lines[0].salePrice) * 100 : 0,
      affiliate_commission_percent_at_purchase: lines[0]?.affiliateRate ?? null,
      status: 'paid',
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Failed to create order');
  }

  // Insert order_items
  const orderItems = lines.map((line) => ({
    order_id: order.id,
    product_id: line.productId,
    quantity: line.quantity,
    final_sale_price_per_unit: line.salePrice,
    seller_ask_price_per_unit: line.sellerAsk,
    affiliate_commission_percent_at_purchase: line.affiliateRate,
    platform_percent_at_purchase: PLATFORM_FEE_PERCENT,
    fundraiser_percent_at_purchase: line.payout.fundraiserAmount ? (line.payout.fundraiserAmount / line.salePrice) * 100 : 0,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return order;
}
