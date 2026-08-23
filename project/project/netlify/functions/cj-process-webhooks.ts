import type { Handler } from '@netlify/functions';
import { processCJWebhookPayload } from './_lib/cj-webhook-events';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';

export const handler: Handler = async () => {
  const supabaseAdmin = createSupabaseAdmin();
  const { data: rows, error } = await supabaseAdmin
    .from('cj_webhook_events')
    .select('id,message_id,payload')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return json(500, { error: error.message });

  let processed = 0;
  let failed = 0;
  for (const row of (rows as any[]) || []) {
    try {
      await processCJWebhookPayload(supabaseAdmin, row?.payload);
      const { error: updateError } = await supabaseAdmin.from('cj_webhook_events').update({
        processed_at: new Date().toISOString(),
        error_message: null,
      }).eq('id', row.id);
      if (updateError) throw updateError;
      processed += 1;
    } catch (eventError) {
      failed += 1;
      await supabaseAdmin.from('cj_webhook_events').update({
        error_message: eventError instanceof Error ? eventError.message : String(eventError),
      }).eq('id', row.id);
    }
  }

  return json(200, { ok: true, scanned: (rows || []).length, processed, failed });
};

export default handler;
