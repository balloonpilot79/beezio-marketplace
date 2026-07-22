import { describe, expect, it } from 'vitest';
import { finalizePayPalOrderPayment } from './paypal-order-finalization';

class MockQuery {
  private filters: Record<string, unknown> = {};
  private inFilters: Record<string, unknown[]> = {};
  private pendingInsert: any[] | null = null;
  private pendingUpdate: Record<string, any> | null = null;
  constructor(private table: string, private store: Record<string, any[]>) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  in(column: string, values: unknown[]) { this.inFilters[column] = values; return this; }
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
  upsert(payload: any, options?: { onConflict?: string }) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const conflictKeys = String(options?.onConflict || '').split(',').map((key) => key.trim()).filter(Boolean);
    const affected: any[] = [];
    for (const row of rows) {
      const existing = conflictKeys.length
        ? (this.store[this.table] || []).find((candidate) =>
            conflictKeys.every((key) => String(candidate?.[key] ?? '') === String(row?.[key] ?? ''))
          )
        : null;
      if (existing) {
        Object.assign(existing, row);
        affected.push(existing);
      } else {
        const inserted = {
          id: row?.id || `${this.table}-${(this.store[this.table] || []).length + 1}`,
          ...row,
        };
        this.store[this.table] = [...(this.store[this.table] || []), inserted];
        affected.push(inserted);
      }
    }
    this.pendingInsert = affected;
    return this;
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
      && Object.entries(this.inFilters).every(([key, values]) =>
        values.some((value) => String((row as any)?.[key] ?? '') === String(value ?? ''))
      )
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
    user_roles: [],
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
  it('reconciles the complete ledger for a duplicate webhook instead of returning a false success', async () => {
    const supabase = createSupabaseMock({
      orders: [
        {
          id: 'order-1',
          seller_id: 'seller-1',
          partner_id: null,
          influencer_id: null,
          currency: 'USD',
          subtotal_listing: 100,
          shipping_amount: 0,
          tax_amount: 0,
          total_charged: 100,
        },
      ],
      order_items: [
        {
          id: 'item-1',
          order_id: 'order-1',
          quantity: 1,
          product_id: 'product-1',
          variant_id: null,
          seller_ask_amount: 100,
          partner_rate: 0,
          computed_listing_price: 100,
          product_title_snapshot: 'Frozen product',
          products: { title: 'Edited product' },
        },
      ],
      profiles: [
        { id: 'seller-1', role: 'seller', primary_role: 'seller' },
      ],
      payout_ledger: [
        { id: 'ledger-1', order_id: 'order-1', status: 'PENDING_HOLD', hold_release_at: '2026-04-10T12:00:00.000Z' },
      ],
      payout_snapshots: [
        { id: 'snap-1', order_id: 'order-1', ledger_id: 'ledger-1', payee_user_id: 'seller-1', payee_role: 'SELLER', amount: 100, status: 'PENDING_HOLD', hold_release_at: '2026-04-10T12:00:00.000Z' },
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
    expect(result.repaired).toBe(true);
    expect(supabase.rpcCalls).toHaveLength(0);
    expect(supabase.store.orders[0].status).toBe('completed');
    expect(supabase.store.payout_snapshots).toHaveLength(1);
    expect(supabase.store.order_money_ledger.length).toBeGreaterThan(1);
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
