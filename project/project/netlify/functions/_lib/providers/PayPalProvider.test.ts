import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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

const completed = { id: 'ORDER', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAPTURE', status: 'COMPLETED' }] } }] };
const reply = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
describe('PayPal payment evidence', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());
  it('requires a completed capture and uses the supplied retry identifier', async () => {
    vi.mocked(fetch).mockResolvedValue(reply(completed));
    expect((await new PayPalProvider().captureOrder('ORDER', 'stable-key')).providerCaptureId).toBe('CAPTURE');
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'PayPal-Request-Id': 'stable-key' });
  });
  it.each([
    { id: 'ORDER', status: 'APPROVED' },
    { ...completed, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE', status: 'PENDING' }] } }] },
    { ...completed, purchase_units: [] },
  ])('does not mark incomplete payments paid: %j', async payload => {
    vi.mocked(fetch).mockResolvedValue(reply(payload));
    await expect(new PayPalProvider().captureOrder('ORDER', 'stable-key')).rejects.toMatchObject({ code: 'PAYMENT_NOT_COMPLETED' });
  });
  it('recovers an already captured payment using verified existing capture evidence', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }, 422)).mockResolvedValueOnce(reply(completed));
    expect((await new PayPalProvider().captureOrder('ORDER', 'stable-key')).providerCaptureId).toBe('CAPTURE');
    expect(vi.mocked(fetch).mock.calls[1][1]?.method).toBe('GET');
  });
});
