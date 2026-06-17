import { describe, expect, it } from 'vitest';
import { finalizePayPalOrderPayment } from './paypal-order-finalization';

class MockQuery {
  private filters: Record<string, unknown> = {};
  private pendingInsert: any[] | null = null;
  private pendingUpdate: Record<string, any> | null = null;
  constructor(private table: string, private store: Record<string, any[]>) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  limit() { return this; }
  order() { return this; }
  insert(payload: any) {
    const rows = Array.isArray(payload) ? payload : [payload];
    this.pendingInsert = rows.map((row, index) => ({
      id: row?.id || `${this.table}-${(this.store[this.table] || []).length + index + 1}`,
      ...row,
    }));
    this.store[this.table] = [...(this.store[this.table] || []), ...this.pendingInsert];
    return this;
  }
  upsert(payload: any) {
    return this.insert(payload);
  }
  update(payload: Record<string, any>) {
    this.pendingUpdate = payload;
    return this;
  }
  async maybeSingle() {
    if (this.pendingInsert) {
      return { data: this.pendingInsert[0] ?? null, error: null };
    }
    if (this.pendingUpdate) {
      const rows = this.matchRows();
      rows.forEach((row) => Object.assign(row, this.pendingUpdate));
      return { data: rows[0] ?? null, error: null };
    }
    const row = this.matchRows()[0] ?? null;
    return { data: row, error: null };
  }
  async then(resolve: any) {
    if (this.pendingInsert) return resolve({ data: this.pendingInsert, error: null });
    if (this.pendingUpdate) {
      const rows = this.matchRows();
      rows.forEach((row) => Object.assign(row, this.pendingUpdate));
      return resolve({ data: rows, error: null });
    }
    return resolve({ data: this.matchRows(), error: null });
  }
  private matchRows() {
    return (this.store[this.table] || []).filter((row) =>
      Object.entries(this.filters).every(([key, value]) => String((row as any)?.[key] ?? '') === String(value ?? ''))
    );
  }
}

function createSupabaseMock(seed?: Partial<Record<string, any[]>>) {
  const store: Record<string, any[]> = {
    influencer_referrals: [],
    payout_ledger: [],
    payout_snapshots: [],
    order_money_ledger: [],
    orders: [],
    order_items: [],
    profiles: [],
    ...(seed || {}),
  };
  const rpcCalls: Array<{ fn: string; payload: any }> = [];

  return {
    store,
    rpcCalls,
    from(table: string) {
      return new MockQuery(table, store);
    },
    async rpc(fn: string, payload: any) {
      rpcCalls.push({ fn, payload });
      if (fn === 'record_paypal_order_finalization') {
        store.payout_ledger.push({
          id: 'ledger-1',
          order_id: payload.p_order_id,
          hold_release_at: payload.p_hold_release_at,
          status: payload.p_ledger_totals?.status || 'PENDING_HOLD',
        });
        store.payout_snapshots.push(
          ...((payload.p_snapshots || []).map((snapshot: any, index: number) => ({
            id: `snapshot-${index + 1}`,
            order_id: payload.p_order_id,
            ledger_id: 'ledger-1',
            ...snapshot,
          })))
        );
      }
      return { data: { ok: true, ledger_id: 'ledger-1' }, error: null };
    },
  };
}

describe('finalizePayPalOrderPayment', () => {
  it('is idempotent for duplicate webhook or refresh-after-payment calls', async () => {
    const supabase = createSupabaseMock({
      payout_snapshots: [
        { id: 'snap-1', order_id: 'order-1', payee_user_id: 'seller-1', payee_role: 'SELLER', amount: 100, status: 'PENDING_HOLD', hold_release_at: '2026-04-10T12:00:00.000Z' },
      ],
      order_money_ledger: [
        { id: 'money-1', order_id: 'order-1' },
      ],
    });

    const result = await finalizePayPalOrderPayment({
      supabaseAdmin: supabase,
      orderId: 'order-1',
      providerOrderId: 'paypal-order-1',
      providerCaptureId: 'capture-1',
      paidAt: '2026-03-27T12:00:00.000Z',
    });

    expect(result.idempotent).toBe(true);
    expect(supabase.rpcCalls).toHaveLength(0);
  });

  it('builds frozen payee snapshots and sends them through the RPC payload', async () => {
    const supabase = createSupabaseMock({
      orders: [
        {
          id: 'order-1',
          seller_id: 'seller-1',
          partner_id: 'partner-1',
          influencer_id: null,
          currency: 'USD',
          subtotal_listing: 120,
          shipping_amount: 0,
          tax_amount: 0,
          total_charged: 120,
        },
      ],
      order_items: [
        {
          id: 'item-1',
          order_id: 'order-1',
          quantity: 1,
          product_id: 'product-1',
          variant_id: 'variant-1',
          seller_ask_amount: 100,
          partner_rate: 0.1,
          computed_listing_price: 120,
          products: { title: 'Standard product' },
        },
      ],
      profiles: [
        { id: 'seller-1', recruited_by_influencer_id: 'influencer-1', role: 'seller', primary_role: 'seller' },
        { id: 'partner-1', recruited_by_influencer_id: 'influencer-2', role: 'partner', primary_role: 'partner' },
      ],
      influencer_referrals: [
        { recruited_profile_id: 'seller-1', recruited_role: 'seller', influencer_profile_id: 'influencer-1' },
        { recruited_profile_id: 'partner-1', recruited_role: 'affiliate', influencer_profile_id: 'influencer-2' },
      ],
    });

    const result = await finalizePayPalOrderPayment({
      supabaseAdmin: supabase,
      orderId: 'order-1',
      providerOrderId: 'paypal-order-1',
      providerCaptureId: 'capture-1',
      paidAt: '2026-03-27T12:00:00.000Z',
    });

    expect(result.idempotent).toBe(false);
    expect(supabase.rpcCalls).toHaveLength(1);
    expect(supabase.rpcCalls[0].fn).toBe('record_paypal_order_finalization');
    expect(supabase.rpcCalls[0].payload.p_snapshots).toHaveLength(4);
    expect(supabase.rpcCalls[0].payload.p_snapshots.every((row: any) => row.provider_capture_id === 'capture-1')).toBe(true);
    expect(supabase.rpcCalls[0].payload.p_snapshots.every((row: any) => row.hold_release_at === row.snapshot_json.hold_release_at)).toBe(true);
    expect(
      supabase.rpcCalls[0].payload.p_snapshots.filter((row: any) => row.payee_role === 'INFLUENCER')
    ).toHaveLength(2);
  });
});
