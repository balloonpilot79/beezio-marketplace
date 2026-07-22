import { describe, expect, it, vi } from 'vitest';
import { fetchPayPalPayoutBatchDetails, normalizePayoutItemStatus } from './paypalPayoutReconciliation';

describe('PayPal payout reconciliation', () => {
  it('keeps an unclaimed payout pending instead of making it payable again', () => {
    expect(normalizePayoutItemStatus('UNCLAIMED')).toEqual({ status: 'CREATED', errorMessage: null });
  });

  it('releases only definitive failed or returned payments', () => {
    expect(normalizePayoutItemStatus('RETURNED')).toEqual({ status: 'FAILED', errorMessage: 'RETURNED' });
    expect(normalizePayoutItemStatus('SUCCESS')).toEqual({ status: 'SENT', errorMessage: null });
  });

  it('loads every PayPal result page before reconciling recipients', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const page = new URL(url).searchParams.get('page');
      return {
        ok: true,
        status: 200,
        async json() {
          return page === '1'
            ? { total_pages: 2, batch_header: { batch_status: 'PROCESSING' }, items: [{ payout_item_id: 'one' }] }
            : { total_pages: 2, batch_header: { batch_status: 'SUCCESS' }, items: [{ payout_item_id: 'two' }] };
        },
      } as Response;
    });

    const result = await fetchPayPalPayoutBatchDetails({
      baseUrl: 'https://api-m.sandbox.paypal.com',
      providerBatchId: 'batch-1',
      token: 'token',
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect((result.data as any).items.map((item: any) => item.payout_item_id)).toEqual(['one', 'two']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
