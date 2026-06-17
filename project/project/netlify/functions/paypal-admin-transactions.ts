import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

type Body = {
  limit?: number;
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const fallbackSelect = async (table: string, fields: string[], limit: number, providerFilterField: string) => {
  const supabaseAdmin = createSupabaseAdmin();
  let selectedFields = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selectedFields.join(','))
      .eq(providerFilterField, 'PAYPAL')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error) return { data: data || [], selectedFields, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing) {
      selectedFields = selectedFields.filter((field) => field !== missing);
      if (!selectedFields.length) break;
      continue;
    }
    break;
  }

  return { data: [], selectedFields, error: lastError };
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    await requireAdmin(event as any);

    const body = parseJson<Body>(event.body);
    const limitRaw = Number(body?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(100, Math.floor(limitRaw))) : 50;

    const baseFields = [
      'id',
      'created_at',
      'status',
      'payment_status',
      'currency',
      'total_amount',
      'total_charged',
      'buyer_id',
      'seller_id',
      'billing_email',
      'provider_order_id',
      'provider_capture_id',
      'payment_provider',
    ];

    const result = await fallbackSelect('orders', baseFields, limit, 'payment_provider');
    if (result.error) {
      return json(500, {
        error: 'Failed to load PayPal transaction logs',
        details: String((result.error as any)?.message || ''),
      });
    }

    return json(200, {
      ok: true,
      count: result.data.length,
      fields: result.selectedFields,
      rows: result.data,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;

