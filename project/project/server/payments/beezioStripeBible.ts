import { toCents } from './money';

export type BeezioSplitInput = {
  productSubtotalCents: number;
  affiliateFeeCents: number;
  hasReferral: boolean;
  isFundraiser: boolean;
};

export type BeezioSplitOutput = {
  productSubtotalCents: number;
  affiliateFeeCents: number;
  beezioFeeCents: number;
  refOrFundraiserFeeCents: number;
};

const roundCents = (n: number) => Math.round(n);

export function computeBeezioFees(input: BeezioSplitInput): BeezioSplitOutput {
  const ps = Math.max(0, Math.floor(input.productSubtotalCents || 0));
  const affiliateFeeCents = Math.max(0, Math.floor(input.affiliateFeeCents || 0));
  const baseCents = ps + affiliateFeeCents;
  // Stripe-compliance hardening: disable recruiter/referrer overrides (second-tier payouts).
  // Keep the input flag for backwards compatibility, but ignore it.
  const beezioRate = 0.15;
  const refRate = 0;

  return {
    productSubtotalCents: ps,
    affiliateFeeCents,
    beezioFeeCents: roundCents(baseCents * beezioRate),
    refOrFundraiserFeeCents: roundCents(baseCents * refRate),
  };
}

export function computeBuyerPaidProcessingFeeCents(params: {
  baseTotalCents: number;
  stripePct: number; // e.g. 0.029
  stripeFixedCents: number; // e.g. 30
}) {
  const baseTotalCents = Math.max(0, Math.floor(params.baseTotalCents || 0));
  const stripePct = Number(params.stripePct || 0);
  const stripeFixedCents = Math.max(0, Math.floor(params.stripeFixedCents || 0));
  if (!Number.isFinite(stripePct) || stripePct < 0 || stripePct >= 1) return 0;

  // fee = ceil(((p * base) + fixed) / (1 - p))
  const fee = (stripePct * baseTotalCents + stripeFixedCents) / (1 - stripePct);
  return Math.max(0, Math.ceil(fee));
}

export function envStripeProcessingFeePct(): number {
  const raw = String(process.env.STRIPE_PROCESSING_FEE_PCT || '').trim();
  const v = Number(raw);
  if (Number.isFinite(v) && v > 0 && v < 1) return v;
  // Default to US card processing; override in env if needed.
  return 0.029;
}

export function envStripeProcessingFeeFixedCents(): number {
  const raw = String(process.env.STRIPE_PROCESSING_FEE_FIXED_CENTS || '').trim();
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0) return Math.floor(v);
  // Default to 30 cents; override in env if needed.
  return toCents(0.3);
}
