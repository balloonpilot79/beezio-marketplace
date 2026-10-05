import { describe, expect, it } from 'vitest';
import { computeFixedTierPricing } from '../../shared/customerPrice';
import { buildPayPalLedgerPlan, summarizePayeeSnapshots } from './paypalPayoutLedger';

const makeInput = (overrides: Record<string, unknown> = {}) => {
  const pricing = computeFixedTierPricing({ supplierCost: 23.8, sellerMarkup: 10, affiliatePayout: 5, shippingIncluded: 6.2 });
  return { orderId:'order-1', currency:'USD', providerOrderId:'paypal-order-1', providerCaptureId:'capture-1', paidAt:'2026-03-27T12:00:00.000Z', holdReleaseAt:'2026-04-10T12:00:00.000Z', sellerId:'seller-1', partnerId:'affiliate-1', sellerInfluencerId:'influencer-1', partnerInfluencerId:'influencer-2', subtotalListing:pricing.finalAdvertisedPrice, shippingAmount:0, taxAmount:0, items:[{id:'item-1',quantity:1,seller_ask_amount:pricing.sellerPayout,partner_rate:pricing.affiliatePayout/pricing.sellerPayout,computed_listing_price:pricing.finalAdvertisedPrice,supplier_cost_amount:pricing.supplierCost,seller_markup_amount:pricing.sellerMarkup,affiliate_payout_amount:pricing.affiliatePayout,shipping_reserve_amount:pricing.shippingIncluded,influencer_allocation_amount:pricing.influencerAllocation,platform_fee_amount:pricing.platformFee,paypal_processing_allowance:pricing.paypalProcessingAllowance,product_title:'Fixed-tier product',product_id:'product-1'}],...overrides };
};

describe('buildPayPalLedgerPlan fixed-tier accounting', () => {
  it('preserves every seller-controlled payout bucket',()=>{const plan=buildPayPalLedgerPlan(makeInput());expect(plan.aggregate.sellerEarnings).toBe(40);expect(plan.aggregate.partnerEarnings).toBe(5);expect(plan.aggregate.influencerEarnings).toBe(2);expect(plan.aggregate.beezioFeeGross).toBe(2);expect(plan.aggregate.beezioFeeNet).toBe(2);expect(plan.payees.map(row=>`${row.payeeRole}:${row.amount}`)).toEqual(['SELLER:40','PARTNER:5','INFLUENCER:1','INFLUENCER:1']);});
  it('keeps each unfilled influencer slot with Beezio',()=>{const plan=buildPayPalLedgerPlan(makeInput({sellerInfluencerId:null,partnerInfluencerId:null}));expect(plan.aggregate.influencerEarnings).toBe(0);expect(plan.aggregate.notes).toContain('influencer_bonus_retained_total=2.00');expect(plan.aggregate.beezioProfit).toBe(4.01);});
  it('retains the fixed affiliate allocation for a direct marketplace purchase',()=>{const plan=buildPayPalLedgerPlan(makeInput({partnerId:null,affiliateSource:'beezio',sellerInfluencerId:null,partnerInfluencerId:null}));expect(plan.aggregate.partnerEarnings).toBe(0);expect(plan.aggregate.beezioProfit).toBe(9.01);expect(plan.aggregate.notes).toContain('affiliate_payout_retained_total=5.00');expect(plan.aggregate.notes).toContain('affiliate_source=beezio');expect(plan.moneyEntries.find(row=>row.payeeType==='affiliate')).toBeUndefined();expect(plan.moneyEntries.find(row=>row.payeeType==='beezio')?.metadata.affiliate_payout_retained_total).toBe(5);});
  it('rolls the affiliate allocation into the seller payout for a seller self-sale',()=>{const plan=buildPayPalLedgerPlan(makeInput({partnerId:'seller-1',affiliateSource:'seller_self',sellerInfluencerId:null,partnerInfluencerId:null}));expect(plan.aggregate.sellerEarnings).toBe(45);expect(plan.aggregate.partnerEarnings).toBe(0);expect(plan.payees.map(row=>`${row.payeeRole}:${row.amount}`)).toEqual(['SELLER:45']);expect(plan.aggregate.notes).toContain('affiliate_payout_paid_to_seller_total=5.00');expect(plan.moneyEntries.find(row=>row.payeeType==='affiliate' && row.payeeId==='seller-1')?.grossAmount).toBe(5);});
  it('uses the final advertised price for the under-$20 influencer tier',()=>{const pricing=computeFixedTierPricing({sellerPayout:15});const plan=buildPayPalLedgerPlan(makeInput({partnerId:null,partnerInfluencerId:null,subtotalListing:pricing.finalAdvertisedPrice,items:[{id:'item-low',quantity:1,seller_ask_amount:15,partner_rate:0,computed_listing_price:pricing.finalAdvertisedPrice,affiliate_payout_amount:0,shipping_reserve_amount:0,influencer_allocation_amount:pricing.influencerAllocation,platform_fee_amount:pricing.platformFee,paypal_processing_allowance:pricing.paypalProcessingAllowance}]}));expect(pricing.finalAdvertisedPrice).toBeLessThan(20);expect(plan.aggregate.influencerEarnings).toBe(0.5);expect(plan.aggregate.beezioFeeGross).toBe(2);});
  it('uses the full tax-inclusive capture amount for actual PayPal cost',()=>{const plan=buildPayPalLedgerPlan(makeInput({taxAmount:3.62,paypalFeeAmount:null}));expect(plan.aggregate.paypalFeeEstimate).toBe(2.81);expect(plan.aggregate.sellerEarnings).toBe(40);expect(plan.aggregate.partnerEarnings).toBe(5);expect(plan.aggregate.beezioFeeNet).toBe(2);});
  it('uses PayPal capture fee data without reducing platform earnings',()=>{const plan=buildPayPalLedgerPlan(makeInput({paypalFeeAmount:3.12}));expect(plan.aggregate.paypalFeeEstimate).toBe(3.12);expect(plan.aggregate.beezioFeeGross).toBe(2);expect(plan.aggregate.beezioFeeNet).toBe(2);expect(plan.moneyEntries.find(row=>row.payeeType==='processor_fee')?.grossAmount).toBe(3.12);});
  it('freezes itemized cost, markup, shipping, affiliate, and fee data',()=>{const plan=buildPayPalLedgerPlan(makeInput());const snapshot=plan.payees[0].snapshot as any;expect(snapshot.items[0]).toMatchObject({supplier_cost_amount:23.8,seller_markup_amount:10,shipping_reserve_amount:6.2,partner_line_total:5,beezio_fee_gross_line_total:2});expect(snapshot.provider_capture_id).toBe('capture-1');});
});

