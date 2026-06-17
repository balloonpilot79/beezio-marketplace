import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayPalProvider, PayPalProviderError } from './PayPalProvider';

vi.mock('../paypal', () => ({
  getPayPalAccessToken: vi.fn(async () => 'token-123'),
  getPayPalBaseUrl: vi.fn(async () => 'https://api-m.sandbox.paypal.com'),
  paypalRequestId: vi.fn(() => 'request-123'),
  verifyWebhookSignature: vi.fn(async () => true),
}));

describe('PayPalProvider.createOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves digital goods categories in the PayPal payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'paypal-order-1',
        links: [],
      }),
    } as Response);

    const provider = new PayPalProvider();

    await provider.createOrder({
      currency: 'USD',
      subtotal: 10,
      shipping: 0,
      tax: 0,
      items: [
        {
          name: 'Digital item',
          quantity: 1,
          unit_amount: 10,
          category: 'DIGITAL_GOODS',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(init?.body || '{}'));
    expect(payload.purchase_units?.[0]?.items?.[0]?.category).toBe('DIGITAL_GOODS');
  });
});

describe('PayPalProvider.captureOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces payer approval required as a non-500 provider error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          details: [
            {
              issue: 'ORDER_NOT_APPROVED',
              description: "Payer has not yet approved the Order for payment.",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'paypal-order-1',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            {
              rel: 'payer-action',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=paypal-order-1',
            },
          ],
        }),
      } as Response);

    const provider = new PayPalProvider();

    await expect(provider.captureOrder('paypal-order-1')).rejects.toMatchObject<Partial<PayPalProviderError>>({
      name: 'PayPalProviderError',
      statusCode: 409,
      code: 'PAYER_ACTION_REQUIRED',
      approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=paypal-order-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
