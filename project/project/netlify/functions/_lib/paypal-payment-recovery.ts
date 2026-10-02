import { finalizePayPalOrderPayment } from './paypal-order-finalization';

// Only call with a signature-verified webhook or its private persisted event.
// This repairs local records; it never submits a charge to PayPal.
export async function recoverCompletedPayPalPayment({ supabaseAdmin, resource }: { supabaseAdmin: any; resource: any }) {
  const captureId = String(resource?.id || '').trim();
  const providerOrderId = String(resource?.supplementary_data?.related_ids?.order_id || '').trim();
  if (!captureId || !providerOrderId || resource?.status !== 'COMPLETED') throw new Error('Incomplete PayPal payment evidence');
  const { data: order, error } = await supabaseAdmin.from('orders')
    .select('id,paid_at,status,payment_status,dispute_status,total_charged,currency')
    .eq('provider_order_id', providerOrderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order?.id) throw new Error('PayPal payment has no saved order; manual review required');
  // A late completion event must not reopen a refund or release a dispute hold.
  if ([order.status, order.payment_status].some(value => /refund|cancel|revers/i.test(String(value || ''))) ||
      String(order.dispute_status || '').toUpperCase() === 'OPEN') return { skipped: true };
  const amount = Number(resource?.amount?.value);
  if (!Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(Number(order.total_charged) * 100) ||
      String(resource?.amount?.currency_code || '').toUpperCase() !== String(order.currency || 'USD').toUpperCase()) {
    throw new Error('PayPal payment amount does not match the saved order; manual review required');
  }
  const paidAt = order.paid_at || resource.create_time || new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from('orders').update({
    payment_provider: 'PAYPAL', provider_capture_id: captureId,
    payment_status: 'paid', status: 'completed', paid_at: paidAt,
  }).eq('id', order.id);
  if (updateError) throw new Error(updateError.message);
  const rawFee = resource?.seller_receivable_breakdown?.paypal_fee?.value;
  const fee = rawFee == null ? NaN : Number(rawFee);
  return finalizePayPalOrderPayment({
    supabaseAdmin, orderId: order.id, providerOrderId, providerCaptureId: captureId,
    paypalFeeAmount: Number.isFinite(fee) && fee >= 0 ? fee : null, paidAt,
  });
}
