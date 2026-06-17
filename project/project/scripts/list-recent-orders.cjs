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

const limit = Math.max(1, Math.min(20, Number(process.argv[2] || 5) || 5));

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data || []).map((row) => ({
    id: row.id || null,
    order_number: row.order_number || null,
    provider_order_id: row.provider_order_id || null,
    provider_capture_id: row.provider_capture_id || null,
    created_at: row.created_at || null,
    status: row.status || null,
    payment_status: row.payment_status || null,
    total_charged: row.total_charged ?? row.total_amount ?? null,
  }));

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(`Recent-order lookup failed: ${err.message || err}`);
  process.exit(1);
});