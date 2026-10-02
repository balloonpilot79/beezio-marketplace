// Shared by the admin endpoint and period grouping in its dashboard.
export function summarizeAccountingReportRows(rows: any[]) {
  const summary = { orders: 0, real_sales: 0, gross_sales: 0, seller_payouts: 0, affiliate_payouts: 0, influencer_payouts: 0, beezio_fee: 0, paypal_fee: 0, beezio_gross_revenue: 0, beezio_net_revenue: 0, sales_tax: 0, shipping: 0, refunded_orders: 0, refunded_amount: 0, disputed_orders: 0, open_disputes: 0 };
  for (const row of rows) {
    if (!row.is_counted_sale && !row.is_refunded) continue;
    summary.orders += 1;
    summary.refunded_orders += row.is_refunded ? 1 : 0;
    summary.refunded_amount += Number(row.refunded_amount || 0);
    summary.disputed_orders += row.dispute_status && row.dispute_status !== 'NONE' ? 1 : 0;
    summary.open_disputes += row.dispute_status === 'OPEN' ? 1 : 0;
    summary.paypal_fee += Number(row.paypal_fee || 0);
    summary.beezio_net_revenue += Number(row.beezio_net_revenue || 0);
    if (row.is_refunded) continue;
    summary.real_sales += 1;
    summary.gross_sales += Number(row.gross_sales ?? row.gross_amount ?? 0);
    summary.seller_payouts += Number(row.seller?.amount || 0);
    summary.affiliate_payouts += Number(row.affiliate?.amount || 0);
    summary.influencer_payouts += Number(row.influencer?.amount || 0);
    summary.beezio_fee += Number(row.beezio_fee || 0);
    summary.beezio_gross_revenue += Number(row.beezio_gross_revenue || 0);
    summary.sales_tax += Number(row.sales_tax || 0);
    summary.shipping += Number(row.shipping || 0);
  }
  return Object.fromEntries(Object.entries(summary).map(([key,value]) => [key, Math.round((value + Number.EPSILON) * 100) / 100])) as typeof summary;
}
