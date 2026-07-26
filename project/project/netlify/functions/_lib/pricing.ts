import { ceil2 } from './money';
import { computeFixedTierPricing } from '../../../shared/customerPrice';

/**
 * Compute listing price L (pre tax/shipping) so the seller can receive ask A,
 * while covering PayPal fees + buffer and allocating partner + platform fee.
 *
 * Spec:
 *   partner = A * c
 *   platform = capped fee based on A
 *   L = (A + partner + platform + f + d) / (1 - p)
 */
export function computeListingPrice(params: {
  ask: number;
  partnerRate: number; // decimal, e.g. 0.10
  influencerActive: boolean;
  beezioRate: number; // decimal, e.g. 0.15
  beezioMinimum?: number; // dollars
  beezioCap?: number; // dollars
  beezioLargeOrderThreshold?: number; // dollars
  beezioLargeOrderFlatFee?: number; // dollars
  paypalPct: number; // decimal, e.g. 0.0399
  paypalFixed: number; // dollars
  payoutBuffer: number; // dollars
  shippingIncluded?: number; // supplier shipping reserve baked into price
}): number {
  const A = Number(params.ask) || 0;
  const partnerRate = Math.max(0, Number(params.partnerRate) || 0);
  return ceil2(
    computeFixedTierPricing({
      sellerPayout: A,
      affiliatePayout: A * partnerRate,
      shippingIncluded: Math.max(0, Number(params.shippingIncluded) || 0),
      paypalPercent: Math.max(0, Number(params.paypalPct) || 0),
      paypalFixed: Math.max(0, Number(params.paypalFixed) || 0),
      payoutBuffer: Math.max(0, Number(params.payoutBuffer) || 0),
    }).finalAdvertisedPrice
  );
}
