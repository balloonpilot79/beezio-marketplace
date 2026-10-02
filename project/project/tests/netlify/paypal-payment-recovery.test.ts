import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ finalize: vi.fn(), order: {} as any, updateError: null as any, duplicate: false }));
vi.mock('../../netlify/functions/_lib/paypal-order-finalization', () => ({ finalizePayPalOrderPayment: state.finalize }));
vi.mock('../../netlify/functions/_lib/paypal', () => ({ verifyPayPalWebhookSignature: async () => true }));
vi.mock('../../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: () => db }));
const update = vi.fn();
const db: any = { from: (table: string) => {
  const q: any = { select: () => q, eq: () => q,
    maybeSingle: async () => ({ data: state.order, error: null }),
    update: (payload: any) => { update(payload); return q; },
    insert: async () => ({ error: state.duplicate ? { code: '23505', message: 'duplicate' } : null }),
    then: (resolve: any) => resolve({ error: state.updateError }),
  }; return q;
} };
import { recoverCompletedPayPalPayment } from '../../netlify/functions/_lib/paypal-payment-recovery';
import { handler } from '../../netlify/functions/paypal-webhook';
const resource = { id: 'CAPTURE', status: 'COMPLETED', amount: { value: '12.00', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: 'ORDER' } } };
const event: any = { httpMethod: 'POST', headers: {}, body: JSON.stringify({ id: 'EVENT', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource }) };
describe('payment recovery after browser or database failures', () => {
  beforeEach(() => {
    state.order = { id: 'beezio-order', total_charged: 12, currency: 'USD' };
    state.updateError = null; state.duplicate = false;
    state.finalize.mockReset().mockResolvedValue({ ok: true }); update.mockClear();
  });
  it('repairs a signed completion without submitting a new charge', async () => {
    await recoverCompletedPayPalPayment({ supabaseAdmin: db, resource });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ provider_capture_id: 'CAPTURE', payment_status: 'paid' }));
    expect(state.finalize).toHaveBeenCalledWith(expect.objectContaining({ providerOrderId: 'ORDER', providerCaptureId: 'CAPTURE' }));
  });
  it('returns an error then reprocesses the same event after accounting crashes', async () => {
    state.finalize.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await handler(event, {} as any, () => {}) as any).statusCode).toBe(500);
    state.duplicate = true;
    expect((await handler(event, {} as any, () => {}) as any).statusCode).toBe(200);
    expect(state.finalize).toHaveBeenCalledTimes(2);
  });
  it('does not acknowledge a failed order write', async () => {
    state.updateError = { message: 'database unavailable' };
    expect((await handler(event, {} as any, () => {}) as any).statusCode).toBe(500);
    expect(state.finalize).not.toHaveBeenCalled();
  });
  it.each([{ status: 'refunded' }, { payment_status: 'refunded' }, { dispute_status: 'OPEN' }])('preserves reversals and dispute holds: %j', async fields => {
    Object.assign(state.order, fields);
    await recoverCompletedPayPalPayment({ supabaseAdmin: db, resource });
    expect(update).not.toHaveBeenCalled(); expect(state.finalize).not.toHaveBeenCalled();
  });
  it('preserves shipped fulfillment on a delayed completed event', async () => {
    state.order.status = 'shipped';
    await recoverCompletedPayPalPayment({ supabaseAdmin: db, resource });
    expect(update.mock.calls[0][0]).not.toHaveProperty('status');
  });
  it('does not accept mismatched amounts', async () => {
    state.order.total_charged = 25;
    await expect(recoverCompletedPayPalPayment({ supabaseAdmin: db, resource })).rejects.toThrow('amount');
    expect(update).not.toHaveBeenCalled();
  });
});
