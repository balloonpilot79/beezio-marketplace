import type { Handler } from '@netlify/functions';
import { getEnvBool } from './_lib/env';
import { createSupabaseAdmin } from './_lib/supabase';
import { runCjInventorySync } from './inventory-cj-sync';

export const config = {
  // Keep CJ inventory fresh for all seller listings every 15 minutes.
  schedule: '*/15 * * * *',
};

export const handler: Handler = async () => {
  try {
    const enabled = getEnvBool('CJ_INVENTORY_SCHEDULED_ENABLED', true);
    if (!enabled) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, skipped: true, reason: 'CJ_INVENTORY_SCHEDULED_ENABLED=false' }),
      };
    }

    const supabaseAdmin = createSupabaseAdmin();
    const result = await runCjInventorySync({
      supabaseAdmin,
      actorUserId: null,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled: true, ...result }),
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
