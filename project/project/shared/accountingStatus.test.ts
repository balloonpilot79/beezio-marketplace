import { describe, expect, it } from 'vitest';
import { annotateReversedEarnings, isConfirmedPaidOrder, summarizeEarningActivity } from './accountingStatus';
import { summarizeAccountingReportRows } from './accountingReport';
import { readAccountingPages } from '../netlify/functions/_lib/accounting-pagination';
import { summarizePayeeSnapshots } from '../server/payments/paypalPayoutLedger';
describe('one consistent accounting state across roles', () => {
  it.each(['pending','processing','failed','refunded','canceled'])('does not treat %s payments as paid even with a completed order flag', payment_status => {
    expect(isConfirmedPaidOrder({status:'completed',payment_status,provider_capture_id:'capture'})).toBe(false);
  });
  it('accepts a recorded capture for a legacy order lacking payment_status', () => {
    expect(isConfirmedPaidOrder({status:'completed',provider_capture_id:'capture'})).toBe(true);
    expect(isConfirmedPaidOrder({status:'processing'})).toBe(false);
  });
  it('counts one influenced sale with both referral slots while excluding canceled earnings', () => {
    const rows = [{id:'seller-slot',order_id:'one',amount:1,status:'PENDING_HOLD',created_at:'2026-10-01T12:00:00Z'}, {id:'affiliate-slot',order_id:'one',amount:1,status:'PAID',created_at:'2026-10-01T12:00:00Z'}, {id:'reversed',order_id:'two',amount:100,status:'CANCELED',created_at:'2026-10-01T12:00:00Z'}];
    expect(summarizeEarningActivity(rows,new Date('2026-10-01T15:00:00Z'))).toMatchObject({total_sales:1,today_sales:1,total_earned:2,today_earned:2});
  });
  it('removes refunded paid earnings from net earnings without rewriting transfer history', () => {
    const rows = annotateReversedEarnings([{order_id:'one',amount:5,status:'PAID'}],[{id:'one',payment_status:'refunded'}]);
    expect(rows[0].status).toBe('PAID'); expect(summarizePayeeSnapshots(rows).total).toBe(0);
  });
  it('counts refunds separately and exposes negative Beezio net revenue', () => {
    const summary = summarizeAccountingReportRows([{is_counted_sale:false,is_refunded:true,refunded_amount:50,beezio_net_revenue:-2,paypal_fee:2}, {is_counted_sale:false,is_refunded:false,gross_sales:100}]);
    expect(summary).toMatchObject({orders:1,real_sales:0,gross_sales:0,refunded_orders:1,refunded_amount:50,beezio_net_revenue:-2});
  });
  it('fails rather than claiming a partial balance when pagination fails', async () => {
    await expect(readAccountingPages(async from => from ? {data:null,error:new Error('database disconnected')} : {data:Array(500).fill({}),error:null})).rejects.toThrow('database disconnected');
  });
});
