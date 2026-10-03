import { describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ supplier: vi.fn(), database: vi.fn() }));
vi.mock('../../netlify/functions/_lib/cj-fulfillment', () => ({ createUnpaidCJOrderForBeezioOrder: calls.supplier }));
vi.mock('../../netlify/functions/_lib/printify', () => ({ createPrintifyOrder: calls.supplier }));
vi.mock('../../netlify/functions/_lib/printful', () => ({ createPrintfulOrder: calls.supplier }));
vi.mock('../../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: calls.database }));
import { handler as dispatch } from '../../netlify/functions/fulfillment-dispatch';
import { handler as pending } from '../../netlify/functions/cj-process-pending';
import { handler as fulfill } from '../../netlify/functions/cj-fulfill-order';
describe('seller-managed shipping policy', () => {
  it.each([['dispatch', dispatch], ['pending supplier job', pending], ['supplier order creation', fulfill]])('%s cannot create orders or transmit buyer data', async (_, handler) => {
    const response: any = await (handler as any)({ httpMethod: 'POST', body: JSON.stringify({ orderId: 'paid-order' }) }, {});
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).manual_only).toBe(true);
    expect(calls.supplier).not.toHaveBeenCalled();
    expect(calls.database).not.toHaveBeenCalled();
  });
});
