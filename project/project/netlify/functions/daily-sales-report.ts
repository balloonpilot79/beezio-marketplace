import type { Handler } from '@netlify/functions';
import { getEnvBool } from './_lib/env';
import { buildAdminSalesLedgerReport, type AdminSalesLedgerRow } from './_lib/adminSalesLedgerReport';
import { sendTransactionalEmail } from './_lib/email';

const DEFAULT_TIMEZONE = 'America/Chicago';

const money = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getDateParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get('year') || 0),
    month: Number(map.get('month') || 0),
    day: Number(map.get('day') || 0),
  };
};

const formatDateKey = (date: Date, timeZone: string) => {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const addUtcDays = (dateKey: string, days: number) => {
  const base = new Date(`${dateKey}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

const parseRecipients = () => {
  const explicit = String(process.env.DAILY_FINANCE_REPORT_EMAILS || '').trim();
  const fallback = String(process.env.ADMIN_EMAILS || '').trim();
  const raw = explicit || fallback;
  return Array.from(
    new Set(
      raw
        .split(/[,\s;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes('@'))
    )
  );
};

const formatCreatedAt = (value: string | null, timeZone: string) => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const rowMatchesDate = (row: AdminSalesLedgerRow, dateKey: string, timeZone: string) => {
  const source = row.paid_at || row.created_at;
  const date = new Date(String(source || ''));
  if (Number.isNaN(date.getTime())) return false;
  return formatDateKey(date, timeZone) === dateKey;
};

const buildEmailHtml = (params: {
  dateKey: string;
  timeZone: string;
  rows: AdminSalesLedgerRow[];
  summary: {
    orders: number;
    real_sales: number;
    gross_sales: number;
    refunded_orders: number;
    refunded_amount: number;
    seller_payouts: number;
    affiliate_payouts: number;
    influencer_payouts: number;
    sales_tax: number;
    shipping: number;
    beezio_gross_revenue: number;
    paypal_fee: number;
    beezio_net_revenue: number;
  };
}) => {
  const rowsHtml = params.rows.length
    ? params.rows
        .map((row) => {
          const products = row.products.length ? row.products.join(', ') : 'Order items';
          return `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.order_number || row.order_id)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatCreatedAt(row.paid_at || row.created_at, params.timeZone))}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.buyer_name || row.buyer_email)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(products)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(row.gross_sales, row.currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(row.beezio_gross_revenue, row.currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(row.paypal_fee, row.currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(row.beezio_net_revenue, row.currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.is_refunded ? 'Refunded' : row.payment_status || '-')}</td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="9" style="padding:14px;text-align:center;color:#64748b;">No completed sales matched this report window.</td>
      </tr>
    `;

  return `
    <div style="font-family:Arial,sans-serif;max-width:1100px;margin:0 auto;padding:20px;color:#0f172a;">
      <h2 style="margin:0 0 8px;">Beezio Daily Sales Report</h2>
      <p style="margin:0 0 18px;color:#475569;">Previous-day report for <strong>${escapeHtml(params.dateKey)}</strong> (${escapeHtml(params.timeZone)}).</p>

      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 20px;">
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;">
          <div style="font-size:12px;text-transform:uppercase;color:#64748b;">Real Sales</div>
          <div style="font-size:28px;font-weight:700;margin-top:6px;">${params.summary.real_sales}</div>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">Paid sales not later refunded</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;">
          <div style="font-size:12px;text-transform:uppercase;color:#64748b;">Beezio Gross Revenue</div>
          <div style="font-size:28px;font-weight:700;margin-top:6px;">${money(params.summary.beezio_gross_revenue)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">After seller, affiliate, influencer, tax, shipping</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;">
          <div style="font-size:12px;text-transform:uppercase;color:#64748b;">Beezio Net After PayPal</div>
          <div style="font-size:28px;font-weight:700;margin-top:6px;">${money(params.summary.beezio_net_revenue)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:6px;">Gross revenue less processor fees</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tbody>
          <tr><td style="padding:6px 0;">Completed sales counted</td><td style="padding:6px 0;text-align:right;">${params.summary.orders}</td></tr>
          <tr><td style="padding:6px 0;">Gross customer charges</td><td style="padding:6px 0;text-align:right;">${money(params.summary.gross_sales)}</td></tr>
          <tr><td style="padding:6px 0;">Seller payouts</td><td style="padding:6px 0;text-align:right;">${money(params.summary.seller_payouts)}</td></tr>
          <tr><td style="padding:6px 0;">Affiliate payouts</td><td style="padding:6px 0;text-align:right;">${money(params.summary.affiliate_payouts)}</td></tr>
          <tr><td style="padding:6px 0;">Influencer payouts</td><td style="padding:6px 0;text-align:right;">${money(params.summary.influencer_payouts)}</td></tr>
          <tr><td style="padding:6px 0;">Sales tax collected</td><td style="padding:6px 0;text-align:right;">${money(params.summary.sales_tax)}</td></tr>
          <tr><td style="padding:6px 0;">Shipping collected</td><td style="padding:6px 0;text-align:right;">${money(params.summary.shipping)}</td></tr>
          <tr><td style="padding:6px 0;">PayPal fees</td><td style="padding:6px 0;text-align:right;">${money(params.summary.paypal_fee)}</td></tr>
          <tr><td style="padding:6px 0;">Refunded orders</td><td style="padding:6px 0;text-align:right;">${params.summary.refunded_orders}</td></tr>
          <tr><td style="padding:6px 0;">Refund amount</td><td style="padding:6px 0;text-align:right;">${money(params.summary.refunded_amount)}</td></tr>
        </tbody>
      </table>

      <h3 style="margin:0 0 10px;">Full Order Report</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Order</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Paid</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Buyer</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Products</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Gross</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Beezio Gross</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">PayPal</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Beezio Net</th>
            <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
};

export const config = {
  schedule: '15 13 * * *',
};

export const handler: Handler = async () => {
  try {
    const enabled = getEnvBool('DAILY_FINANCE_REPORTS_ENABLED', false);
    if (!enabled) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, skipped: true, reason: 'DAILY_FINANCE_REPORTS_ENABLED=false' }),
      };
    }

    const recipients = parseRecipients();
    if (!recipients.length) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, skipped: true, reason: 'No DAILY_FINANCE_REPORT_EMAILS or ADMIN_EMAILS configured' }),
      };
    }

    const timeZone = String(process.env.DAILY_FINANCE_REPORT_TIMEZONE || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
    const now = new Date();
    const currentDateKey = formatDateKey(now, timeZone);
    const targetDateKey = addUtcDays(currentDateKey, -1);
    const queryStart = addUtcDays(targetDateKey, -1);
    const queryEnd = addUtcDays(targetDateKey, 1);

    const report = await buildAdminSalesLedgerReport({
      limit: 20000,
      startDate: queryStart,
      endDate: queryEnd,
    });

    const targetRows = report.rows.filter((row) => row.is_counted_sale && rowMatchesDate(row, targetDateKey, timeZone));
    const summary = targetRows.reduce(
      (acc, row) => {
        acc.orders += 1;
        acc.real_sales += row.is_refunded ? 0 : 1;
        acc.gross_sales += Number(row.gross_sales || 0);
        acc.refunded_orders += row.is_refunded ? 1 : 0;
        acc.refunded_amount += Number(row.refunded_amount || 0);
        acc.seller_payouts += Number(row.seller?.amount || 0);
        acc.affiliate_payouts += Number(row.affiliate?.amount || 0);
        acc.influencer_payouts += Number(row.influencer?.amount || 0);
        acc.sales_tax += Number(row.sales_tax || 0);
        acc.shipping += Number(row.shipping || 0);
        acc.beezio_gross_revenue += Number(row.beezio_gross_revenue || 0);
        acc.paypal_fee += Number(row.paypal_fee || 0);
        acc.beezio_net_revenue += Number(row.beezio_net_revenue || 0);
        return acc;
      },
      {
        orders: 0,
        real_sales: 0,
        gross_sales: 0,
        refunded_orders: 0,
        refunded_amount: 0,
        seller_payouts: 0,
        affiliate_payouts: 0,
        influencer_payouts: 0,
        sales_tax: 0,
        shipping: 0,
        beezio_gross_revenue: 0,
        paypal_fee: 0,
        beezio_net_revenue: 0,
      }
    );

    const html = buildEmailHtml({
      dateKey: targetDateKey,
      timeZone,
      rows: targetRows,
      summary,
    });

    const results = await Promise.all(
      recipients.map(async (to) => ({
        to,
        result: await sendTransactionalEmail({
          to,
          subject: `Beezio daily sales report for ${targetDateKey}`,
          html,
        }),
      }))
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        scheduled: true,
        date: targetDateKey,
        time_zone: timeZone,
        recipients: results,
        summary,
        row_count: targetRows.length,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
    };
  }
};
