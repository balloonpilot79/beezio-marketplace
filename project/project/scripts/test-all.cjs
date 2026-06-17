#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SERVICE_ROLE_KEY;
const RECENT_ORDER_SCAN_MULTIPLIER = 4;

function run(label, command) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}${result.signal ? ` signal=${result.signal}` : ''}`);
  }
}

function runNode(label, script, args = []) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function auditRecentCompletedOrders(limit = 5) {
  console.log(`\n== Recent completed PayPal ledger audits ==`);
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing Supabase service credentials for recent order audit');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at')
    .eq('payment_provider', 'PAYPAL')
    .eq('payment_status', 'paid')
    .eq('status', 'completed')
    .not('provider_capture_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * RECENT_ORDER_SCAN_MULTIPLIER, limit));

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) throw new Error('No completed paid PayPal orders found to audit');

  const auditRows = [];
  const orphanedRows = [];

  for (const row of rows) {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', row.id)
      .limit(1);

    if (orderItemsError) throw orderItemsError;

    if (Array.isArray(orderItems) && orderItems.length > 0) {
      auditRows.push(row);
      if (auditRows.length >= limit) break;
      continue;
    }

    orphanedRows.push(row);
  }

  if (orphanedRows.length > 0) {
    console.warn('\nWARN: Skipping completed paid PayPal orders without order_items from strict ledger audits.');
    for (const row of orphanedRows) {
      console.warn(`- ${row.order_number || row.id} (${row.created_at})`);
    }
  }

  if (!auditRows.length) {
    throw new Error('No completed paid PayPal orders with line items found to audit');
  }

  for (const row of auditRows) {
    console.log(`\n-- ${row.order_number || row.id} (${row.created_at}) --`);
    runNode('PayPal order ledger', './scripts/verify-order-ledger.cjs', [row.id]);
  }
}

async function main() {
  run('Unit tests', 'npm run test');
  run('Production build', 'npm run build');
  run('API E2E', 'npm run e2e:api');
  run('Marketplace A-to-Z E2E', 'npm run e2e:a2z');
  run('Browser E2E', 'npm run e2e:browser');
  run('PayPal config', 'npm run check:paypal');
  run('PayPal checkout smoke', 'npm run check:paypal:checkout');
  await auditRecentCompletedOrders(Number(process.env.TEST_ALL_RECENT_ORDER_LIMIT || 5) || 5);

  console.log('\nAll non-interactive Beezio checks passed.');
  console.log('Note: full PayPal capture still requires payer approval unless sandbox buyer automation credentials are provided.');
  console.log('Run npm run check:go-live separately when live PayPal credentials are configured.');
}

main().catch((error) => {
  console.error(`\nTest-all failed: ${error.message || error}`);
  process.exit(1);
});
