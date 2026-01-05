export type BeezioSplitInput = {
  items_subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  affiliate_id?: string | null;
  referrer_id?: string | null;
  isFundraiser: boolean;
  affiliate_rate: number;
};

export type BeezioSplitResult = {
  beezio_fee_amount: number;
  referral_fee_amount: number;
  affiliate_commission_amount: number;
  seller_net_items_amount: number;
  seller_total_transfer_amount: number;
  beezio_kept_amount: number;
  referrer_amount: number;
  affiliate_amount: number;
  tax_amount: number;
  shipping_amount: number;
  items_subtotal: number;
  validation_ok: boolean;
  validation_reason?: string;
};

const BEEZIO_FEE_RATE = 0.15;
const REFERRAL_RATE = 0.05;

function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

function fromCents(cents: number): number {
  return Math.round((cents + Number.EPSILON)) / 100;
}

function normalizeRate(input: number): number {
  if (!Number.isFinite(input) || input <= 0) return 0;
  const asFraction = input > 1 ? input / 100 : input;
  return Math.max(0, Math.min(1, asFraction));
}

export function calculateBeezioSplit(input: BeezioSplitInput): BeezioSplitResult {
  const itemsSubtotalCents = toCents(input.items_subtotal);
  const shippingCents = toCents(input.shipping_amount);
  const taxCents = toCents(input.tax_amount);

  const affiliateRate = normalizeRate(input.affiliate_rate);
  const hasAffiliate = Boolean(input.affiliate_id);
  const hasReferrer = Boolean(input.referrer_id);

  const platformGrossCents = Math.round(itemsSubtotalCents * BEEZIO_FEE_RATE);
  // Referral override is 5 percentage points of the sale base, paid out of Beezio's 15% fee.
  const referralFeeCents = hasReferrer ? Math.min(platformGrossCents, Math.round(itemsSubtotalCents * REFERRAL_RATE)) : 0;
  const beezioFeeCents = platformGrossCents - referralFeeCents;
  const affiliateCommissionCents = hasAffiliate ? Math.round(itemsSubtotalCents * affiliateRate) : 0;

  const sellerNetItemsCents = itemsSubtotalCents - platformGrossCents - affiliateCommissionCents;
  if (sellerNetItemsCents < 0) {
    return {
      beezio_fee_amount: fromCents(beezioFeeCents),
      referral_fee_amount: fromCents(referralFeeCents),
      affiliate_commission_amount: fromCents(affiliateCommissionCents),
      seller_net_items_amount: fromCents(sellerNetItemsCents),
      seller_total_transfer_amount: fromCents(sellerNetItemsCents + shippingCents),
      beezio_kept_amount: 0,
      referrer_amount: 0,
      affiliate_amount: 0,
      tax_amount: fromCents(taxCents),
      shipping_amount: fromCents(shippingCents),
      items_subtotal: fromCents(itemsSubtotalCents),
      validation_ok: false,
      validation_reason:
        'Seller net items would be negative. Reduce affiliate_rate and/or ensure items_subtotal covers platform/referral/affiliate amounts.',
    };
  }

  const referrerAmountCents = hasReferrer ? referralFeeCents : 0;
  const beezioKeptCents = beezioFeeCents;

  const affiliateAmountCents = affiliateCommissionCents;
  const sellerTransferCents = sellerNetItemsCents + shippingCents;

  const reconciliationOk = itemsSubtotalCents === sellerNetItemsCents + platformGrossCents + affiliateCommissionCents;

  if (!reconciliationOk) {
    return {
      beezio_fee_amount: fromCents(beezioFeeCents),
      referral_fee_amount: fromCents(referralFeeCents),
      affiliate_commission_amount: fromCents(affiliateCommissionCents),
      seller_net_items_amount: fromCents(sellerNetItemsCents),
      seller_total_transfer_amount: fromCents(sellerTransferCents),
      beezio_kept_amount: fromCents(beezioKeptCents),
      referrer_amount: fromCents(referrerAmountCents),
      affiliate_amount: fromCents(affiliateAmountCents),
      tax_amount: fromCents(taxCents),
      shipping_amount: fromCents(shippingCents),
      items_subtotal: fromCents(itemsSubtotalCents),
      validation_ok: false,
      validation_reason: 'Reconciliation failed: items_subtotal != seller_net_items + platform_gross + affiliate_commission.',
    };
  }

  return {
    beezio_fee_amount: fromCents(beezioFeeCents),
    referral_fee_amount: fromCents(referralFeeCents),
    affiliate_commission_amount: fromCents(affiliateCommissionCents),
    seller_net_items_amount: fromCents(sellerNetItemsCents),
    seller_total_transfer_amount: fromCents(sellerTransferCents),
    beezio_kept_amount: fromCents(beezioKeptCents),
    referrer_amount: fromCents(referrerAmountCents),
    affiliate_amount: fromCents(affiliateAmountCents),
    tax_amount: fromCents(taxCents),
    shipping_amount: fromCents(shippingCents),
    items_subtotal: fromCents(itemsSubtotalCents),
    validation_ok: true,
  };
}
