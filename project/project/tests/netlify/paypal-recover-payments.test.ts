import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ recover: vi.fn(), rows: {} as Record<string, any[]>, writes: [] as any[], auth: vi.fn() }));
vi.mock('../../netlify/functions/_lib/paypal-payment-recovery', () => ({ recoverCompletedPayPalPayment: state.recover }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ requireAdmin: state.auth }));
vi.mock('../../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: () => ({ from: (table: string) => {
  const q: any = { select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q, limit: () => q,
    insert: (row: any) => { state.writes.push(row); return q; },
    then: (resolve: any) => resolve({ data: state.rows[table] || [], error: null }),
  }; return q;
} }) }));
import recover, { config } from '../../netlify/functions/paypal-recover-payments';
import monitor from '../../netlify/functions/admin-payment-recovery';
const paymentEvent = (id: string) => ({ raw_json: { resource: { id: `capture-${id}`, supplementary_data: { related_ids: { order_id: id } } } } });
describe('independent beta payment backup', () => {
  beforeEach(() => {
    state.recover.mockReset().mockResolvedValue({ ok: true });
    state.auth.mockReset().mockResolvedValue({}); state.writes = [];
    state.rows = { paypal_webhook_events: [paymentEvent('paypal-order')], orders: [{ id: 'order', provider_order_id: 'paypal-order', payment_status: 'paid' }] };
  });
  it('repairs missing accounting on a ten-minute schedule', async () => {
    expect(config.schedule).toBe('*/10 * * * *');
    await recover(); expect(state.recover).toHaveBeenCalledTimes(1);
  });
  it('does not repeat fully mirrored payments', async () => {
    state.rows.order_money_ledger = [{ order_id: 'order' }]; state.rows.payout_snapshots = [{ order_id: 'order' }];
    await recover(); expect(state.recover).not.toHaveBeenCalled();
  });
  it('records a manual review incident if recovery fails', async () => {
    state.recover.mockRejectedValue(new Error('database unavailable'));
    await recover(); expect(state.writes).toContainEqual(expect.objectContaining({ action: 'payment_recovery_required', metadata: expect.objectContaining({ provider_order_id: 'paypal-order' }) }));
  });
  it('limits one scheduled run to ten recovery attempts', async () => {
    state.rows.paypal_webhook_events = Array.from({ length: 15 }, (_, i) => paymentEvent(String(i)));
    await recover(); expect(state.recover).toHaveBeenCalledTimes(10);
  });
  it('rotates past permanently failing candidates on later runs', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      state.rows.paypal_webhook_events = Array.from({ length: 20 }, (_, i) => paymentEvent(String(i)));
      state.recover.mockRejectedValue(new Error('invalid saved order'));
      await recover();
      clock.mockReturnValue(600000);
      await recover();
      const attempted = new Set(state.recover.mock.calls.map(([arg]) => arg.resource.id));
      expect(attempted.size).toBe(20);
    } finally { clock.mockRestore(); }
  });
  it('blocks payment history for unauthorized users', async () => {
    state.auth.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    const response = await monitor(new Request('https://example.test/api/admin-payment-recovery'));
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
