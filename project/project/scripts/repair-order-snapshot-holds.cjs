#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const orderId = String(process.argv[2] || '').trim();

if (!orderId) {
  console.error('Usage: node scripts/repair-order-snapshot-holds.cjs <order_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: rows, error } = await supabase
    .from('payout_snapshots')
    .select('id, hold_release_at, snapshot_json')
    .eq('order_id', orderId);

  if (error) throw error;

  let updated = 0;
  for (const row of rows || []) {
    const holdReleaseAt = String(row?.hold_release_at || '').trim();
    if (!holdReleaseAt) continue;

    const snapshotJson = row?.snapshot_json && typeof row.snapshot_json === 'object' ? row.snapshot_json : {};
    if (String(snapshotJson.hold_release_at || '').trim() === holdReleaseAt) continue;

    const { error: updateError } = await supabase
      .from('payout_snapshots')
      .update({ snapshot_json: { ...snapshotJson, hold_release_at: holdReleaseAt } })
      .eq('id', row.id);

    if (updateError) throw updateError;
    updated += 1;
  }

  console.log(JSON.stringify({ order_id: orderId, scanned: rows?.length || 0, updated }, null, 2));
}

main().catch((err) => {
  console.error(`Snapshot hold repair failed: ${err.message || err}`);
  process.exit(1);
});
