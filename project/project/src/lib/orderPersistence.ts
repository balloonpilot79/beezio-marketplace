import { supabase } from './supabase';
import { computePayoutBreakdown } from '../utils/pricingEngine';
import { PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { createBeezioOrderNumber } from '../../shared/orderNumber';

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
    summary,
    lines,
  } = params;

  const { data: authUser } = await supabase.auth.getUser();

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: createBeezioOrderNumber(),
      user_id: userId,
      buyer_id: userId,
      storefront_id: storefrontId,
      affiliate_id: affiliateId,
      subtotal_amount: summary.subtotal,
      shipping_amount: summary.shipping,
      tax_amount: summary.tax,
      total_amount: summary.total,
      items_subtotal: summary.subtotal,
      total_charged: summary.total,
      subtotal_listing: summary.subtotal,
      customer_email: authUser.user?.email || null,
      payment_provider: 'PAYPAL',
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
    seller_id: line.sellerId,
    affiliate_id: affiliateId,
    quantity: line.quantity,
    price: line.salePrice,
    unit_price: line.salePrice,
    total_price: line.salePrice * line.quantity,
    commission_rate: line.affiliateRate,
    affiliate_commission_rate: line.affiliateRate,
    shipping_cost: line.shippingCost || 0,
    seller_ask_amount: line.sellerAsk,
    partner_rate: line.affiliateRate,
    computed_listing_price: line.salePrice,
    product_title_snapshot: line.title,
    fulfillment_status: 'unfulfilled',
    seller_markup_amount: 0,
    supplier_cost_amount: 0,
    affiliate_payout_amount: line.payout.affiliateAmount,
    shipping_reserve_amount: line.shippingCost || 0,
    influencer_allocation_amount: 0,
    platform_fee_amount: line.payout.platformGrossAmount,
    paypal_processing_allowance: line.payout.stripePercentAmount + line.payout.stripeFixedFee,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return order;
}

