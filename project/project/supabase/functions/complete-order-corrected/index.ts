import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CartItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  sellerId: string;
  sellerDesiredAmount: number;
  commissionRate: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
  affiliateCommissionType?: 'percentage' | 'flat_rate';
  variantId?: string;
  variantName?: string;
}

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const REFERRER_BONUS_THRESHOLD = 20;
const REFERRER_BONUS_UNDER_THRESHOLD = 0.5;
const REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
const INFLUENCER_SLOT_COUNT = 2;
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.30;
const PLATFORM_PERCENT = 0.15;

const referrerBonusPerUnit = (finalAdvertisedPrice: number) =>
  finalAdvertisedPrice < REFERRER_BONUS_THRESHOLD ? REFERRER_BONUS_UNDER_THRESHOLD : REFERRER_BONUS_AT_OR_ABOVE_THRESHOLD;

const getReserve = (price: number, qty: number) => round2(referrerBonusPerUnit(price) * INFLUENCER_SLOT_COUNT * qty);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { orderId, paymentIntentId, items = [], billingDetails = {}, totalPaid, tax = 0, shippingAmount = 0 } = body;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);

    const subtotal = round2(items.reduce((sum: number, item: CartItem) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0));
    const normalizedTax = round2(Number(tax || 0));
    const normalizedShipping = round2(Number(shippingAmount || 0));
    const normalizedTotal = round2(Number(totalPaid ?? subtotal + normalizedTax + normalizedShipping));

    let totalSellerPayouts = 0;
    let totalAffiliatePayouts = 0;
    let totalReferralPayouts = 0;
    let totalBeezioProfit = 0;
    let totalInfluencerReserve = 0;
    let totalUnusedInfluencerProfit = 0;
    let totalPaymentFees = 0;
    const distributions: any[] = [];
    const recruiterCache = new Map<string, string | null>();

    for (const item of items as CartItem[]) {
      const price = Number(item.price || 0);
      const qty = Math.max(0, Math.floor(Number(item.quantity || 0)));
      const sellerAmount = round2(Number(item.sellerDesiredAmount || 0) * qty);
      const affiliateAmount = item.affiliateCommissionType === 'flat_rate'
        ? round2(Number(item.affiliateCommissionRate || 0) * qty)
        : round2(sellerAmount * Math.max(0, Number(item.affiliateCommissionRate || 0)) / 100);

      let affiliateId: string | null = null;
      let affiliateReferredById: string | null = null;
      if (item.affiliateId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, referred_by_affiliate_id')
          .or(`id.eq.${item.affiliateId},referral_code.ilike.${item.affiliateId}`)
          .maybeSingle();
        affiliateId = data?.id ?? null;
        affiliateReferredById = data?.referred_by_affiliate_id ?? null;
      }

      const saleOwnerId = affiliateId ?? item.sellerId ?? null;
      let sellerRecruiterId: string | null = null;
      if (item.sellerId) {
        if (!recruiterCache.has(item.sellerId)) {
          const { data } = await supabase.from('profiles').select('referred_by_affiliate_id').eq('id', item.sellerId).maybeSingle();
          recruiterCache.set(item.sellerId, data?.referred_by_affiliate_id ?? null);
        }
        sellerRecruiterId = recruiterCache.get(item.sellerId) ?? null;
      }

      // Both seller and affiliate referrals are lifetime referral relationships.
      // A qualifying sale can therefore pay one recruiter for the seller and one
      // recruiter for the affiliate. Each occupies one of the two baked-in slots.
      const recruiterIds: string[] = [];
      if (sellerRecruiterId) recruiterIds.push(sellerRecruiterId);
      if (affiliateReferredById && affiliateReferredById !== sellerRecruiterId) recruiterIds.push(affiliateReferredById);
      const assignedInfluencerCount = Math.min(INFLUENCER_SLOT_COUNT, recruiterIds.length);
      const reserve = getReserve(price, qty);
      const assignedReferralAmount = round2(referrerBonusPerUnit(price) * assignedInfluencerCount * qty);
      const unusedInfluencerProfit = round2(reserve - assignedReferralAmount);

      // The customer price contains the two potential influencer slots. Unused
      // slots are retained by Beezio as profit; they are not paid out or treated
      // as an owed liability.
      const paymentFee = round2(price * STRIPE_PERCENT * qty + STRIPE_FIXED * qty);
      const sellerAndAffiliate = round2(sellerAmount + affiliateAmount);
      const minimumBeezioProfit = price < 25 ? 2 : 0;
      const baseBeezioAfterPayouts = round2(price * qty - sellerAndAffiliate - assignedReferralAmount - paymentFee);
      const beezioProfit = round2(Math.max(baseBeezioAfterPayouts, minimumBeezioProfit * qty));

      totalSellerPayouts += sellerAmount;
      totalAffiliatePayouts += affiliateAmount;
      totalReferralPayouts += assignedReferralAmount;
      totalBeezioProfit += beezioProfit;
      totalInfluencerReserve += reserve;
      totalUnusedInfluencerProfit += unusedInfluencerProfit;
      totalPaymentFees += paymentFee;

      distributions.push({
        item,
        affiliateId,
        saleOwnerId,
        recruiterIds,
        sellerAmount,
        affiliateAmount,
        referralAmount: assignedReferralAmount,
        influencerReserve: reserve,
        unusedInfluencerProfit,
        paymentFee,
        beezioProfit,
      });
    }

    // Inventory is decremented before the order is finalized. Database RPCs are
    // authoritative and prevent overselling.
    for (const item of items as CartItem[]) {
      const qty = Math.max(0, Math.floor(Number(item.quantity || 0)));
      if (!qty) continue;
      if (item.variantId) {
        const { data, error } = await supabase.rpc('decrement_variant_inventory', { p_variant_id: item.variantId, p_quantity: qty });
        if (error || !Array.isArray(data) || data.length === 0) throw new Error(`OUT_OF_STOCK:${item.variantId}`);
      } else {
        const { data, error } = await supabase.rpc('decrement_product_stock', { p_product_id: item.productId, p_quantity: qty });
        if (error || !Array.isArray(data) || data.length === 0) throw new Error(`OUT_OF_STOCK:${item.productId}`);
      }
    }

    const { error: orderError } = await supabase.from('orders').update({
      status: 'completed',
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      billing_name: billingDetails.name ?? null,
      billing_email: billingDetails.email ?? null,
      subtotal_amount: subtotal,
      tax_amount: normalizedTax,
      shipping_amount: normalizedShipping,
      total_amount: normalizedTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    if (orderError) throw orderError;

    for (const detail of distributions) {
      const item = detail.item as CartItem;
      const { error } = await supabase.from('order_items').insert({
        order_id: orderId,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        seller_id: item.sellerId,
        affiliate_id: detail.affiliateId,
        affiliate_referrer_id: detail.recruiterIds[1] ?? detail.recruiterIds[0] ?? null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: round2(item.price * item.quantity),
        seller_desired_amount: item.sellerDesiredAmount,
        seller_payout: detail.sellerAmount,
        affiliate_commission: detail.affiliateAmount,
        referral_bonus: detail.referralAmount,
        beezio_gross: round2(detail.beezioProfit + detail.referralAmount),
        beezio_net: detail.beezioProfit,
        platform_fee: round2(detail.beezioProfit + detail.referralAmount),
        stripe_fee: detail.paymentFee,
        commission_rate: item.commissionRate,
        affiliate_commission_rate: item.affiliateCommissionRate || 0,
        tax_amount: items.length ? round2(normalizedTax / items.length) : 0,
      });
      if (error) console.error('order_items insert failed', error);

      if (detail.affiliateId && detail.affiliateAmount > 0) {
        await supabase.from('commissions').insert({
          affiliate_id: detail.affiliateId,
          product_id: item.productId,
          order_id: orderId,
          commission_rate: item.affiliateCommissionRate || 0,
          commission_amount: detail.affiliateAmount,
          status: 'pending',
        });
      }

      for (const recruiterId of detail.recruiterIds) {
        await supabase.from('recruiter_earnings').insert({
          recruiter_id: recruiterId,
          recruit_id: detail.saleOwnerId,
          order_id: orderId,
          amount: round2(referrerBonusPerUnit(item.price) * Number(item.quantity || 0)),
          status: 'pending',
        });
      }

      await supabase.from('payment_distributions').insert({
        order_id: orderId,
        recipient_type: 'seller',
        recipient_id: item.sellerId,
        amount: detail.sellerAmount,
        percentage: 100,
        status: 'pending',
      });
      if (detail.affiliateId && detail.affiliateAmount > 0) {
        await supabase.from('payment_distributions').insert({
          order_id: orderId,
          recipient_type: 'affiliate',
          recipient_id: detail.affiliateId,
          amount: detail.affiliateAmount,
          percentage: 0,
          status: 'pending',
        });
      }
      for (const recruiterId of detail.recruiterIds) {
        await supabase.from('payment_distributions').insert({
          order_id: orderId,
          recipient_type: 'influencer',
          recipient_id: recruiterId,
          amount: round2(referrerBonusPerUnit(item.price) * Number(item.quantity || 0)),
          percentage: 0,
          status: 'pending',
        });
      }
    }

    await supabase.from('payment_distributions').insert({
      order_id: orderId,
      recipient_type: 'platform',
      recipient_id: null,
      amount: totalBeezioProfit,
      percentage: 0,
      status: 'pending',
    });

    return new Response(JSON.stringify({
      success: true,
      orderId,
      distribution: {
        totalSellerPayouts: round2(totalSellerPayouts),
        totalAffiliatePayouts: round2(totalAffiliatePayouts),
        totalReferralPayouts: round2(totalReferralPayouts),
        totalInfluencerReserve: round2(totalInfluencerReserve),
        totalUnusedInfluencerProfit: round2(totalUnusedInfluencerProfit),
        totalBeezioProfit: round2(totalBeezioProfit),
        totalPaymentFees: round2(totalPaymentFees),
        totalPaid: normalizedTotal,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('Complete order error', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to complete order' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
});
