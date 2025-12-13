// Centralized pricing utilities for Beezio
// Implements the unified fee model: seller keeps their ask, fees baked into buyer price

export type AffiliateCommissionType = 'percent' | 'flat';

export const STRIPE_PERCENT = 0.029; // 2.9%
export const STRIPE_FLAT = 0.60;     // $0.60 per charge

// Legacy aliases (kept for compatibility across the app)
export const STRIPE_PERCENT_FEE = STRIPE_PERCENT;
export const STRIPE_FIXED_FEE = STRIPE_FLAT;

// Platform and referral defaults
export const BEEZIO_PLATFORM_RATE = 0.15;      // Fallback when seller ask is unknown
export const REFERRAL_OF_BEEZIO_RATE = 0.05;   // Referral slice from platform share

// Default affiliate commission (decimal for backward compatibility)
export const DEFAULT_AFFILIATE_RATE = 0.20;

export const REFERRAL_PERCENT = 0.05;

// Platform fee surcharge rule: add $1 to Beezio fee for items priced at $20 and under.
const PLATFORM_FEE_UNDER_20_THRESHOLD = 20;
const PLATFORM_FEE_UNDER_20_SURCHARGE = 1;

const getPlatformSurcharge = (sellerAsk: number): number =>
  Number.isFinite(sellerAsk) && sellerAsk > 0 && sellerAsk <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

export const roundUpToTwoDecimals = (value: number): number =>
  Math.ceil((value ?? 0) * 100) / 100;

export const roundToCurrency = (value: number): number =>
  Math.round((value ?? 0 + Number.EPSILON) * 100) / 100;

export function normalizeAffiliateRate(rate?: number): number {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return DEFAULT_AFFILIATE_RATE;
  }
  if (rate > 1) return rate / 100;
  if (rate <= 0) return DEFAULT_AFFILIATE_RATE;
  return rate;
}

export function formatCurrency(value: number): string {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

export function normalizeMoneyInput(value: string): string {
  if (!value) return '';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '';
  return num.toString();
}

export function getPlatformRate(sellerAsk: number): number {
  if (!Number.isFinite(sellerAsk)) return BEEZIO_PLATFORM_RATE;
  return sellerAsk < 100 ? 0.15 : 0.10;
}

export function getAffiliateAmount(
  sellerAsk: number,
  type: AffiliateCommissionType,
  value: number
): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (!Number.isFinite(sellerAsk) || sellerAsk <= 0) return 0;
  if (type === 'percent') {
    return sellerAsk * (value / 100);
  }
  return value;
}

export function calculateCustomerProductPrice(
  sellerAsk: number,
  affiliateType: AffiliateCommissionType,
  affiliateValue: number
): number {
  const cleanSellerAsk = Number.isFinite(sellerAsk) && sellerAsk > 0 ? sellerAsk : 0;
  const platformRate = getPlatformRate(cleanSellerAsk);
  const platformAmount = cleanSellerAsk * platformRate + getPlatformSurcharge(cleanSellerAsk);
  const affiliateAmount = getAffiliateAmount(cleanSellerAsk, affiliateType, affiliateValue);

  const targetNetAfterStripe = cleanSellerAsk + affiliateAmount + platformAmount;
  const customerPrice = (targetNetAfterStripe + STRIPE_FLAT) / (1 - STRIPE_PERCENT);

  return roundToCurrency(customerPrice);
}

export interface PricingBreakdown {
  sellerAmount: number;
  affiliateAmount: number;
  referralAmount: number;
  platformFee: number;
  stripeFee: number;
  listingPrice: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
  referralRate: number;
  platformFeeRate: number;
}

export interface PricingInput {
  sellerDesiredAmount: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
  referralRate?: number;
  platformFeeRate?: number;
}

export function calculatePricing(input: PricingInput): PricingBreakdown {
  const sellerAmount = Number.isFinite(input.sellerDesiredAmount) ? input.sellerDesiredAmount : 0;
  const affiliateType: AffiliateCommissionType =
    input.affiliateType === 'flat_rate' ? 'flat' : 'percent';
  const platformRateOverride = Number.isFinite(input.platformFeeRate ?? NaN)
    ? (input.platformFeeRate as number)
    : undefined;
  const platformRate = platformRateOverride ?? getPlatformRate(sellerAmount);
  const affiliateAmount = roundToCurrency(
    getAffiliateAmount(sellerAmount, affiliateType, input.affiliateRate)
  );
  const platformFee = roundToCurrency(sellerAmount * platformRate + getPlatformSurcharge(sellerAmount));
  const listingPrice = calculateCustomerProductPrice(
    sellerAmount,
    affiliateType,
    input.affiliateRate
  );
  const stripeFee = roundToCurrency(listingPrice * STRIPE_PERCENT + STRIPE_FLAT);
  const referralRate = input.referralRate ?? REFERRAL_PERCENT;
  const referralAmount = roundToCurrency(sellerAmount * referralRate);

  return {
    sellerAmount,
    affiliateAmount,
    referralAmount,
    platformFee,
    stripeFee,
    listingPrice,
    affiliateRate: input.affiliateRate,
    affiliateType: affiliateType === 'percent' ? 'percentage' : 'flat_rate',
    referralRate,
    platformFeeRate: platformRate,
  };
}