describe('summarizePayeeSnapshots',()=>{const rows=[{payee_user_id:'seller-1',payee_role:'SELLER' as const,amount:100,status:'PENDING_HOLD',hold_release_at:'2026-04-10T12:00:00.000Z'},{payee_user_id:'seller-1',payee_role:'SELLER' as const,amount:25,status:'READY_TO_PAY',hold_release_at:'2026-04-01T12:00:00.000Z'},{payee_user_id:'seller-1',payee_role:'SELLER' as const,amount:15,status:'PAID',paid_at:'2026-04-15T12:00:00.000Z'},{payee_user_id:'seller-1',payee_role:'SELLER' as const,amount:10,status:'ON_HOLD_DISPUTE'}];it('splits pending, on-hold, available, and paid totals',()=>{expect(summarizePayeeSnapshots(rows,'seller-1','SELLER')).toEqual({pending:100,onHold:10,available:25,paid:15,nextReleaseAt:'2026-04-10T12:00:00.000Z',total:150});});it('is idempotent and excludes canceled rows',()=>{const withCanceled=[...rows,{payee_user_id:'seller-1',payee_role:'SELLER' as const,amount:40,status:'CANCELED'}];const first=summarizePayeeSnapshots(withCanceled,'seller-1','SELLER');const second=summarizePayeeSnapshots(withCanceled,'seller-1','SELLER');expect(second).toEqual(first);expect(second.total).toBe(150);});});

