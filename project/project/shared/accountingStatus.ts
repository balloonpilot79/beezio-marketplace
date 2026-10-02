export const EARNING_STATUSES = new Set(['PENDING_HOLD', 'READY_TO_PAY', 'ON_HOLD_DISPUTE', 'PAID']);
export const isEarningSnapshot = (row: any): boolean =>
  row?.accounting_reversed !== true && EARNING_STATUSES.has(String(row?.status || '').trim().toUpperCase());

export function isRefundedPayment(order: any): boolean {
  return [order?.payment_status, order?.status].some(value => /refund|revers/i.test(String(value || '')));
}

// Explicit payment state wins over generic fulfillment/order state.
export function isConfirmedPaidOrder(order: any): boolean {
  if (!order || isRefundedPayment(order)) return false;
  const payment = String(order.payment_status || '').trim().toLowerCase();
  if (payment) return ['paid', 'completed', 'succeeded'].includes(payment);
  if (/cancel|fail/i.test(String(order.status || ''))) return false;
  return Boolean(order.provider_capture_id || order.payment_reference_id || order.paid_at);
}

export function summarizeEarningActivity(rows: any[], now = new Date()) {
  const active = rows.filter(isEarningSnapshot);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today); week.setDate(today.getDate() - today.getDay());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = new Date(now.getFullYear(), 0, 1);
  const since = (start: Date) => active.filter(row => {
    const date = new Date(row.created_at || '');
    return Number.isFinite(date.getTime()) && date >= start && date <= now;
  });
  const count = (entries: any[]) => new Set(entries.map(row => row.order_id || row.id).filter(Boolean)).size;
  const total = (entries: any[]) => entries.reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 100), 0) / 100;
  return { total_sales: count(active), today_sales: count(since(today)), week_sales: count(since(week)), month_sales: count(since(month)), year_sales: count(since(year)), today_earned: total(since(today)), total_earned: total(active) };
}

export function annotateReversedEarnings(rows: any[], orders: any[]) {
  const reversed = new Set(orders.filter(order => isRefundedPayment(order) || /cancel/i.test(String(order.status || ''))).map(order => String(order.id)));
  return rows.map(row => ({ ...row, accounting_reversed: reversed.has(String(row.order_id)) }));
}
