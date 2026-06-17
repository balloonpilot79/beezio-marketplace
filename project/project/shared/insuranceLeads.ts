import { getReferrerBonusPerItem } from './referralBonus';

export const INSURANCE_VERTICALS = ['life', 'health', 'auto', 'home'] as const;
export type InsuranceVertical = (typeof INSURANCE_VERTICALS)[number];

export const INSURANCE_DEFAULT_LEAD_PRICE_CENTS = 1000;
export const INSURANCE_DEFAULT_BEEZIO_RATE = 0.1;
export const INSURANCE_DEFAULT_PAYPAL_RATE = 0.0399;
export const INSURANCE_DEFAULT_DUPLICATE_WINDOW_DAYS = 30;
export const INSURANCE_DEFAULT_MIN_COMPLETION_SECONDS = 4;
export const INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_HOUR = 2;
export const INSURANCE_DEFAULT_MAX_SUBMISSIONS_PER_DAY = 5;
export const INSURANCE_DEFAULT_NEW_AFFILIATE_DAILY_VALID_CAP = 5;
export const INSURANCE_DEFAULT_MIN_TOTAL_LEAD_PRICE_CENTS = 500;
export const INSURANCE_DEFAULT_MIN_BEEZIO_FEE_CENTS = 100;
export const INSURANCE_DEFAULT_MIN_AFFILIATE_PAYOUT_CENTS = 200;
export const INSURANCE_DEFAULT_PAYOUT_HOLD_DAYS = 7;
export const INSURANCE_SIMPLE_HUMAN_ANSWER = 'beezio';

const roundCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const centsToDollars = (value: number): number =>
  roundCurrency((Number(value || 0) || 0) / 100);

export const dollarsToCents = (value: number): number =>
  Math.round((Number(value || 0) || 0) * 100);

export const normalizeInsuranceVertical = (value: unknown): InsuranceVertical =>
  INSURANCE_VERTICALS.includes(String(value || '').trim().toLowerCase() as InsuranceVertical)
    ? (String(value || '').trim().toLowerCase() as InsuranceVertical)
    : 'life';

export const normalizeEmail = (value: unknown): string =>
  String(value || '').trim().toLowerCase();

export const normalizePhone = (value: unknown): string =>
  String(value || '').replace(/\D+/g, '').slice(-10);

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export const isValidPhone = (value: string): boolean =>
  /^\d{10}$/.test(normalizePhone(value));

export type InsurancePricingValidationResult = {
  ok: boolean;
  reason?: string;
  leadPriceCents: number;
  affiliatePayoutCents: number;
  influencerPayoutCents: number;
  beezioFeeCents: number;
  paypalFeeCents: number;
  agentRetainedCents: number;
};

export function computeInsuranceLeadSplitCents({
  leadPriceCents = INSURANCE_DEFAULT_LEAD_PRICE_CENTS,
  hasAffiliate = false,
  hasInfluencer = false,
  minBeezioFeeCents = INSURANCE_DEFAULT_MIN_BEEZIO_FEE_CENTS,
}: {
  leadPriceCents?: number;
  hasAffiliate?: boolean;
  hasInfluencer?: boolean;
  minBeezioFeeCents?: number;
}) {
  const safeLeadPriceCents = Math.max(0, Math.round(Number(leadPriceCents || 0)));
  const beezioFeeCents = Math.max(Math.round(safeLeadPriceCents * INSURANCE_DEFAULT_BEEZIO_RATE), minBeezioFeeCents);
  const paypalFeeCents = Math.max(0, Math.round(safeLeadPriceCents * INSURANCE_DEFAULT_PAYPAL_RATE));
  const payoutPoolCents = Math.max(safeLeadPriceCents - beezioFeeCents - paypalFeeCents, 0);
  const influencerPayoutCents = hasInfluencer
    ? Math.min(dollarsToCents(getReferrerBonusPerItem(centsToDollars(safeLeadPriceCents))), payoutPoolCents)
    : 0;
  const affiliatePayoutCents = hasAffiliate ? Math.max(payoutPoolCents - influencerPayoutCents, 0) : 0;
  const agentRetainedCents = hasAffiliate ? 0 : Math.max(payoutPoolCents - influencerPayoutCents, 0);

  return {
    leadPriceCents: safeLeadPriceCents,
    beezioFeeCents,
    paypalFeeCents,
    affiliatePayoutCents,
    influencerPayoutCents,
    agentRetainedCents,
    payoutPoolCents,
  };
}

export function validateInsuranceLeadPricing({
  leadPriceCents,
  minLeadPriceCents = INSURANCE_DEFAULT_MIN_TOTAL_LEAD_PRICE_CENTS,
  minBeezioFeeCents = INSURANCE_DEFAULT_MIN_BEEZIO_FEE_CENTS,
  minAffiliatePayoutCents = INSURANCE_DEFAULT_MIN_AFFILIATE_PAYOUT_CENTS,
  hasAffiliate = true,
  hasInfluencer = false,
}: {
  leadPriceCents: number;
  minLeadPriceCents?: number;
  minBeezioFeeCents?: number;
  minAffiliatePayoutCents?: number;
  hasAffiliate?: boolean;
  hasInfluencer?: boolean;
}): InsurancePricingValidationResult {
  const safeLeadPriceCents = Math.max(0, Math.round(Number(leadPriceCents || 0)));
  if (safeLeadPriceCents < minLeadPriceCents) {
    return {
      ok: false,
      reason: `Lead price must be at least ${centsToDollars(minLeadPriceCents).toFixed(2)}.`,
      leadPriceCents: safeLeadPriceCents,
      affiliatePayoutCents: 0,
      influencerPayoutCents: 0,
      beezioFeeCents: 0,
      paypalFeeCents: 0,
      agentRetainedCents: 0,
    };
  }

  const split = computeInsuranceLeadSplitCents({
    leadPriceCents: safeLeadPriceCents,
    hasAffiliate,
    hasInfluencer,
    minBeezioFeeCents,
  });

  if (split.beezioFeeCents < minBeezioFeeCents) {
    return {
      ok: false,
      reason: 'Lead price is too low to satisfy the Beezio minimum fee rule.',
      ...split,
    };
  }

  if (hasAffiliate && split.affiliatePayoutCents < minAffiliatePayoutCents) {
    return {
      ok: false,
      reason: 'Lead price is too low to satisfy the minimum affiliate payout rule.',
      ...split,
    };
  }

  return {
    ok: true,
    ...split,
  };
}

export function humanizeInsuranceVertical(vertical: InsuranceVertical | string): string {
  const normalized = normalizeInsuranceVertical(vertical);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
