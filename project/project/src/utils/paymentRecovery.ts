export function paymentRecoveryMessage(payload: any, status: number): string {
  const code = String(payload?.code || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 80);
  const messages: Record<string, string> = {
    PAYER_ACTION_REQUIRED: 'PayPal needs your approval for this existing checkout. Continue with PayPal below.',
    ORDER_NOT_APPROVED: 'PayPal has not approved this checkout yet. Continue with PayPal to approve the existing order.',
    INSTRUMENT_DECLINED: 'PayPal declined the payment method. This checkout is still saved; use another payment method through PayPal.',
    TRANSACTION_REFUSED: 'PayPal refused this payment. Keep the checkout reference and contact support.',
    PAYMENT_NOT_COMPLETED: 'PayPal has not confirmed a completed payment yet. Keep this checkout and check again later.',
    ORDER_LOOKUP_FAILED: 'Beezio could not load the saved checkout. Keep the reference and contact support.',
    PAYPAL_NOT_CONFIGURED: 'The payment service is unavailable. Your checkout is saved.',
    PAYMENTS_PAUSED: 'Payments are temporarily paused. Your checkout is saved.',
  };
  return `${messages[code] || 'We could not verify this payment. Keep this checkout reference and contact support.'} (Reference: ${code || `HTTP_${status}`})`;
}

export function safePayPalApprovalUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'paypal.com' || url.hostname.endsWith('.paypal.com')) ? url.href : null;
  } catch { return null; }
}
