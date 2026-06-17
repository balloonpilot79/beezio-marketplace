import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

type CloseoutSummaryPayload = {
  orders?: number;
  grossSales?: number;
  totalPayouts?: number;
  sellerPayouts?: number;
  affiliatePayouts?: number;
  influencerPayouts?: number;
  beezioFee?: number;
  paypalFees?: number;
  beezioNet?: number;
  salesTax?: number;
  shipping?: number;
  paidOrders?: number;
  readyOrders?: number;
  heldOrders?: number;
  missingPayPalOrders?: number;
  batchedOrders?: number;
};

type SaveReportPayload = {
  closeout_start_date?: string;
  closeout_end_date?: string;
  order_search?: string;
  tax_year?: number | null;
  generated_at?: string | null;
  summary?: CloseoutSummaryPayload | null;
  headers?: string[];
  rows?: Array<Array<string | number | null | undefined>>;
  csv_content?: string;
};

type Body =
  | { action?: 'list'; limit?: number }
  | { action: 'save'; report?: SaveReportPayload }
  | { action: 'get'; report_id?: string; format?: 'json' | 'csv' };

const normalizeDbError = (message: string) => {
  const raw = String(message || '').trim();
  if (/admin_finance_closeout_reports/i.test(raw) && /does not exist|schema cache/i.test(raw)) {
    return 'The admin finance closeout reports table is not available yet. Run the latest Supabase migration for admin_finance_closeout_reports, then retry.';
  }
  return raw || 'Unexpected database error';
};

const sanitizeFilename = (value: string) =>
  String(value || 'beezio-finance-closeout')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'beezio-finance-closeout';

const toFiniteNumber = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
};

