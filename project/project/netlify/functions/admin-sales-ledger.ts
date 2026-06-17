import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { buildAdminSalesLedgerReport, type LedgerRequest } from './_lib/adminSalesLedgerReport';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<LedgerRequest>(event.body);
    const report = await buildAdminSalesLedgerReport(body || {});

    return json(200, {
      ok: true,
      summary: report.summary,
      filters: report.filters,
      rows: report.rows,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
