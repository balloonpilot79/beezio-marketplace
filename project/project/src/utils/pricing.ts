// Centralized pricing utilities for Beezio
// Implements the unified fee model: seller keeps their ask, fees baked into buyer price

import { PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { computeCustomerListingPrice } from '../../shared/customerPrice';
import {
  getAssignedInfluencerPayoutTotal,
  getInfluencerReserveTotal,
} from '../../shared/referralBonus';
import { calculateFinalPrice, computePayoutBreakdown, deriveAskPriceFromFinalPrice } from './pricingEngine';
import { DEFAULT_BEEZIO_PLATFORM_RATE, computeBeezioPlatformFee } from '../../shared/beezioFee';
import {
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_PROCESSING_FEE,
} from '../../shared/testItemPricing';

export type AffiliateCommissionType = 'percent' | 'flat';
export const DEFAULT_ZERO_AFFILIATE_PERCENT = 30;

export const PROCESSING_PERCENT = 0.0399; // 3.99%
export const PROCESSING_FLAT = 0.6;       // $0.60 per order

// Platform and referral defaults
export const BEEZIO_PLATFORM_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;      // Fallback when seller ask is unknown
export const REFERRAL_OF_BEEZIO_RATE = 0;

// Default affiliate commission (decimal for backward compatibility)
export const DEFAULT_AFFILIATE_RATE = 0.20;

export const REFERRAL_PERCENT = 0;

export const roundUpToTwoDecimals = (value: number): number =>
  Math.ceil((value ?? 0) * 100) / 100;

export const roundToCurrency = (value: number): number =>
  Math.round((value ?? 0 + Number.EPSILON) * 100) / 100;

export function normalizeAffiliateRate(rate?: number): number {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return DEFAULT_AFFILIATE_RATE;
  }
  if (rate > 1) return rate / 100;
  if (rate < 0) return 0;
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
  return BEEZIO_PLATFORM_RATE;
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

type AffiliatePricingLike = {
  commission_rate?: number | null;
  affiliate_commission_rate?: number | null;
  commission_type?: string | null;
  flat_commission_amount?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
};

export function resolveAffiliateCommission(product: AffiliatePricingLike): {
  type: AffiliateCommissionType;
  value: number;
} {
  const pickPositiveNumber = (...values: unknown[]) => {
    for (const value of values) {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) return num;
    }
    return 0;
  };

  const affiliateCommissionType = String(product?.affiliate_commission_type || '').trim().toLowerCase();
  const commissionType = String(product?.commission_type || '').trim().toLowerCase();
  const flatCommissionAmount = Number(product?.flat_commission_amount ?? 0);
  const hasFlatAmount = Number.isFinite(flatCommissionAmount) && flatCommissionAmount > 0;
  const normalizedType =
    affiliateCommissionType === 'flat' ||
    commissionType === 'flat_rate' ||
    commissionType === 'fixed' ||
    hasFlatAmount
      ? 'flat'
      : 'percent';

  if (normalizedType === 'flat') {
    const flatValue = pickPositiveNumber(
      product?.flat_commission_amount,
      affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed'
        ? pickPositiveNumber(product?.affiliate_commission_value, product?.affiliate_commission_rate, product?.commission_rate)
        : 0
    );
    if (!(flatValue > 0)) {
      return {
        type: 'percent',
        value: DEFAULT_ZERO_AFFILIATE_PERCENT,
      };
    }
    return {
      type: 'flat',
      value: roundToCurrency(flatValue),
    };
  }

  const rawPercent = pickPositiveNumber(
    product?.affiliate_commission_value,
    product?.affiliate_commission_rate,
    product?.commission_rate,
    DEFAULT_ZERO_AFFILIATE_PERCENT
  );
  const percent =
    Number.isFinite(rawPercent) && rawPercent > 0
      ? rawPercent > 1
        ? rawPercent
        : rawPercent * 100
      : DEFAULT_ZERO_AFFILIATE_PERCENT;

  return {
    type: 'percent',
    value: roundToCurrency(percent),
  };
}

