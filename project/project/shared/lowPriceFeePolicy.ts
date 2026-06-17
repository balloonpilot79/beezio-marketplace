const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const LOW_PRICE_THRESHOLD = 25;
export const LOW_PRICE_TOTAL_FEE = 2;

export const isLowPriceAmount = (amount: number): boolean =>
  Number.isFinite(amount) && Number(amount) > 0 && Number(amount) < LOW_PRICE_THRESHOLD;

export const getLowPriceFlatFeeTotal = (quantity: number): number =>
  round2(LOW_PRICE_TOTAL_FEE * Math.max(1, Math.floor(Number(quantity || 0) || 1)));

export const allocatePayPalFeeToLowPrice = (
  paypalFeeEstimate: number,
  lowPriceListingSubtotal: number,
  listingSubtotal: number,
): number => {
  const paypal = Math.max(0, Number(paypalFeeEstimate) || 0);
  const lowSubtotal = Math.max(0, Number(lowPriceListingSubtotal) || 0);
  const totalSubtotal = Math.max(0, Number(listingSubtotal) || 0);
  if (paypal <= 0 || lowSubtotal <= 0 || totalSubtotal <= 0) return 0;
  return round2(paypal * Math.min(1, lowSubtotal / totalSubtotal));
};