export interface PayoutResult {
  salePrice: number;
  sellerPayout: number;
  affiliateCommission: number;
  referralBonus: number;
  beezioGross: number;
  beezioNet: number;
  stripeFee: number;
}

export function calculatePayouts(
  salePrice: number,
  sellerAsk: number,
  {
    hasAffiliate,
    hasAffiliateReferrer,
    affiliateRate = DEFAULT_AFFILIATE_RATE,
    affiliateType = 'percent',
  }: {
    hasAffiliate: boolean;
    hasAffiliateReferrer: boolean;
    affiliateRate?: number;
    affiliateType?: AffiliateCommissionType;
  }
): PayoutResult {
  const normalizedAffiliateValue =
    affiliateType === 'percent'
      ? (affiliateRate > 1 ? affiliateRate : affiliateRate * 100)
      : affiliateRate;

  const affiliateCommission = hasAffiliate
    ? roundToCurrency(getAffiliateAmount(sellerAsk, affiliateType, normalizedAffiliateValue))
    : 0;

  const platformGross = roundToCurrency(
    sellerAsk * getPlatformRate(sellerAsk) + getPlatformSurcharge(sellerAsk)
  );

  const referralBonus =
    hasAffiliateReferrer && platformGross > 0
      ? roundToCurrency(platformGross * REFERRAL_OF_BEEZIO_RATE)
      : 0;

  const beezioNet = roundToCurrency(Math.max(platformGross - referralBonus, 0));
  const stripeFee = roundToCurrency(salePrice * STRIPE_PERCENT + STRIPE_FLAT);
  const sellerPayout = roundToCurrency(sellerAsk);

  return {
    salePrice: roundToCurrency(salePrice),
    sellerPayout,
    affiliateCommission,
    referralBonus,
    beezioGross: platformGross,
    beezioNet,
    stripeFee,
  };
}

export function calculateSalePriceFromSellerAsk(
  sellerAsk: number,
  affiliateRate: number = DEFAULT_AFFILIATE_RATE,
  affiliateType: AffiliateCommissionType = 'percent'
): number {
  const affiliateValue =
    affiliateType === 'percent'
      ? (affiliateRate > 1 ? affiliateRate : affiliateRate * 100)
      : affiliateRate;
  return calculateCustomerProductPrice(sellerAsk, affiliateType, affiliateValue);
}

export function deriveSellerAskFromSalePrice(
  salePrice: number,
  affiliateRate: number = DEFAULT_AFFILIATE_RATE,
  affiliateType: AffiliateCommissionType = 'percent'
): number {
  if (!Number.isFinite(salePrice) || salePrice <= 0) return 0;

  let low = 0;
  let high = Math.max(salePrice, 1000);
  let sellerAsk = 0;

  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    const computed = calculateCustomerProductPrice(
      mid,
      affiliateType,
      affiliateType === 'percent'
        ? affiliateRate > 1
          ? affiliateRate
          : affiliateRate * 100
        : affiliateRate
    );

    if (computed > salePrice) {
      high = mid;
    } else {
      low = mid;
    }
    sellerAsk = mid;
  }

  return roundToCurrency(sellerAsk);
}

export function buildPricedProduct<T extends {
  price?: number;
  seller_ask?: number;
  seller_amount?: number;
  commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  affiliate_commission_type?: 'percent' | 'flat';
  affiliate_commission_value?: number;
  currency?: string;
  shipping_cost?: number;
  shipping_price?: number;
}>(product: T) {
  const affiliateType: AffiliateCommissionType =
    product.affiliate_commission_type ||
    (product.commission_type === 'flat_rate' ? 'flat' : 'percent');

  const affiliateValue =
    affiliateType === 'percent'
      ? (product.affiliate_commission_value ??
          product.commission_rate ??
          normalizeAffiliateRate(product.commission_rate ?? DEFAULT_AFFILIATE_RATE) * 100)
      : product.affiliate_commission_value ??
        product.flat_commission_amount ??
        0;

  const sellerAsk = typeof product.seller_ask === 'number'
    ? product.seller_ask
    : typeof product.seller_amount === 'number'
      ? product.seller_amount
      : deriveSellerAskFromSalePrice(product.price ?? 0, affiliateValue, affiliateType);

  const salePrice = calculateCustomerProductPrice(sellerAsk, affiliateType, affiliateValue);

  return {
    ...product,
    seller_ask: sellerAsk,
    seller_amount: sellerAsk,
    sale_price: salePrice,
    price: salePrice,
    affiliate_commission_type: affiliateType,
    affiliate_commission_value: affiliateValue,
    currency: product.currency ?? 'USD',
    shipping_price: product.shipping_price ?? product.shipping_cost ?? 0,
    shipping_cost: product.shipping_price ?? product.shipping_cost ?? 0,
  };
}
