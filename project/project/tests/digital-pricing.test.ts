import {describe,it,expect} from 'vitest';
import {computeFixedTierPricing} from '../shared/customerPrice';
import {getProductShipping} from '../shared/productShipping';
describe('digital pricing uses standard fee schedule',()=>{
 it.each([1,20,25,30,45,50,75,100,500,1000])('balances seller, affiliate, referral, platform and processing at $%s ask',ask=>{
  const p=computeFixedTierPricing({sellerPayout:ask,affiliatePayout:4,shippingIncluded:0,estimatedTaxRate:.07});
  const feeSum=Math.round((p.sellerPayout+p.affiliatePayout+p.influencerAllocation+p.platformFee+p.paypalProcessingAllowance)*100);
  expect(Math.round(p.finalAdvertisedPrice*100)-feeSum).toBeGreaterThanOrEqual(0);
  expect(Math.round(p.finalAdvertisedPrice*100)-feeSum).toBeLessThanOrEqual(1); // Existing advertised-price rounding reserve.
  expect(p.sellerPayout).toBe(ask);expect(p.affiliatePayout).toBe(4);expect(p.shippingIncluded).toBe(0);expect(p.platformFee).toBeGreaterThanOrEqual(ask <= 5 ? 0.75 : 1.25);
  expect(p.paypalProcessingAllowance).toBeGreaterThanOrEqual((p.finalAdvertisedPrice+p.estimatedSalesTax)*.0399+.6-.011);
 });
 it('never charges digital shipping even when stale amounts are present',()=>expect(getProductShipping({is_digital:true,shipping_cost:15,shipping_price:15,shipping_reserve_amount:15})).toBe(0));
});