describe('all-party conservation of buyer funds', () => {
  it.each([
    { partnerId:'affiliate-1',sellerInfluencerId:'influencer-1',partnerInfluencerId:'influencer-2' },
    { partnerId:null,sellerInfluencerId:null,partnerInfluencerId:null },
    { partnerId:'seller-1',affiliateSource:'seller_self',sellerInfluencerId:'influencer-1',partnerInfluencerId:'influencer-1' },
    { paypalFeeAmount:8 },
    { shippingAmount:5,taxAmount:3.62 },
  ])('allocates exactly the customer charge across seller, affiliate, influencer, Beezio, tax, and PayPal: %j', overrides => {
    const input = makeInput(overrides); const plan = buildPayPalLedgerPlan(input);
    const allocated = Math.round(plan.moneyEntries.reduce((sum, entry) => sum + entry.netAmount, 0) * 100) / 100;
    expect(allocated).toBe(Math.round((input.subtotalListing + input.shippingAmount + input.taxAmount) * 100) / 100);
    expect(plan.moneyEntries.find(row => row.payeeType === 'shipping')?.netAmount).toBe(0);
    const sellerMoney = plan.moneyEntries.filter(row => row.payeeType === 'seller' || (row.payeeType === 'affiliate' && row.payeeId === input.sellerId)).reduce((sum,row) => sum + row.netAmount,0);
    expect(Math.round(sellerMoney * 100)/100).toBe(plan.aggregate.sellerEarnings);
  });
  it('records an actual processing-cost overrun against Beezio profit without reducing promised role payouts', () => {
    const normal = buildPayPalLedgerPlan(makeInput()); const expensive = buildPayPalLedgerPlan(makeInput({paypalFeeAmount:8}));
    expect(expensive.aggregate.sellerEarnings).toBe(normal.aggregate.sellerEarnings);
    expect(expensive.aggregate.partnerEarnings).toBe(normal.aggregate.partnerEarnings);
    expect(expensive.aggregate.influencerEarnings).toBe(normal.aggregate.influencerEarnings);
    expect(expensive.aggregate.beezioProfit).toBeLessThan(normal.aggregate.beezioProfit);
  });
});

describe('shipping charged separately', () => {
  it.each([1, 3])('preserves all payouts and reconciles the order with quantity %s', quantity => {
    const input = makeInput();
    input.items[0].quantity = quantity;
    input.subtotalListing = Math.round((input.subtotalListing - 6.2) * quantity * 100) / 100;
    input.shippingAmount = 6.2 * quantity;
    const plan = buildPayPalLedgerPlan(input);
    const legacy = makeInput();
    legacy.items[0].quantity = quantity;
    legacy.subtotalListing *= quantity;
    const original = buildPayPalLedgerPlan(legacy);
    expect(plan.aggregate).toEqual({ ...original.aggregate, grossAmount: input.subtotalListing });
    expect(plan.moneyEntries.filter(row => row.payeeType === 'seller')).toEqual(original.moneyEntries.filter(row => row.payeeType === 'seller'));
    const allocated = plan.moneyEntries.reduce((total, row) => total + row.netAmount, 0);
    expect(Math.round(allocated * 100) / 100).toBe(Math.round((input.subtotalListing + input.shippingAmount) * 100) / 100);
    expect(plan.payees[0].snapshot.subtotal_listing).toBe(input.subtotalListing);
    expect(plan.payees[0].snapshot.shipping_amount).toBe(input.shippingAmount);
  });
});


describe('platform affordability policy', () => {
  it.each([3, 10, 25, 75, 150, 500])('keeps all promised payouts covered for seller ask $%s', sellerAsk => {
    const pricing = computeFixedTierPricing({ sellerPayout: sellerAsk, affiliatePayout: 0.5, shippingIncluded: 4 });
    const input = makeInput({ subtotalListing: pricing.finalAdvertisedPrice, items: [{ quantity: 1, seller_ask_amount: sellerAsk, computed_listing_price: pricing.finalAdvertisedPrice, affiliate_payout_amount: 0.5, shipping_reserve_amount: 4, influencer_allocation_amount: pricing.influencerAllocation, platform_fee_amount: pricing.platformFee, paypal_processing_allowance: pricing.paypalProcessingAllowance }] });
    const plan = buildPayPalLedgerPlan(input);
    expect(plan.aggregate.sellerEarnings).toBe(sellerAsk + 4);
    expect(plan.aggregate.partnerEarnings).toBe(0.5);
    expect(plan.aggregate.influencerEarnings).toBe(pricing.influencerAllocation);
    expect(plan.aggregate.beezioProfit).toBeGreaterThanOrEqual(pricing.platformFee);
    expect(Math.round(plan.moneyEntries.reduce((sum, row) => sum + row.netAmount, 0) * 100) / 100).toBe(pricing.finalAdvertisedPrice);
  });
  it('honors the original fee and payouts on previously placed orders', () => {
    const input = makeInput({ subtotalListing: 51.67 });
    input.items[0].computed_listing_price = 51.67;
    input.items[0].platform_fee_amount = 2;
    input.items[0].paypal_processing_allowance = 2.67;
    const plan = buildPayPalLedgerPlan(input);
    expect(plan.aggregate.beezioFeeGross).toBe(2);
    expect(plan.aggregate.sellerEarnings).toBe(40);
    expect(plan.aggregate.partnerEarnings).toBe(5);
    expect(plan.aggregate.influencerEarnings).toBe(2);
  });
});
