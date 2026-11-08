import { computeFixedTierPricing } from './customerPrice';
import { describe, expect, it } from 'vitest';
import { isPublicAffiliateProduct, isPublicMarketplaceProduct } from './publicProductVisibility';
import { matchesMerchandiseFilter } from './vendorListing';

describe('vendor listings', () => {
  const item = {
    is_active: true, status: 'active', stock_quantity: 1,
    affiliate_enabled: false, is_promotable: false, direct_marketplace_listing: true,
  };

  it('allows a direct marketplace purchase without allowing affiliate promotion', () => {
    expect(isPublicMarketplaceProduct(item)).toBe(true);
    expect(isPublicAffiliateProduct(item)).toBe(false);
    expect(isPublicMarketplaceProduct({ ...item, status: 'store_only' })).toBe(false);
    expect(isPublicMarketplaceProduct({ ...item, stock_quantity: 0 })).toBe(false);
  });

  it('distinguishes used condition from merchandise types', () => {
    const vintage = { item_condition: 'Good', merchandise_types: ['Vintage'] };
    expect(matchesMerchandiseFilter(vintage, 'Used')).toBe(true);
    expect(matchesMerchandiseFilter(vintage, 'New')).toBe(false);
    expect(matchesMerchandiseFilter(vintage, 'Vintage')).toBe(true);
    expect(matchesMerchandiseFilter({}, 'Used')).toBe(false);
  });
});

it('covers a one-dollar seller payout and the existing fee allowances', () => {
  const quote = computeFixedTierPricing({ sellerPayout: 1, affiliatePayout: 0, shippingIncluded: 0 });
  expect(quote.sellerPayout).toBe(1);
  expect(quote.affiliatePayout).toBe(0);
  expect(quote.platformFee).toBeGreaterThan(0);
  expect(quote.influencerAllocation).toBeGreaterThan(0);
  expect(quote.paypalProcessingAllowance).toBeGreaterThan(0);
  expect(quote.finalAdvertisedPrice).toBeGreaterThanOrEqual(
    quote.sellerPayout + quote.platformFee + quote.influencerAllocation + quote.paypalProcessingAllowance,
  );
});
