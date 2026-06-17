import { PaymentProvider, ProviderCreateOrderInput, ProviderCreateOrderResult, ProviderCaptureOrderResult } from './PaymentProvider';
import { getPayPalAccessToken, getPayPalBaseUrl, paypalRequestId, verifyPayPalWebhookSignature } from '../paypal';
import { toAmountString } from '../money';

export class PayPalProviderError extends Error {
  statusCode: number;
  code: string;
  details: string | null;
  approveUrl: string | null;
  raw: unknown;

  constructor(args: {
    message: string;
    statusCode: number;
    code: string;
    details?: string | null;
    approveUrl?: string | null;
    raw?: unknown;
  }) {
    super(args.message);
    this.name = 'PayPalProviderError';
    this.statusCode = args.statusCode;
    this.code = args.code;
    this.details = args.details ?? null;
    this.approveUrl = args.approveUrl ?? null;
    this.raw = args.raw;
  }
}

export class PayPalProvider implements PaymentProvider {
  name = 'paypal' as const;

  private extractCaptureId(payload: any): string | null {
    return String(
      payload?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
      payload?.id ||
      ''
    ).trim() || null;
  }

  private extractPayPalFeeAmount(payload: any): number | null {
    const captures = Array.isArray(payload?.purchase_units)
      ? payload.purchase_units.flatMap((unit: any) => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [])
      : [];
    for (const capture of captures) {
      const rawFee = capture?.seller_receivable_breakdown?.paypal_fee?.value;
      const amount = Number(rawFee);
      if (Number.isFinite(amount) && amount >= 0) return Math.round((amount + Number.EPSILON) * 100) / 100;
    }
    return null;
  }

  private extractApproveUrl(payload: any): string | null {
    const links = Array.isArray(payload?.links) ? payload.links : [];
    return String(
      links.find((link: any) => String(link?.rel || '').trim().toLowerCase() === 'approve')?.href ||
      links.find((link: any) => String(link?.rel || '').trim().toLowerCase() === 'payer-action')?.href ||
      ''
    ).trim() || null;
  }

  async createOrder(input: ProviderCreateOrderInput): Promise<ProviderCreateOrderResult> {
    const token = await getPayPalAccessToken();
    const baseUrl = await getPayPalBaseUrl();

    const currency = String(input.currency || 'USD').toUpperCase();
    const total = input.subtotal + input.shipping + input.tax;

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': input.requestId || paypalRequestId('bzo_order'),
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        payment_source: {
          paypal: {
            experience_context: {
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              // Let PayPal collect/confirm address in-wallet to avoid 422 when no
              // pre-supplied shipping object is attached at order creation time.
              shipping_preference: 'GET_FROM_FILE',
            },
          },
        },
        purchase_units: [
          {
            reference_id: input.referenceId || undefined,
            amount: {
              currency_code: currency,
              value: toAmountString(total),
              breakdown: {
                item_total: { currency_code: currency, value: toAmountString(input.subtotal) },
                shipping: { currency_code: currency, value: toAmountString(input.shipping) },
                tax_total: { currency_code: currency, value: toAmountString(input.tax) },
              },
            },
            items: input.items.map((it) => ({
              name: String(it.name || 'Item').slice(0, 120),
              quantity: String(it.quantity),
              unit_amount: { currency_code: currency, value: toAmountString(it.unit_amount) },
              category: it.category === 'DIGITAL_GOODS' ? 'DIGITAL_GOODS' : 'PHYSICAL_GOODS',
            })),
          },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = String((data as any)?.details?.[0]?.description || (data as any)?.message || (data as any)?.name || '').trim();
      const debugId = String((data as any)?.debug_id || '').trim();
      const suffix = [details, debugId ? `debug_id=${debugId}` : ''].filter(Boolean).join(' | ');
      throw new Error(`PayPal create order failed (${res.status})${suffix ? `: ${suffix}` : ''}`);
    }

    const providerOrderId = String((data as any)?.id || '').trim();
    if (!providerOrderId) throw new Error('PayPal create order failed: missing id');

    const approveUrl = ((data as any)?.links || []).find((l: any) => String(l?.rel || '').toLowerCase() === 'approve')?.href || null;

    return { providerOrderId, approveUrl, raw: data };
  }

  async captureOrder(providerOrderId: string, requestId?: string): Promise<ProviderCaptureOrderResult> {
    const token = await getPayPalAccessToken();
    const baseUrl = await getPayPalBaseUrl();

    const res = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': requestId || paypalRequestId('bzo_capture'),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const issue = String((data as any)?.details?.[0]?.issue || '').trim().toUpperCase();
      const description = String((data as any)?.details?.[0]?.description || (data as any)?.message || '').trim();
      if (res.status === 422 || issue === 'ORDER_ALREADY_CAPTURED') {
        const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const orderData = await orderRes.json().catch(() => ({}));
        if (orderRes.ok) {
          const captureId = this.extractCaptureId(orderData);
          const status = String((orderData as any)?.status || '').trim().toUpperCase();
          if (captureId && status === 'COMPLETED') {
            return {
              providerOrderId,
              providerCaptureId: captureId,
              paypalFeeAmount: this.extractPayPalFeeAmount(orderData),
              raw: orderData,
            };
          }

          if (status === 'PAYER_ACTION_REQUIRED' || issue === 'ORDER_NOT_APPROVED') {
            throw new PayPalProviderError({
              message: description || 'Payer approval is required before capture.',
              statusCode: 409,
              code: 'PAYER_ACTION_REQUIRED',
              details: description || null,
              approveUrl: this.extractApproveUrl(orderData),
              raw: orderData,
            });
          }
        }
      }

      throw new PayPalProviderError({
        message: `PayPal capture failed (${res.status})${description ? `: ${description}` : ''}`,
        statusCode: res.status >= 400 && res.status < 500 ? res.status : 502,
        code: issue || 'PAYPAL_CAPTURE_FAILED',
        details: description || null,
        raw: data,
      });
    }

    const captureId = this.extractCaptureId(data);

    return {
      providerOrderId,
      providerCaptureId: captureId,
      paypalFeeAmount: this.extractPayPalFeeAmount(data),
      raw: data,
    };
  }

  async verifyWebhookSignature(args: { headers: Record<string, string | undefined>; rawBody: string }): Promise<boolean> {
    return verifyPayPalWebhookSignature(args);
  }
}
