// Fixed economics for the one designated live checkout test product.
export const DOLLAR_CHECKOUT_TEST_ID = '82ab459c-f29b-49b3-ac81-e5f95c1c48e9';
export const DOLLAR_CHECKOUT_TEST = {
  sellerPayout: 0.10,
  affiliatePayout: 0.10,
  shippingIncluded: 0,
  influencerAllocation: 0.04,
  platformFee: 0.05,
  paypalProcessingAllowance: 0.64,
  finalAdvertisedPrice: 0.93,
};
export const isDollarCheckoutTest = (id: unknown): boolean =>
  String(id || '') === DOLLAR_CHECKOUT_TEST_ID;
