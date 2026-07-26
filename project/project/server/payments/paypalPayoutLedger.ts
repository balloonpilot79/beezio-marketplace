import { getInfluencerReserveTotal, getReferrerBonusTotal } from '../../shared/referralBonus';
import {
  computeFixedBeezioPlatformFee,
} from '../../shared/beezioFee';
import {
  isTestItemTitle,
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
} from '../../shared/testItemPricing';

export type PayeeRole = 'SELLER' | 'PARTNER' | 'INFLUENCER';
export type LedgerStatus = 'PENDING_HOLD' | 'READY_TO_PAY' | 'PAID' | 'ON_HOLD_DISPUTE' | 'CANCELED';
export type PayPalOrderItemForLedger = {
  id?: string | null;
  quantity: number;
  seller_ask_amount: number;
  partner_rate: number;
  computed_listing_price: number;
  supplier_cost_amount?: number;
  seller_markup_amount?: number;
  affiliate_payout_amount?: number;
  shipping_reserve_amount?: number;
  influencer_allocation_amount?: number;
  platform_fee_amount?: number;
  paypal_processing_allowance?: number;
  product_title?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
};

export type BuildPayPalLedgerPlanInput = {
  orderId: string;
  orderNumber?: string | null;
  currency: string;
  providerOrderId: string;
  providerCaptureId: string | null;
  paidAt: string;
  holdReleaseAt: string;
  sellerId: string | null;
  partnerId: string | null;
  sellerInfluencerId?: string | null;
  partnerInfluencerId?: string | null;
  subtotalListing?: number;
  shippingAmount?: number;
  taxAmount?: number;
  items: PayPalOrderItemForLedger[];
  platformRate?: number;
  platformFeeMin?: number;
  platformFeeCap?: number;
  largeOrderThreshold?: number;
  largeOrderFlatFee?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  paypalFeeAmount?: number | null;
};

export type PayeeSnapshotPlan = {
  payeeUserId: string;
  payeeRole: PayeeRole;
  amount: number;
  currency: string;
  status: LedgerStatus;
  holdReleaseAt: string | null;
  providerOrderId: string;
  providerCaptureId: string | null;
  snapshot: Record<string, unknown>;
};

export type MoneyLedgerEntryType =
  | 'seller'
  | 'affiliate'
  | 'influencer'
  | 'beezio'
  | 'tax'
  | 'shipping'
  | 'processor_fee';

export type MoneyLedgerEntryPlan = {
  sourceKey: string;
  orderId: string;
  orderItemId: string | null;
  payeeType: MoneyLedgerEntryType;
  payeeId: string | null;
  currency: string;
  grossAmount: number;
  netAmount: number;
  status: 'held' | 'tracked';
  holdUntil: string | null;
  provider: 'paypal';
  providerOrderId: string;
  providerCaptureId: string | null;
  metadata: Record<string, unknown>;
};

export type AggregateLedgerPlan = {
  orderId: string;
  sellerId: string | null;
  partnerId: string | null;
  influencerId: string | null;
  grossAmount: number;
  sellerEarnings: number;
  partnerEarnings: number;
  influencerEarnings: number;
  beezioFeeGross: number;
  beezioFeeNet: number;
  beezioProfit: number;
  paypalFeeEstimate: number;
  status: LedgerStatus;
  holdReleaseAt: string;
  notes: string;
};

export type PayPalLedgerPlan = {
  aggregate: AggregateLedgerPlan;
  payees: PayeeSnapshotPlan[];
  moneyEntries: MoneyLedgerEntryPlan[];
};

export type PayoutSnapshotLike = {
  payee_user_id?: string | null;
  payee_role?: PayeeRole | null;
  amount?: number | null;
  status?: LedgerStatus | string | null;
  hold_release_at?: string | null;
  paid_at?: string | null;
};

