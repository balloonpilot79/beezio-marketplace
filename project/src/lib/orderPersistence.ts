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

  // Insert payouts per line
  const payoutRows: any[] = [];
  lines.forEach((line) => {
    const qty = line.quantity;
    const p = line.payout;

    payoutRows.push({
      order_id: order.id,
      beneficiary_id: line.sellerId,
      role: 'seller',
      amount: p.sellerAmount * qty,
      description: `Seller payout for ${line.title}`,
    });

    if (affiliateId) {
      payoutRows.push({
        order_id: order.id,
        beneficiary_id: affiliateId,
        role: 'affiliate',
        amount: p.affiliateAmount * qty,
        description: `Affiliate commission for ${line.title}`,
      });
    }

    if (referralAffiliateId) {
      payoutRows.push({
        order_id: order.id,
        beneficiary_id: referralAffiliateId,
        role: 'referral_affiliate',
        amount: p.referralAffiliateAmount * qty,
        description: `Referral override for ${line.title}`,
      });
    }

    if (fundraiserId && p.fundraiserAmount > 0) {
      payoutRows.push({
        order_id: order.id,
        beneficiary_id: fundraiserId,
        role: 'fundraiser',
        amount: p.fundraiserAmount * qty,
        description: `Fundraiser share for ${line.title}`,
      });
    }

    payoutRows.push({
      order_id: order.id,
      beneficiary_id: null,
      role: 'beezio',
      amount: p.beezioNetAmount * qty,
      description: `Beezio platform share for ${line.title}`,
    });

    payoutRows.push({
      order_id: order.id,
      beneficiary_id: null,
      role: 'stripe',
      amount: (p.stripePercentAmount + p.stripeFixedFee) * qty,
      description: `Stripe fee for ${line.title}`,
    });
  });

  const { error: payoutsError } = await supabase.from('payouts').insert(payoutRows);
  if (payoutsError) {
    throw new Error(payoutsError.message);
  }

  return order;
}
