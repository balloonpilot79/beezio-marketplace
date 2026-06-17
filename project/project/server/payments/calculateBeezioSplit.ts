import { getInfluencerBonusPerSlot, getInfluencerReserveTotal } from '../../shared/referralBonus';
import { computeBeezioPlatformFee } from '../../shared/beezioFee';

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
  const hasReferrer = Boolean(input.referrer_id && input.affiliate_id);

  const affiliateCommissionCents = hasAffiliate ? Math.round(itemsSubtotalCents * affiliateRate) : 0;
  const platformBaseCents = toCents(computeBeezioPlatformFee(input.items_subtotal));
  const influencerReservePoolCents = toCents(getInfluencerReserveTotal(input.items_subtotal));
  const platformGrossCents = platformBaseCents + influencerReservePoolCents;
  // Referral payout is funded out of Beezio's kept reserve pool / fee, not added on top of the buyer price.
  const referralFeeCents = hasReferrer ? toCents(getInfluencerBonusPerSlot(input.items_subtotal)) : 0;
  const beezioFeeCents = Math.max(0, platformGrossCents - referralFeeCents);

  const sellerNetItemsCents = itemsSubtotalCents;

  const referrerAmountCents = referralFeeCents;
  const beezioKeptCents = beezioFeeCents;

  const affiliateAmountCents = affiliateCommissionCents;
  const sellerTransferCents = sellerNetItemsCents + shippingCents;

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