export type PayoutSummary = {
  pending: number;
  onHold: number;
  available: number;
  paid: number;
  nextReleaseAt: string | null;
  total: number;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function buildPayPalLedgerPlan(input: BuildPayPalLedgerPlanInput): PayPalLedgerPlan {
  const items = Array.isArray(input.items) ? input.items : [];
  const paypalPercent = Math.max(0, Number(input.paypalPercent ?? 0.0399) || 0.0399);
  const paypalFixed = Math.max(0, Number(input.paypalFixed ?? 0.6) || 0.6);
  let askTotal = 0;
  let shippingReserveTotal = 0;
  let listingSubtotal = 0;
  let partnerTotal = 0;
  let platformFeeGrossTotal = 0;
  let influencerBonusPoolPerSlot = 0;
  let paypalAllowanceTotal = 0;

  const lineSnapshots = items.map((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 0) || 1));
    const ask = round2(Math.max(0, Number(item.seller_ask_amount || 0)));
    const listingUnit = round2(Math.max(0, Number(item.computed_listing_price || 0)));
    const partnerRate = Math.max(0, Number(item.partner_rate || 0));
    const title = String(item.product_title || '').trim();
    const isTestItem = isTestItemTitle(title);
    const shippingReserveUnit = round2(Math.max(0, Number(item.shipping_reserve_amount || 0)));
    const explicitAffiliatePayout = Number(item.affiliate_payout_amount);
    const explicitPlatformFee = Number(item.platform_fee_amount);
    const explicitPayPalAllowance = Number(item.paypal_processing_allowance);
    const explicitInfluencerAllocation = Number(item.influencer_allocation_amount);

    const sellerProductLine = round2(ask * quantity);
    const shippingReserveLine = round2(shippingReserveUnit * quantity);
    const sellerLine = round2(sellerProductLine + shippingReserveLine);
    const partnerLine = round2(
      (Number.isFinite(explicitAffiliatePayout)
        ? Math.max(0, explicitAffiliatePayout)
        : ask * partnerRate) * quantity
    );
    const beezioFeeGrossLine = round2(
      isTestItem
        ? TEST_ITEM_BEEZIO_FEE * quantity
        : (Number.isFinite(explicitPlatformFee)
            ? Math.max(0, explicitPlatformFee) * quantity
            : computeFixedBeezioPlatformFee(listingUnit) * quantity)
    );
    const influencerPerSlotLine = round2(
      isTestItem
        ? TEST_ITEM_INFLUENCER_FEE * quantity
        : (Number.isFinite(explicitInfluencerAllocation)
            ? Math.max(0, explicitInfluencerAllocation) * quantity / 2
            : getReferrerBonusTotal(listingUnit, quantity))
    );
    const paypalAllowanceLine = round2(
      (Number.isFinite(explicitPayPalAllowance)
        ? Math.max(0, explicitPayPalAllowance)
        : listingUnit * paypalPercent + paypalFixed) * quantity
    );
    askTotal = round2(askTotal + sellerProductLine);
    shippingReserveTotal = round2(shippingReserveTotal + shippingReserveLine);
    listingSubtotal = round2(listingSubtotal + listingUnit * quantity);
    partnerTotal = round2(partnerTotal + partnerLine);
    platformFeeGrossTotal = round2(platformFeeGrossTotal + beezioFeeGrossLine);
    influencerBonusPoolPerSlot = round2(influencerBonusPoolPerSlot + influencerPerSlotLine);
    paypalAllowanceTotal = round2(paypalAllowanceTotal + paypalAllowanceLine);

    return {
      order_item_id: item.id || null,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      product_title: title || null,
      quantity,
      seller_ask_amount: ask,
      supplier_cost_amount: round2(Math.max(0, Number(item.supplier_cost_amount || 0))),
      seller_markup_amount: round2(Math.max(0, Number(item.seller_markup_amount || 0))),
      shipping_reserve_amount: shippingReserveUnit,
      computed_listing_price: listingUnit,
      seller_product_line_total: sellerProductLine,
      shipping_reserve_line_total: shippingReserveLine,
      seller_line_total: sellerLine,
      partner_line_total: partnerLine,
      beezio_fee_gross_line_total: beezioFeeGrossLine,
      paypal_processing_allowance_line_total: paypalAllowanceLine,
      influencer_bonus_per_slot_line_total: influencerPerSlotLine,
      influencer_bonus_line_total: isTestItem
        ? round2(TEST_ITEM_INFLUENCER_FEE * quantity * 2)
        : getInfluencerReserveTotal(listingUnit, quantity),
    };
  });

  if (!listingSubtotal && Number.isFinite(Number(input.subtotalListing))) {
    listingSubtotal = round2(Number(input.subtotalListing));
  }

  const sellerInfluencerId = String(input.sellerInfluencerId || '').trim() || null;
  const partnerInfluencerId = String(input.partnerInfluencerId || '').trim() || null;
  const sellerInfluencerEligible = Boolean(input.sellerId) && Boolean(sellerInfluencerId);
  const partnerInfluencerEligible = Boolean(input.partnerId) && Boolean(partnerInfluencerId);
  const sellerInfluencerTotal = sellerInfluencerEligible ? influencerBonusPoolPerSlot : 0;
  const partnerInfluencerTotal = partnerInfluencerEligible ? influencerBonusPoolPerSlot : 0;
  const influencerTotal = round2(sellerInfluencerTotal + partnerInfluencerTotal);
  const influencerReserveTotal = round2(influencerBonusPoolPerSlot * 2);
  const unusedInfluencerReserveTotal = round2(Math.max(influencerReserveTotal - influencerTotal, 0));
  const hasBothInfluencerSources = sellerInfluencerEligible && partnerInfluencerEligible;
  const selectedInfluencerSource = hasBothInfluencerSources
    ? 'both'
    : sellerInfluencerEligible
      ? 'seller_referral'
      : partnerInfluencerEligible
        ? 'affiliate_referral'
        : 'none';
  const selectedInfluencerId = hasBothInfluencerSources
    ? sellerInfluencerId === partnerInfluencerId
      ? sellerInfluencerId
      : null
    : sellerInfluencerEligible
      ? sellerInfluencerId
      : partnerInfluencerEligible
        ? partnerInfluencerId
        : null;
  const totalCharged = round2(listingSubtotal + Number(input.shippingAmount || 0) + Number(input.taxAmount || 0));
  const hasActualPayPalFee = input.paypalFeeAmount !== null && input.paypalFeeAmount !== undefined;
  const actualPayPalFee = hasActualPayPalFee ? Number(input.paypalFeeAmount) : Number.NaN;
  const paypalFeeEstimate = Number.isFinite(actualPayPalFee) && actualPayPalFee >= 0
    ? round2(actualPayPalFee)
    : round2(totalCharged * paypalPercent + paypalFixed);
  const beezioFeeGrossTotal = round2(platformFeeGrossTotal);
  const beezioFeeNetTotal = beezioFeeGrossTotal;
  const processorAllowanceRemainder = round2(paypalAllowanceTotal - paypalFeeEstimate);
  const pricingRoundingRemainder = round2(
    listingSubtotal -
      askTotal -
      shippingReserveTotal -
      partnerTotal -
      influencerReserveTotal -
      platformFeeGrossTotal -
      paypalAllowanceTotal
  );
  const beezioProfitTotal = round2(
    beezioFeeGrossTotal +
      unusedInfluencerReserveTotal +
      Math.max(0, processorAllowanceRemainder) +
      pricingRoundingRemainder
  );

  const payees: PayeeSnapshotPlan[] = [];
  const pushPayee = (payeeUserId: string | null, payeeRole: PayeeRole, amount: number) => {
    if (!payeeUserId || amount <= 0) return;
    const payeeBreakdown = {
      seller_amount: round2(askTotal),
      shipping_reserve_amount: round2(shippingReserveTotal),
      seller_payable_amount: round2(askTotal + shippingReserveTotal),
      partner_amount: round2(partnerTotal),
      influencer_amount:
        payeeRole === 'INFLUENCER'
          ? round2(amount)
          : payeeRole === 'SELLER'
            ? round2(sellerInfluencerTotal)
            : round2(partnerInfluencerTotal),
      beezio_fee_gross: beezioFeeGrossTotal,
      beezio_fee_net: beezioFeeNetTotal,
      beezio_operating_profit: beezioProfitTotal,
      paypal_fee_estimate: paypalFeeEstimate,
      shipping_amount: round2(Number(input.shippingAmount || 0)),
      tax_amount: round2(Number(input.taxAmount || 0)),
      total_charged: totalCharged,
    };
    payees.push({
      payeeUserId,
      payeeRole,
      amount: round2(amount),
      currency: input.currency,
      status: 'PENDING_HOLD',
      holdReleaseAt: input.holdReleaseAt,
      providerOrderId: input.providerOrderId,
      providerCaptureId: input.providerCaptureId,
      snapshot: {
        order_id: input.orderId,
        order_number: String(input.orderNumber || '').trim() || null,
        provider_order_id: input.providerOrderId,
        provider_capture_id: input.providerCaptureId,
        paid_at: input.paidAt,
        hold_release_at: input.holdReleaseAt,
        payee_user_id: payeeUserId,
        payee_role: payeeRole,
        amount: round2(amount),
        currency: input.currency,
        total_charged: totalCharged,
        subtotal_listing: listingSubtotal,
        shipping_amount: round2(Number(input.shippingAmount || 0)),
        tax_amount: round2(Number(input.taxAmount || 0)),
        beezio_fee_gross_total: beezioFeeGrossTotal,
        beezio_fee_net_total: beezioFeeNetTotal,
        beezio_operating_profit: beezioProfitTotal,
        paypal_fee_estimate: paypalFeeEstimate,
        payee_breakdown: payeeBreakdown,
        influencer_bonus_pool_total: round2(influencerBonusPoolPerSlot * 2),
        influencer_bonus_paid_total: influencerTotal,
        influencer_bonus_retained_total: unusedInfluencerReserveTotal,
        platform_fee_gross_total: platformFeeGrossTotal,
        pricing_rounding_remainder: pricingRoundingRemainder,
        paypal_processing_allowance_total: paypalAllowanceTotal,
        paypal_processing_allowance_remainder: processorAllowanceRemainder,
        selected_influencer_source: selectedInfluencerSource === 'none' ? null : selectedInfluencerSource,
        selected_influencer_id: selectedInfluencerId,
        seller_influencer_id: sellerInfluencerId,
        partner_influencer_id: partnerInfluencerId,
        items: lineSnapshots,
      },
    });
  };

  pushPayee(input.sellerId, 'SELLER', round2(askTotal + shippingReserveTotal));
  pushPayee(input.partnerId, 'PARTNER', partnerTotal);

  const influencerAmounts = new Map<string, number>();
  const addInfluencerAmount = (payeeUserId: string | null | undefined, amount: number) => {
    const key = String(payeeUserId || '').trim();
    if (!key || amount <= 0) return;
    influencerAmounts.set(key, round2((influencerAmounts.get(key) || 0) + amount));
  };

  addInfluencerAmount(sellerInfluencerId, sellerInfluencerTotal);
  addInfluencerAmount(partnerInfluencerId, partnerInfluencerTotal);

  for (const [payeeUserId, amount] of influencerAmounts.entries()) {
    pushPayee(payeeUserId, 'INFLUENCER', amount);
  }

  const moneyEntries: MoneyLedgerEntryPlan[] = [];
  const pushMoneyEntry = (entry: Omit<MoneyLedgerEntryPlan, 'orderId' | 'currency' | 'provider' | 'providerOrderId' | 'providerCaptureId'>) => {
    if (entry.grossAmount <= 0 && entry.netAmount <= 0) return;
    if ((entry.payeeType === 'seller' || entry.payeeType === 'affiliate' || entry.payeeType === 'influencer') && !entry.payeeId) return;
    moneyEntries.push({
      ...entry,
      orderId: input.orderId,
      currency: input.currency,
      provider: 'paypal',
      providerOrderId: input.providerOrderId,
      providerCaptureId: input.providerCaptureId,
    });
  };

  for (const line of lineSnapshots) {
    const itemKey = String(line.order_item_id || line.product_id || `line-${moneyEntries.length}`);

    pushMoneyEntry({
      sourceKey: `${input.orderId}:${itemKey}:seller:${input.sellerId || 'none'}`,
      orderItemId: line.order_item_id,
      payeeType: 'seller',
      payeeId: input.sellerId,
      grossAmount: round2(line.seller_line_total),
      netAmount: round2(line.seller_line_total),
      status: 'held',
      holdUntil: input.holdReleaseAt,
      metadata: {
        product_id: line.product_id,
        variant_id: line.variant_id,
        product_title: line.product_title,
        quantity: line.quantity,
        seller_ask_amount: line.seller_ask_amount,
        supplier_cost_amount: line.supplier_cost_amount,
        seller_markup_amount: line.seller_markup_amount,
        shipping_reserve_amount: line.shipping_reserve_amount,
      },
    });

    pushMoneyEntry({
      sourceKey: `${input.orderId}:${itemKey}:affiliate:${input.partnerId || 'none'}`,
      orderItemId: line.order_item_id,
      payeeType: 'affiliate',
      payeeId: input.partnerId,
      grossAmount: round2(line.partner_line_total),
      netAmount: round2(line.partner_line_total),
      status: 'held',
      holdUntil: input.holdReleaseAt,
      metadata: {
        product_id: line.product_id,
        variant_id: line.variant_id,
        product_title: line.product_title,
        quantity: line.quantity,
        commission_basis: 'fixed_affiliate_payout_per_completed_sale',
      },
    });

    if (sellerInfluencerEligible) {
      pushMoneyEntry({
        sourceKey: `${input.orderId}:${itemKey}:seller_influencer:${sellerInfluencerId}`,
        orderItemId: line.order_item_id,
        payeeType: 'influencer',
        payeeId: sellerInfluencerId,
        grossAmount: round2(line.influencer_bonus_per_slot_line_total),
        netAmount: round2(line.influencer_bonus_per_slot_line_total),
        status: 'held',
        holdUntil: input.holdReleaseAt,
        metadata: {
          product_id: line.product_id,
          variant_id: line.variant_id,
          product_title: line.product_title,
          source: 'seller_referral',
        },
      });
    }

    if (partnerInfluencerEligible) {
      pushMoneyEntry({
        sourceKey: `${input.orderId}:${itemKey}:partner_influencer:${partnerInfluencerId}`,
        orderItemId: line.order_item_id,
        payeeType: 'influencer',
        payeeId: partnerInfluencerId,
        grossAmount: round2(line.influencer_bonus_per_slot_line_total),
        netAmount: round2(line.influencer_bonus_per_slot_line_total),
        status: 'held',
        holdUntil: input.holdReleaseAt,
        metadata: {
          product_id: line.product_id,
          variant_id: line.variant_id,
          product_title: line.product_title,
          source: 'affiliate_referral',
        },
      });
    }
  }

  pushMoneyEntry({
    sourceKey: `${input.orderId}:order:beezio`,
    orderItemId: null,
    payeeType: 'beezio',
    payeeId: null,
    grossAmount: beezioFeeGrossTotal,
    netAmount: beezioProfitTotal,
    status: 'tracked',
    holdUntil: null,
    metadata: {
      beezio_fee_gross: beezioFeeGrossTotal,
      beezio_fee_net: beezioProfitTotal,
      beezio_profit: beezioProfitTotal,
      beezio_operating_profit: beezioProfitTotal,
      platform_fee_gross: platformFeeGrossTotal,
      influencer_bonus_pool_total: influencerReserveTotal,
      influencer_bonus_paid_total: influencerTotal,
      influencer_bonus_retained_total: unusedInfluencerReserveTotal,
      pricing_rounding_remainder: pricingRoundingRemainder,
      paypal_fee_estimate: paypalFeeEstimate,
      paypal_processing_allowance_total: paypalAllowanceTotal,
      paypal_processing_allowance_remainder: processorAllowanceRemainder,
    },
  });

  pushMoneyEntry({
    sourceKey: `${input.orderId}:order:tax`,
    orderItemId: null,
    payeeType: 'tax',
    payeeId: null,
    grossAmount: round2(Number(input.taxAmount || 0)),
    netAmount: round2(Number(input.taxAmount || 0)),
    status: 'tracked',
    holdUntil: null,
    metadata: { basis: 'order_tax_amount' },
  });

  pushMoneyEntry({
    sourceKey: `${input.orderId}:order:shipping`,
    orderItemId: null,
    payeeType: 'shipping',
    payeeId: input.sellerId,
    grossAmount: shippingReserveTotal,
    netAmount: shippingReserveTotal,
    status: 'tracked',
    holdUntil: null,
    metadata: { basis: 'product_shipping_reserve_baked_into_advertised_price' },
  });

  pushMoneyEntry({
    sourceKey: `${input.orderId}:order:processor_fee`,
    orderItemId: null,
    payeeType: 'processor_fee',
    payeeId: null,
    grossAmount: paypalFeeEstimate,
    netAmount: paypalFeeEstimate,
    status: 'tracked',
    holdUntil: null,
    metadata: {
      processor: 'paypal',
      paypal_percent: paypalPercent,
      paypal_fixed: paypalFixed,
      paypal_processing_allowance_total: paypalAllowanceTotal,
    },
  });

  return {
    aggregate: {
      orderId: input.orderId,
      sellerId: input.sellerId,
      partnerId: input.partnerId,
      influencerId: selectedInfluencerId,
      grossAmount: listingSubtotal,
      sellerEarnings: round2(askTotal + shippingReserveTotal),
      partnerEarnings: partnerTotal,
      influencerEarnings: round2(influencerTotal),
      beezioFeeGross: beezioFeeGrossTotal,
      beezioFeeNet: beezioFeeNetTotal,
      beezioProfit: beezioProfitTotal,
      paypalFeeEstimate,
      status: 'PENDING_HOLD',
      holdReleaseAt: input.holdReleaseAt,
      notes: [
        input.providerCaptureId ? `paypal_capture_id=${input.providerCaptureId}` : null,
        `selected_influencer_source=${selectedInfluencerSource}`,
        `selected_influencer_id=${selectedInfluencerId || 'none'}`,
        `seller_influencer_id=${sellerInfluencerId || 'none'}`,
        `partner_influencer_id=${partnerInfluencerId || 'none'}`,
        `influencer_bonus_pool_total=${round2(influencerBonusPoolPerSlot * 2).toFixed(2)}`,
        `influencer_bonus_paid_total=${influencerTotal.toFixed(2)}`,
        `influencer_bonus_retained_total=${unusedInfluencerReserveTotal.toFixed(2)}`,
        `pricing_rounding_remainder=${pricingRoundingRemainder.toFixed(2)}`,
        `shipping_reserve_total=${shippingReserveTotal.toFixed(2)}`,
        `paypal_processing_allowance_total=${paypalAllowanceTotal.toFixed(2)}`,
        `paypal_processing_allowance_remainder=${processorAllowanceRemainder.toFixed(2)}`,
      ].filter(Boolean).join(' | '),
    },
    payees,
    moneyEntries,
  };
}

