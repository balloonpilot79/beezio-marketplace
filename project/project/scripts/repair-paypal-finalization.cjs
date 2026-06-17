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

const siteUrl = String(
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  process.env.SITE_URL ||
  'https://beezio.co'
).replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findBrokenOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id,order_number,provider_order_id,payment_status,status')
    .eq('payment_status', 'paid')
    .not('provider_order_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const orderIds = (orders || []).map((order) => order.id);
  if (!orderIds.length) return [];

  const [{ data: ledgerRows }, { data: snapshotRows }, { data: moneyRows }] = await Promise.all([
    supabase.from('payout_ledger').select('order_id').in('order_id', orderIds),
    supabase.from('payout_snapshots').select('order_id').in('order_id', orderIds),
    supabase.from('order_money_ledger').select('order_id').in('order_id', orderIds),
  ]);

  const ledgerSet = new Set((ledgerRows || []).map((row) => row.order_id));
  const snapshotSet = new Set((snapshotRows || []).map((row) => row.order_id));
  const moneySet = new Set((moneyRows || []).map((row) => row.order_id));

  return (orders || []).filter(
    (order) => ledgerSet.has(order.id) && (!snapshotSet.has(order.id) || !moneySet.has(order.id))
  );
}

async function repairOrder(order) {
  const response = await fetch(`${siteUrl}/.netlify/functions/paypal-capture-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID: order.provider_order_id }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${order.order_number || order.id}: ${payload?.error || response.statusText}`);
  }

  return payload;
}

async function run() {
  const brokenOrders = await findBrokenOrders();
  if (!brokenOrders.length) {
    console.log('No broken paid PayPal orders found.');
    return;
  }

  console.log(`Found ${brokenOrders.length} paid PayPal order(s) missing snapshots or money ledger.`);

  for (const order of brokenOrders) {
    const result = await repairOrder(order);
    console.log(
      `repaired ${order.order_number || order.id}: idempotent=${Boolean(result?.idempotent)} repaired=${Boolean(result?.repaired)}`
    );
  }
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
