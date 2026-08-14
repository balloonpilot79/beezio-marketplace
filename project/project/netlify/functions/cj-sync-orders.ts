import type { Handler } from '@netlify/functions';
import { getCJOrderDetail } from './_lib/cj-api';
import { applyCJOrderUpdate, extractCJOrderUpdate } from './_lib/cj-order-status';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';

export const config = { schedule: '*/15 * * * *' };

export const handler: Handler = async () => {
  const supabaseAdmin = createSupabaseAdmin();
  const { data: rows, error } = await supabaseAdmin
    .from('cj_orders')
    .select('*')
    .not('cj_order_id', 'is', null)
    .limit(50);
  if (error) return json(500, { error: error.message });

  let synced = 0;
  let failed = 0;
  for (const row of (rows as any[]) || []) {
    const status = String(row?.cj_status || '').trim().toLowerCase();
    if (status.includes('deliver') || status.includes('cancel')) continue;
    try {
      const detail = await getCJOrderDetail(String(row.cj_order_id));
      await applyCJOrderUpdate({
        supabaseAdmin,
        update: extractCJOrderUpdate(detail),
        fallbackCjOrderRow: row,
      });
      synced += 1;
    } catch (syncError) {
      failed += 1;
      await supabaseAdmin.from('cj_orders').update({
        error_message: syncError instanceof Error ? syncError.message : String(syncError),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
    }
  }

  return json(200, { ok: true, scanned: (rows || []).length, synced, failed });
};

export default handler;
