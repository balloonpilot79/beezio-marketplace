// Order creation persists customer_email. Billing-only fields are not part
// of the orders schema and must not block capture before PayPal is contacted.
export async function loadPayPalCaptureOrder(db: any, providerOrderId: string) {
  const fields = ['id', 'buyer_id', 'customer_email', 'seller_id', 'partner_id', 'influencer_id', 'currency', 'subtotal_listing', 'shipping_amount', 'tax_amount', 'total_charged', 'shipping_address', 'status', 'payment_status', 'provider_capture_id', 'paid_at'];
  const select = (columns: string[]) => db.from('orders').select(columns.join(',')).eq('provider_order_id', providerOrderId).maybeSingle();
  const result = await select(fields);
  if (result.error && String(result.error.message || '').includes('payment_status')) {
    return select(fields.filter(field => field !== 'payment_status'));
  }
  return result;
}
