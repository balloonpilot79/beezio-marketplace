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

// Writes order, order_items, and payout rows to Supabase.
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

  const { data: authUser } = await supabase.auth.getUser();

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      buyer_id: userId,
      storefront_id: storefrontId,
      affiliate_id: affiliateId,
      items_subtotal: summary.subtotal,
      shipping_amount: summary.shipping,
      tax_amount: summary.tax,
      total_amount: summary.total,
      total_charged: summary.total,
      subtotal_listing: summary.subtotal,
      customer_email: authUser.user?.email || null,
      payment_provider: 'PAYPAL',
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

  // Write the canonical held payout ledger. The 14-day hold is released by the
  // PayPal payout job after delivery/return protection has cleared.
  const payoutRows: any[] = [];
  lines.forEach((line) => {
    const qty = line.quantity;
    const p = line.payout;

    payoutRows.push({
      order_id: order.id,
      seller_id: line.sellerId,
      partner_id: affiliateId,
      influencer_id: referralAffiliateId,
      gross_amount: line.salePrice * qty,
      seller_earnings: p.sellerAmount * qty,
      partner_earnings: p.affiliateAmount * qty,
      influencer_earnings: p.referralAffiliateAmount * qty,
      beezio_fee: p.beezioNetAmount * qty,
      paypal_fee_estimate: (p.stripePercentAmount + p.stripeFixedFee) * qty,
      hold_release_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'PENDING_HOLD',
      notes: `Order ${order.id} / ${line.title}`,
    });
  });

  const { error: payoutsError } = await supabase.from('payout_ledger').insert(payoutRows);
  if (payoutsError) {
    throw new Error(payoutsError.message);
  }

  return order;
}