export function summarizePayeeSnapshots(rows: PayoutSnapshotLike[], payeeUserId?: string | null, payeeRole?: PayeeRole | null): PayoutSummary {
  const filtered = (Array.isArray(rows) ? rows : []).filter((row) => {
    const matchesUser = payeeUserId ? String(row?.payee_user_id || '') === payeeUserId : true;
    const matchesRole = payeeRole ? String(row?.payee_role || '') === payeeRole : true;
    return matchesUser && matchesRole;
  });

  let pending = 0;
  let onHold = 0;
  let available = 0;
  let paid = 0;
  let nextReleaseAt: string | null = null;

  for (const row of filtered) {
    const amount = round2(Number(row?.amount || 0));
    const status = String(row?.status || '').toUpperCase();

    if (status === 'PENDING_HOLD') {
      pending = round2(pending + amount);
      const holdReleaseAt = String(row?.hold_release_at || '').trim();
      if (holdReleaseAt && (!nextReleaseAt || new Date(holdReleaseAt) < new Date(nextReleaseAt))) {
        nextReleaseAt = holdReleaseAt;
      }
      continue;
    }

    if (status === 'ON_HOLD_DISPUTE') {
      onHold = round2(onHold + amount);
      continue;
    }

    if (status === 'READY_TO_PAY') {
      available = round2(available + amount);
      continue;
    }

    if (status === 'PAID') {
      paid = round2(paid + amount);
    }
  }

  return {
    pending,
    onHold,
    available,
    paid,
    nextReleaseAt,
    total: round2(pending + onHold + available + paid),
  };
}