const toSavedReportSummary = (row: any, creator?: { name: string; email: string }) => ({
  id: String(row?.id || ''),
  report_title: String(row?.report_title || ''),
  created_at: String(row?.created_at || ''),
  generated_at: String(row?.generated_at || ''),
  closeout_start_date: String(row?.closeout_start_date || ''),
  closeout_end_date: String(row?.closeout_end_date || ''),
  order_search: String(row?.order_search || ''),
  tax_year: row?.tax_year == null ? null : Number(row.tax_year),
  row_count: Number(row?.row_count || 0),
  gross_sales: toFiniteNumber(row?.gross_sales),
  total_payouts: toFiniteNumber(row?.total_payouts),
  beezio_net: toFiniteNumber(row?.beezio_net),
  summary: row?.summary_json || {},
  created_by_user_id: String(row?.created_by_user_id || ''),
  created_by_name: creator?.name || '',
  created_by_email: creator?.email || '',
});

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const { userId } = await requireAdmin(event as any);
    const body = parseJson<Body>(event.body);
    const action = String(body?.action || 'list').trim().toLowerCase();
    const supabaseAdmin = createSupabaseAdmin();

    if (action === 'save') {
      const report = (body as Extract<Body, { action: 'save' }>).report || {};
      const closeoutStartDate = String(report.closeout_start_date || '').trim();
      const closeoutEndDate = String(report.closeout_end_date || '').trim();
      const headers = Array.isArray(report.headers) ? report.headers.map((entry) => String(entry || '')) : [];
      const rows = Array.isArray(report.rows)
        ? report.rows.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : cell)) : []))
        : [];
      const csvContent = String(report.csv_content || '').trim();
      const summary = report.summary && typeof report.summary === 'object' ? report.summary : {};

      if (!closeoutStartDate || !closeoutEndDate) {
        return json(400, { error: 'closeout_start_date and closeout_end_date are required.' });
      }
      if (!headers.length || !rows.length || !csvContent) {
        return json(400, { error: 'headers, rows, and csv_content are required to save a closeout snapshot.' });
      }

      const orderSearch = String(report.order_search || '').trim();
      const reportTitle = `Beezio Finance Closeout ${closeoutStartDate} to ${closeoutEndDate}${orderSearch ? ` • ${orderSearch}` : ''}`;
      const insertPayload = {
        created_by_user_id: userId,
        report_title: reportTitle,
        closeout_start_date: closeoutStartDate,
        closeout_end_date: closeoutEndDate,
        order_search: orderSearch,
        tax_year: report.tax_year == null ? null : Number(report.tax_year),
        generated_at: report.generated_at || new Date().toISOString(),
        row_count: rows.length,
        gross_sales: toFiniteNumber(summary.grossSales),
        total_payouts: toFiniteNumber(summary.totalPayouts),
        beezio_net: toFiniteNumber(summary.beezioNet),
        summary_json: summary,
        headers_json: headers,
        rows_json: rows,
        csv_content: csvContent,
      };

      const { data, error } = await supabaseAdmin
        .from('admin_finance_closeout_reports')
        .insert(insertPayload)
        .select('id, report_title, created_at, generated_at, closeout_start_date, closeout_end_date, order_search, tax_year, row_count, gross_sales, total_payouts, beezio_net, summary_json, created_by_user_id')
        .single();

      if (error) return json(500, { error: normalizeDbError(error.message) });

      return json(200, {
        ok: true,
        report: toSavedReportSummary(data, { name: '', email: '' }),
      });
    }

    if (action === 'get') {
      const reportId = String((body as Extract<Body, { action: 'get' }>).report_id || '').trim();
      const format = String((body as Extract<Body, { action: 'get' }>).format || 'json').trim().toLowerCase();
      if (!reportId) return json(400, { error: 'report_id is required.' });

      const { data, error } = await supabaseAdmin
        .from('admin_finance_closeout_reports')
        .select('id, report_title, created_at, generated_at, closeout_start_date, closeout_end_date, order_search, tax_year, row_count, gross_sales, total_payouts, beezio_net, summary_json, headers_json, rows_json, csv_content, created_by_user_id')
        .eq('id', reportId)
        .maybeSingle();

      if (error) return json(500, { error: normalizeDbError(error.message) });
      if (!data) return json(404, { error: 'Saved closeout report not found.' });

      if (format === 'csv') {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${sanitizeFilename(String(data.report_title || 'beezio-finance-closeout'))}.csv"`,
          },
          body: String(data.csv_content || ''),
        };
      }

      return json(200, {
        ok: true,
        report: {
          ...toSavedReportSummary(data),
          headers: Array.isArray(data.headers_json) ? data.headers_json : [],
          rows: Array.isArray(data.rows_json) ? data.rows_json : [],
          csv_content: String(data.csv_content || ''),
        },
      });
    }

    const limit = Math.min(50, Math.max(1, Number((body as Extract<Body, { action?: 'list'; limit?: number }>).limit || 12)));
    const { data, error } = await supabaseAdmin
      .from('admin_finance_closeout_reports')
      .select('id, report_title, created_at, generated_at, closeout_start_date, closeout_end_date, order_search, tax_year, row_count, gross_sales, total_payouts, beezio_net, summary_json, created_by_user_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return json(500, { error: normalizeDbError(error.message) });

    const reports = Array.isArray(data) ? data : [];
    const creatorIds = Array.from(new Set(reports.map((row: any) => String(row?.created_by_user_id || '').trim()).filter(Boolean)));
    const { data: profileRows } = creatorIds.length
      ? await supabaseAdmin
          .from('profiles')
          .select('id, user_id, full_name, email')
          .or(creatorIds.map((id) => `id.eq.${id},user_id.eq.${id}`).join(','))
      : { data: [] as any[] };

    const profileMap = new Map<string, { name: string; email: string }>();
    for (const profile of (profileRows as any[]) || []) {
      const info = {
        name: String(profile?.full_name || profile?.email || profile?.id || '').trim(),
        email: String(profile?.email || '').trim(),
      };
      const id = String(profile?.id || '').trim();
      const userIdKey = String(profile?.user_id || '').trim();
      if (id) profileMap.set(id, info);
      if (userIdKey) profileMap.set(userIdKey, info);
    }

    return json(200, {
      ok: true,
      reports: reports.map((row: any) => toSavedReportSummary(row, profileMap.get(String(row?.created_by_user_id || '').trim()))),
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
