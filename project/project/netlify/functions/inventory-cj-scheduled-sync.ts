import type { Handler } from '@netlify/functions';
import { getEnvBool } from './_lib/env';
import { createSupabaseAdmin } from './_lib/supabase';
import { runCjInventorySync } from './inventory-cj-sync';

// Retired integration: this function remains readable for deployment history,
// but it is intentionally no longer scheduled.

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
