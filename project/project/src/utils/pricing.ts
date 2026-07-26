import {
  computeAffiliateAmountFromAsk,
  computeCustomerListingPrice,
  computeFixedTierPricing,
} from '../../shared/customerPrice';
import { computeFixedBeezioPlatformFee } from '../../shared/beezioFee';
import {
  getAssignedInfluencerPayoutTotal,
  getInfluencerReserveTotal,
} from '../../shared/referralBonus';

export type AffiliateCommissionType = 'percent' | 'flat';
export const DEFAULT_ZERO_AFFILIATE_PERCENT = 0;
export const PROCESSING_PERCENT = 0.0399;
export const PROCESSING_FLAT = 0.6;
export const BEEZIO_PLATFORM_RATE = 0;
export const REFERRAL_OF_BEEZIO_RATE = 0;
export const DEFAULT_AFFILIATE_RATE = 0;
export const REFERRAL_PERCENT = 0;

export const roundUpToTwoDecimals = (value: number): number =>
  Math.ceil((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const roundToCurrency = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function normalizeAffiliateRate(rate?: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Number(rate));
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

export function getPlatformRate(_sellerAsk: number): number {
  return 0;
}

export function getAffiliateAmount(
  sellerPayout: number,
  type: AffiliateCommissionType,
  value: number
): number {
  return computeAffiliateAmountFromAsk(sellerPayout, type, value);
}

type AffiliatePricingLike = {
  commission_rate?: number | null;
  affiliate_commission_rate?: number | null;
  commission_type?: string | null;
  flat_commission_amount?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
  affiliate_payout_amount?: number | null;
};

export function resolveAffiliateCommission(product: AffiliatePricingLike): {
  type: AffiliateCommissionType;
  value: number;
} {
  const directFlat = Number(
    product?.affiliate_payout_amount ??
      product?.flat_commission_amount ??
      (String(product?.affiliate_commission_type || '').toLowerCase() === 'flat'
        ? product?.affiliate_commission_value
        : 0)
  );
  if (Number.isFinite(directFlat) && directFlat > 0) {
    return { type: 'flat', value: roundToCurrency(directFlat) };
  }

  // Read-only compatibility until the catalog migration converts every legacy
  // percentage row to a frozen dollar payout.
  const rawPercent = Number(
    product?.affiliate_commission_value ??
      product?.affiliate_commission_rate ??
      product?.commission_rate ??
      0
  );
  if (Number.isFinite(rawPercent) && rawPercent > 0) {
    return {
      type: 'percent',
      value: roundToCurrency(rawPercent > 1 ? rawPercent : rawPercent * 100),
    };
  }

  return { type: 'flat', value: 0 };
}

export function calculateCustomerProductPrice(
  sellerPayout: number,
  affiliateType: AffiliateCommissionType,
  affiliateValue: number,
  shippingIncluded = 0
): number {
  return roundToCurrency(
    computeCustomerListingPrice({
      sellerAsk: sellerPayout,
      affiliateType,
      affiliateValue,
      shippingIncluded,
      paypalPercent: PROCESSING_PERCENT,
      paypalFixed: PROCESSING_FLAT,
    })
  );
}

export interface PricingBreakdown {
  sellerAmount: number;
  affiliateAmount: number;
  referralAmount: number;
  platformFee: number;
  processingFee: number;
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
  testItem?: boolean;
}

export function calculatePricing(input: PricingInput): PricingBreakdown {
  const sellerAmount = roundToCurrency(Math.max(0, Number(input.sellerDesiredAmount || 0)));
  const affiliateType: AffiliateCommissionType =
    input.affiliateType === 'flat_rate' ? 'flat' : 'percent';
  const affiliateAmount = getAffiliateAmount(
    sellerAmount,
    affiliateType,
    input.affiliateRate
  );
  const calculated = computeFixedTierPricing({
    sellerPayout: sellerAmount,
    affiliatePayout: affiliateAmount,
    paypalPercent: PROCESSING_PERCENT,
    paypalFixed: PROCESSING_FLAT,
  });

  return {
    sellerAmount,
    affiliateAmount,
    referralAmount: calculated.influencerAllocation,
    platformFee: calculated.platformFee,
    processingFee: calculated.paypalProcessingAllowance,
    listingPrice: calculated.finalAdvertisedPrice,
    affiliateRate: affiliateAmount,
    affiliateType: 'flat_rate',
    referralRate: 0,
    platformFeeRate: 0,
  };
}

export interface PayoutResult {
  salePrice: number;
  sellerPayout: number;
  affiliateCommission: number;
  referralBonus: number;
  beezioGross: number;
  beezioNet: number;
  processingFee: number;
}

export function calculatePayouts(
  salePrice: number,
  sellerPayout: number,
  {
    hasAffiliate,
    hasAffiliateReferrer,
    affiliateRate = 0,
    affiliateType = 'flat',
    influencerCount,
  }: {
    hasAffiliate: boolean;
    hasAffiliateReferrer: boolean;
    affiliateRate?: number;
    affiliateType?: AffiliateCommissionType;
    influencerCount?: number;
  }
): PayoutResult {
  const affiliateCommission = hasAffiliate
    ? getAffiliateAmount(sellerPayout, affiliateType, affiliateRate)
    : 0;
  const assignedInfluencerCount = Number.isFinite(influencerCount)
    ? Math.max(0, Math.floor(Number(influencerCount)))
    : hasAffiliateReferrer
      ? 1
      : 0;
  const referralBonus = getAssignedInfluencerPayoutTotal(
    salePrice,
    assignedInfluencerCount
  );
  const processingFee = roundUpToTwoDecimals(
    salePrice * PROCESSING_PERCENT + PROCESSING_FLAT
  );
  const beezioGross = computeFixedBeezioPlatformFee(salePrice);

  return {
    salePrice: roundToCurrency(salePrice),
    sellerPayout: roundToCurrency(sellerPayout),
    affiliateCommission: roundToCurrency(affiliateCommission),
    referralBonus,
    beezioGross,
    // Processor allowance is a separate price bucket, so it does not reduce
    // the fixed Beezio platform earnings.
    beezioNet: beezioGross,
    processingFee,
  };
}

export function calculateSalePriceFromSellerAsk(
  sellerPayout: number,
  affiliateRate: number = 0,
  affiliateType: AffiliateCommissionType = 'flat',
  shippingIncluded: number = 0
): number {
  return calculateCustomerProductPrice(
    sellerPayout,
    affiliateType,
    affiliateRate,
    shippingIncluded
  );
}

export function deriveSellerAskFromSalePrice(
  salePrice: number,
  affiliateRate: number = 0,
  affiliateType: AffiliateCommissionType = 'flat'
): number {
  if (!Number.isFinite(salePrice) || salePrice <= 0) return 0;
  let low = 0;
  let high = Math.max(salePrice, 1000);
  let sellerPayout = 0;
  for (let index = 0; index < 40; index += 1) {
    const mid = (low + high) / 2;
    const computed = calculateCustomerProductPrice(mid, affiliateType, affiliateRate);
    if (computed > salePrice) high = mid;
    else low = mid;
    sellerPayout = mid;
  }
  return roundToCurrency(sellerPayout);
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
  affiliate_payout_amount?: number;
  currency?: string;
  shipping_cost?: number;
  shipping_price?: number;
  shipping_reserve_amount?: number;
}>(product: T) {
  const affiliate = resolveAffiliateCommission(product);
  const sellerPayout =
    typeof product.seller_ask === 'number'
      ? product.seller_ask
      : typeof product.seller_amount === 'number'
        ? product.seller_amount
        : deriveSellerAskFromSalePrice(product.price ?? 0, affiliate.value, affiliate.type);
  const shipping = Number(
    product.shipping_reserve_amount ??
      product.shipping_price ??
      product.shipping_cost ??
      0
  );
  const salePrice = calculateCustomerProductPrice(
    sellerPayout,
    affiliate.type,
    affiliate.value,
    shipping
  );

  return {
    ...product,
    seller_ask: sellerPayout,
    seller_amount: sellerPayout,
    sale_price: salePrice,
    price: salePrice,
    affiliate_commission_type: affiliate.type,
    affiliate_commission_value: affiliate.value,
    affiliate_payout_amount:
      affiliate.type === 'flat'
        ? affiliate.value
        : getAffiliateAmount(sellerPayout, affiliate.type, affiliate.value),
    currency: product.currency ?? 'USD',
    shipping_price: shipping,
    shipping_cost: shipping,
  };
}
