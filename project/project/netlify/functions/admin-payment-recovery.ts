import type { Config } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';

export default async (req: Request) => {
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (req.method !== 'GET') return respond({ error: 'Method not allowed' }, 405);
  try {
    await requireAdmin({ headers: { authorization: req.headers.get('authorization') || undefined } });
    const db = createSupabaseAdmin();
    const { data, error } = await db.from('integration_logs')
      .select('created_at,metadata').eq('action', 'payment_recovery_required')
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const unique = new Map<string, any>();
    for (const row of data || []) {
      const reference = String(row.metadata?.provider_order_id || '');
      if (reference && !unique.has(reference)) unique.set(reference, {
        provider_order_id: reference, order_id: row.metadata?.order_id || null,
        error: String(row.metadata?.error || 'Payment recovery requires review'), created_at: row.created_at,
      });
    }
    return respond({ incidents: [...unique.values()] });
  } catch (error: any) {
    return respond({ error: error?.statusCode ? error.message : 'Could not load payment recovery history' }, Number(error?.statusCode) || 500);
  }
};
export const config: Config = { path: '/api/admin-payment-recovery' };
