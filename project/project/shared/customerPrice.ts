import { computeFixedBeezioPlatformFee } from './beezioFee.ts';
import { getInfluencerReserveTotal } from './referralBonus.ts';

export type SharedAffiliateCommissionType = 'percent' | 'flat';

const ceil2 = (value: number): number =>
  Math.ceil((Number(value || 0) + Number.EPSILON) * 100) / 100;

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function computeAffiliateAmountFromAsk(
  sellerPayout: number,
  affiliateType: SharedAffiliateCommissionType,
  affiliateValue: number,
): number {
  const payout = Number.isFinite(sellerPayout) ? Math.max(0, sellerPayout) : 0;
  const value = Number.isFinite(affiliateValue) ? Math.max(0, affiliateValue) : 0;
  if (payout <= 0 || value <= 0) return 0;
  if (affiliateType === 'flat') return round2(value);

  // Compatibility for pre-migration catalog rows. New listings are fixed only.
  const normalizedPercent = value > 1 ? value / 100 : value;
  return round2(payout * Math.max(0, normalizedPercent));
}

export type FixedTierPricingBreakdown = {
  supplierCost: number;
  sellerMarkup: number;
  sellerPayout: number;
  affiliatePayout: number;
  shippingIncluded: number;
  influencerAllocation: number;
  influencerPerSlot: number;
  platformFee: number;
  paypalProcessingAllowance: number;
  finalAdvertisedPrice: number;
  estimatedSalesTax: number;
  estimatedCheckoutTotal: number;
  iterations: number;
};

export function computeFixedTierPricing(params: {
  supplierCost?: number;
  sellerMarkup?: number;
  sellerPayout?: number;
  affiliatePayout?: number;
  shippingIncluded?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  payoutBuffer?: number;
  estimatedTaxRate?: number;
}): FixedTierPricingBreakdown {
  const supplierCost = round2(Math.max(0, Number(params.supplierCost || 0)));
  const sellerMarkup = round2(Math.max(0, Number(params.sellerMarkup || 0)));
  const explicitSellerPayout = Number(params.sellerPayout);
  const sellerPayout = round2(
    Number.isFinite(explicitSellerPayout)
      ? Math.max(0, explicitSellerPayout)
      : supplierCost + sellerMarkup
  );
  const affiliatePayout = round2(Math.max(0, Number(params.affiliatePayout || 0)));
  const shippingIncluded = round2(Math.max(0, Number(params.shippingIncluded || 0)));
  const paypalPercent = Math.max(0, Number(params.paypalPercent ?? 0.0399) || 0);
  const paypalFixed = Math.max(0, Number(params.paypalFixed ?? 0.6) || 0);
  const payoutBuffer = round2(Math.max(0, Number(params.payoutBuffer || 0)));
  const estimatedTaxRate = Math.max(0, Number(params.estimatedTaxRate || 0));
  const requiredBase = round2(
    sellerPayout + affiliatePayout + shippingIncluded + payoutBuffer
  );

  let finalAdvertisedPrice = requiredBase;
  let influencerAllocation = 0;
  let platformFee = 0;
  let paypalProcessingAllowance = 0;
  let iterations = 0;

  for (let index = 0; index < 100; index += 1) {
    iterations = index + 1;
    influencerAllocation = getInfluencerReserveTotal(finalAdvertisedPrice);
    platformFee = computeFixedBeezioPlatformFee(finalAdvertisedPrice);
    paypalProcessingAllowance = ceil2(
      finalAdvertisedPrice * paypalPercent + paypalFixed
    );
    const nextPrice = ceil2(
      requiredBase +
        influencerAllocation +
        platformFee +
        paypalProcessingAllowance
    );
    if (nextPrice === finalAdvertisedPrice) break;
    finalAdvertisedPrice = nextPrice;
  }

  // Re-evaluate once at the settled price so every returned tier is guaranteed
  // to match the displayed price.
  influencerAllocation = getInfluencerReserveTotal(finalAdvertisedPrice);
  platformFee = computeFixedBeezioPlatformFee(finalAdvertisedPrice);
  paypalProcessingAllowance = ceil2(
    finalAdvertisedPrice * paypalPercent + paypalFixed
  );
  const coveredPrice = ceil2(
    requiredBase +
      influencerAllocation +
      platformFee +
      paypalProcessingAllowance
  );
  if (coveredPrice > finalAdvertisedPrice) finalAdvertisedPrice = coveredPrice;

  const estimatedSalesTax = round2(finalAdvertisedPrice * estimatedTaxRate);
  const estimatedCheckoutTotal = round2(finalAdvertisedPrice + estimatedSalesTax);

  return {
    supplierCost,
    sellerMarkup,
    sellerPayout,
    affiliatePayout,
    shippingIncluded,
    influencerAllocation,
    influencerPerSlot: round2(influencerAllocation / 2),
    platformFee,
    paypalProcessingAllowance,
    finalAdvertisedPrice,
    estimatedSalesTax,
    estimatedCheckoutTotal,
    iterations,
  };
}

export function computeCustomerListingPrice(params: {
  sellerAsk: number;
  affiliateType: SharedAffiliateCommissionType;
  affiliateValue: number;
  shippingIncluded?: number;
  beezioRate?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  payoutBuffer?: number;
}): number {
  const affiliatePayout = computeAffiliateAmountFromAsk(
    params.sellerAsk,
    params.affiliateType,
    params.affiliateValue
  );
  return computeFixedTierPricing({
    sellerPayout: params.sellerAsk,
    affiliatePayout,
    shippingIncluded: params.shippingIncluded,
    paypalPercent: params.paypalPercent,
    paypalFixed: params.paypalFixed,
    payoutBuffer: params.payoutBuffer,
  }).finalAdvertisedPrice;
}