export function calculateCustomerProductPrice(
  sellerAsk: number,
  affiliateType: AffiliateCommissionType,
  affiliateValue: number
): number {
  return roundToCurrency(
    computeCustomerListingPrice({
      sellerAsk,
      affiliateType,
      affiliateValue,
      beezioRate: getPlatformRate(sellerAsk),
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
  const sellerAmount = Number.isFinite(input.sellerDesiredAmount) ? input.sellerDesiredAmount : 0;
  const affiliateType: AffiliateCommissionType =
    input.affiliateType === 'flat_rate' ? 'flat' : 'percent';
  const testItem = input.testItem === true;
  const platformRateOverride = Number.isFinite(input.platformFeeRate ?? NaN)
    ? (input.platformFeeRate as number)
    : undefined;
  const platformRate = platformRateOverride ?? getPlatformRate(sellerAmount);
  const affiliateAmount = roundToCurrency(
    getAffiliateAmount(sellerAmount, affiliateType, input.affiliateRate)
  );
  const platformFee = testItem
    ? TEST_ITEM_BEEZIO_FEE
    : roundToCurrency(
        computeBeezioPlatformFee(sellerAmount, { rate: platformRate })
      );
  const referralAmount = testItem
    ? roundToCurrency(TEST_ITEM_INFLUENCER_FEE * 2)
    : roundToCurrency(getInfluencerReserveTotal(sellerAmount));
  const listingPrice = testItem
    ? TEST_ITEM_PRICE
    : calculateCustomerProductPrice(
        sellerAmount,
        affiliateType,
        input.affiliateRate
      );
  const processingFee = testItem
    ? TEST_ITEM_PROCESSING_FEE
    : roundToCurrency(listingPrice * PROCESSING_PERCENT + PROCESSING_FLAT);
  const referralRate = testItem ? 0 : input.referralRate ?? REFERRAL_PERCENT;

  return {
    sellerAmount,
    affiliateAmount,
    referralAmount,
    platformFee,
    processingFee,
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
  processingFee: number;
}

export function calculatePayouts(
  salePrice: number,
  sellerAsk: number,
  {
    hasAffiliate,
    hasAffiliateReferrer,
    affiliateRate = DEFAULT_AFFILIATE_RATE,
    affiliateType = 'percent',
    influencerCount,
  }: {
    hasAffiliate: boolean;
    hasAffiliateReferrer: boolean;
    affiliateRate?: number;
    affiliateType?: AffiliateCommissionType;
    influencerCount?: number;
  }
): PayoutResult {
  const assignedInfluencerCount = Number.isFinite(influencerCount)
    ? Math.max(0, Math.floor(Number(influencerCount)))
    : hasAffiliateReferrer
      ? 1
      : 0;

  if (affiliateType === 'percent') {
    const affiliatePercent = affiliateRate > 1 ? affiliateRate : affiliateRate * 100;
    const finalPrice = calculateFinalPrice(sellerAsk, {
      affiliatePercent,
      platformPercent: PLATFORM_FEE_PERCENT,
    });

    const breakdown = computePayoutBreakdown(finalPrice, sellerAsk, {
      affiliatePercent,
      platformPercent: PLATFORM_FEE_PERCENT,
    }, { referralOverrideEnabled: false });
    const referralBonus = getAssignedInfluencerPayoutTotal(sellerAsk, assignedInfluencerCount);

    const processingFee = roundToCurrency(
      breakdown.processingPercentAmount + breakdown.processingFixedFee
    );
    const regularPayPalAllocation = sellerAsk >= 25 ? processingFee : 0;

    return {
      salePrice: roundToCurrency(finalPrice),
      sellerPayout: roundToCurrency(sellerAsk),
      affiliateCommission: hasAffiliate ? roundToCurrency(breakdown.affiliateAmount) : 0,
      referralBonus,
      beezioGross: roundToCurrency(breakdown.platformGrossAmount),
      beezioNet: roundToCurrency(Math.max(
        breakdown.platformGrossAmount - regularPayPalAllocation,
        0
      )),
      processingFee,
    };
  }

  const normalizedAffiliateValue =
    affiliateType === 'percent'
      ? (affiliateRate > 1 ? affiliateRate : affiliateRate * 100)
      : affiliateRate;

  const affiliateCommission = hasAffiliate
    ? roundToCurrency(getAffiliateAmount(sellerAsk, affiliateType, normalizedAffiliateValue))
    : 0;

  const platformGross = roundToCurrency(
    computeBeezioPlatformFee(sellerAsk, { rate: getPlatformRate(sellerAsk) })
  );

  const referralBonus = getAssignedInfluencerPayoutTotal(sellerAsk, assignedInfluencerCount);
  const regularPayPalAllocation = sellerAsk >= 25 ? roundToCurrency(salePrice * PROCESSING_PERCENT + PROCESSING_FLAT) : 0;
  const beezioNet = roundToCurrency(Math.max(platformGross - regularPayPalAllocation, 0));
  const processingFee = roundToCurrency(salePrice * PROCESSING_PERCENT + PROCESSING_FLAT);
  const sellerPayout = roundToCurrency(sellerAsk);

  return {
    salePrice: roundToCurrency(salePrice),
    sellerPayout,
    affiliateCommission,
    referralBonus,
    beezioGross: platformGross,
    beezioNet,
    processingFee,
  };
}

export function calculateSalePriceFromSellerAsk(
  sellerAsk: number,
  affiliateRate: number = DEFAULT_AFFILIATE_RATE,
  affiliateType: AffiliateCommissionType = 'percent'
): number {
  const affiliateValue = affiliateType === 'percent'
    ? (affiliateRate > 1 ? affiliateRate : affiliateRate * 100)
    : affiliateRate;

  return calculateCustomerProductPrice(sellerAsk, affiliateType, affiliateValue);
}

export function deriveSellerAskFromSalePrice(
  salePrice: number,
  affiliateRate: number = DEFAULT_AFFILIATE_RATE,
  affiliateType: AffiliateCommissionType = 'percent'
): number {
  if (affiliateType === 'percent') {
    const affiliatePercent = affiliateRate > 1 ? affiliateRate : affiliateRate * 100;
    return deriveAskPriceFromFinalPrice(salePrice, {
      affiliatePercent,
      platformPercent: PLATFORM_FEE_PERCENT,
    });
  }

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
  const affiliatePricing = resolveAffiliateCommission(product);
  const affiliateType: AffiliateCommissionType = affiliatePricing.type;
  const affiliateValue = affiliatePricing.value;

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
