import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, pageFailure: '', authed: true }));
class Query {
  filters: Array<(row: any) => boolean> = []; offset = 0; count = Infinity; sorting: Array<[string, boolean]> = [];
  constructor(public table: string) {}
  select() { return this; }
  eq(key: string, value: any) { this.filters.push(row => row[key] === value); return this; }
  in(key: string, values: any[]) { this.filters.push(row => values.includes(row[key])); return this; }
  or(value: string) { this.filters.push(row => value.split(',').some(clause => { const [key, , match] = clause.split('.'); return String(row[key]) === match; })); return this; }
  gte(key: string, value: any) { this.filters.push(row => row[key] >= value); return this; }
  lte(key: string, value: any) { this.filters.push(row => row[key] <= value); return this; }
  order(key: string, options: any = {}) { this.sorting.push([key, options.ascending !== false]); return this; }
  limit(count: number) { this.count = count; return this; }
  range(from: number, to: number) { this.offset = from; this.count = to - from + 1; return this; }
  then(resolve: any) {
    if (this.table === state.pageFailure && this.offset >= 500) return Promise.resolve(resolve({ error: new Error('later page failed'), data: null }));
    const rows = (state.tables[this.table] || []).filter(row => this.filters.every(filter => filter(row)));
    rows.sort((a, b) => { for (const [key, asc] of this.sorting) { const n = String(a[key] || '').localeCompare(String(b[key] || '')); if (n) return asc ? n : -n; } return 0; });
    return Promise.resolve(resolve({ data: rows.slice(this.offset, this.offset + this.count), error: null }));
  }
}
const db = { from: (table: string) => new Query(table), auth: { getUser: async () => ({ data: { user: state.authed ? { id: 'auth-user' } : null }, error: null }) } };
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
vi.mock('../../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: () => db }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireSellerOrAdmin: async () => {}, extractAuthHeader: () => 'Bearer test', getAuthedUser: async () => ({ user: { id: 'auth-user' } }) }));
vi.mock('../../netlify/functions/_lib/owned-profiles', () => ({ resolveOwnedProfileIdsForUser: async () => ['auth-user','profile'] }));
import { handler as earnings } from '../../netlify/functions/user-earnings';
import { handler as seller } from '../../netlify/functions/seller-dashboard-sales';
import { handler as buyer } from '../../netlify/functions/buyer-orders';
import { buildAdminSalesLedgerReport } from '../../netlify/functions/_lib/adminSalesLedgerReport';
const invoke = async (fn: any, body = {}, httpMethod = 'POST') => {
  const result = await fn({ httpMethod, headers: { authorization: 'Bearer test' }, body: JSON.stringify(body) }, {}, () => {});
  return { status: result.statusCode, body: JSON.parse(result.body) };
};
const snapshot = (id: string, amount: number, role = 'SELLER', extra = {}) => ({ id, order_id: 'order', payee_user_id: 'profile', payee_role: role, amount, status: 'PENDING_HOLD', created_at: '2026-10-01T12:00:00Z', ...extra });
describe('dashboard accounting endpoints', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
    state.authed = true; state.pageFailure = '';
    state.tables = { profiles: [{ id: 'profile', user_id: 'auth-user' }, { id: 'unrelated-profile', user_id: 'other-user' }],
      orders: [{ id: 'order', seller_id: 'profile', buyer_id: 'auth-user', payment_status: 'paid', status: 'completed', total_charged: 100, tax_amount: 0, created_at: '2026-10-01T12:00:00Z' }],
      products: [{ id: 'product', seller_id: 'profile' }], order_items: [{ id: 'item', order_id: 'order', seller_id: 'profile', product_id: 'product', quantity: 2, computed_listing_price: 50 }],
      payout_snapshots: [snapshot('seller',30),snapshot('affiliate',5,'PARTNER'),snapshot('influencer-seller',1,'INFLUENCER'),snapshot('influencer-partner',1,'INFLUENCER')] };
  });
  it('returns each role separately while grouping two influencer slots into one sale', async () => {
    expect((await invoke(earnings,{ role:'seller' })).body.earnings.total_earned).toBe(30);
    expect((await invoke(earnings,{ role:'affiliate' })).body.earnings.total_earned).toBe(5);
    const result = await invoke(earnings,{ role:'influencer' });
    expect(result.body.earnings.total_earned).toBe(2); expect(result.body.activity.total_sales).toBe(1);
  });
  it('includes legacy auth-ID earnings without exposing someone else’s balance', async () => {
    state.tables.payout_snapshots.push(snapshot('alias',7,'SELLER',{ payee_user_id:'auth-user' }),snapshot('stranger',999,'SELLER',{ payee_user_id:'unrelated-profile' }));
    expect((await invoke(earnings,{ role:'seller' })).body.earnings.total_earned).toBe(37);
  });
  it('does not truncate balances or history at 500 records', async () => {
    state.tables.payout_snapshots = Array.from({length:501},(_,i)=>snapshot(String(i),0.01));
    const result = await invoke(earnings,{role:'seller'});
    expect(result.body.earnings.total_earned).toBe(5.01); expect(result.body.earnings_history).toHaveLength(501);
  });
  it('reports unavailable totals if a later financial page fails', async () => {
    state.tables.payout_snapshots = Array.from({length:501},(_,i)=>snapshot(String(i),1)); state.pageFailure = 'payout_snapshots';
    expect((await invoke(earnings,{role:'seller'})).status).toBe(500);
  });
  it('preserves paid transfer history but excludes earnings from subsequently refunded orders', async () => {
    state.tables.orders[0].payment_status = 'refunded';
    state.tables.payout_snapshots[0].status = 'PAID';
    const result = await invoke(earnings,{role:'seller'});
    expect(result.body.earnings).toMatchObject({total_earned:0,paid_out:30,refunded_after_payout:30,current_balance:0,held_balance:0});
  });
  it('rejects unauthenticated balance access', async () => {
    state.authed = false; expect((await invoke(earnings,{role:'seller'})).status).toBe(401);
  });
  it('uses seller snapshots rather than the buyer’s full checkout amount, without counting an item twice', async () => {
    const result = await invoke(seller);
    expect(result.body.summary).toMatchObject({total_sales:1,total_revenue:30});
    expect(result.body.orders[0].order_items).toHaveLength(1);
  });
  it('does not count unpaid attempts as seller revenue', async () => {
    state.tables.orders[0].payment_status = 'pending';
    const result = await invoke(seller); expect(result.body.summary).toMatchObject({total_sales:0,total_revenue:0});
  });
  it('shows buyers the frozen checkout price for each item', async () => {
    const result = await invoke(buyer, {}, 'GET');
    expect(result.body.orders[0]).toMatchObject({total_amount:100,items:[expect.objectContaining({unit_price:50,line_total:100})]});
  });
  it('does not resurrect fully reversed zero money amounts from old ledger totals', async () => {
    state.tables.payout_ledger = [{ id:'ledger',order_id:'order',seller_earnings:30,partner_earnings:5,influencer_earnings:2,paypal_fee_estimate:3 }];
    state.tables.order_money_ledger = [{id:'entry',order_id:'order',payee_type:'seller',payee_id:'profile',gross_amount:30,net_amount:0}];
    const result = await buildAdminSalesLedgerReport({}); expect(result.rows[0].seller.amount).toBe(0);
  });
  it('groups the affiliate allocation paid to the seller into the seller’s admin total', async () => {
    state.tables.order_money_ledger = [{id:'seller',order_id:'order',payee_type:'seller',payee_id:'profile',net_amount:30}, {id:'self-affiliate',order_id:'order',payee_type:'affiliate',payee_id:'profile',net_amount:5}];
    const result = await buildAdminSalesLedgerReport({}); expect(result.rows[0].seller.amount).toBe(35); expect(result.rows[0].affiliate.amount).toBe(0);
  });
});
