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

const identifier = String(process.argv[2] || '').trim();
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const asText = (value) => String(value || '').trim();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findOrder(value) {
  const fields = UUID_REGEX.test(value)
    ? ['id', 'provider_order_id', 'order_number']
    : ['provider_order_id', 'order_number'];
  for (const field of fields) {
    const { data, error } = await supabase.from('orders').select('*').eq(field, value).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

function expectedAffiliateAmount(order, ledger, moneyRows) {
  const moneyAmount = round2(
    (moneyRows || [])
      .filter((row) => asText(row?.payee_type).toLowerCase() === 'affiliate')
      .reduce((sum, row) => sum + Number(row?.net_amount || row?.gross_amount || 0), 0)
  );
  return Math.max(
    round2(ledger?.partner_earnings || 0),
    round2(order?.affiliate_commission || order?.affiliate_fee_amount || 0),
    moneyAmount
  );
}

function expectedInfluencerAmount(order, ledger, moneyRows) {
  const moneyAmount = round2(
    (moneyRows || [])
      .filter((row) => asText(row?.payee_type).toLowerCase() === 'influencer')
      .reduce((sum, row) => sum + Number(row?.net_amount || row?.gross_amount || 0), 0)
  );
  return Math.max(
    round2(ledger?.influencer_earnings || 0),
    round2(order?.ref_or_fundraiser_fee_amount || 0),
    moneyAmount
  );
}

async function loadCandidateOrders() {
  if (identifier) {
    const order = await findOrder(identifier);
    if (!order) throw new Error('Order not found');
    return [order];
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,provider_order_id,payment_provider,payment_status,status,seller_id,partner_id,affiliate_id,influencer_id,affiliate_commission,affiliate_fee_amount,ref_or_fundraiser_fee_amount')
    .eq('payment_status', 'paid')
    .not('provider_order_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

function isBroken(order, ledger, snapshots, moneyRows) {
  const roles = new Set((snapshots || []).map((row) => asText(row?.payee_role).toUpperCase()).filter(Boolean));
  const hasSeller = roles.has('SELLER');
  const hasAffiliate = roles.has('PARTNER');
  const hasInfluencer = roles.has('INFLUENCER');
  const affiliateExpected = expectedAffiliateAmount(order, ledger, moneyRows) > 0;
  const influencerExpected = expectedInfluencerAmount(order, ledger, moneyRows) > 0;
  const missingLedger = !ledger?.id;
  const missingSeller = !hasSeller;
  const missingAffiliate = affiliateExpected && !hasAffiliate;
  const missingInfluencer = influencerExpected && !hasInfluencer;
  const attributionGap = Boolean(hasInfluencer && !asText(order?.influencer_id));

  return missingLedger || missingSeller || missingAffiliate || missingInfluencer || attributionGap;
}

async function repairOrder(order) {
  const response = await fetch(`${siteUrl}/.netlify/functions/paypal-capture-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID: order.provider_order_id, forceRepair: true }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${order.order_number || order.id}: ${payload?.error || response.statusText}`);
  }

  return payload;
}

async function run() {
  const orders = await loadCandidateOrders();
  if (!orders.length) {
    console.log('No matching paid PayPal orders found.');
    return;
  }

  const orderIds = orders.map((order) => order.id);
  const [{ data: ledgers }, { data: snapshots }, { data: moneyRows }] = await Promise.all([
    supabase.from('payout_ledger').select('*').in('order_id', orderIds),
    supabase.from('payout_snapshots').select('*').in('order_id', orderIds),
    supabase.from('order_money_ledger').select('*').in('order_id', orderIds),
  ]);
  const { data: itemRows } = await supabase.from('order_items').select('order_id').in('order_id', orderIds);

  const ledgerByOrder = new Map((ledgers || []).map((row) => [row.order_id, row]));
  const snapshotsByOrder = new Map();
  for (const row of snapshots || []) {
    const current = snapshotsByOrder.get(row.order_id) || [];
    current.push(row);
    snapshotsByOrder.set(row.order_id, current);
  }
  const moneyByOrder = new Map();
  for (const row of moneyRows || []) {
    const current = moneyByOrder.get(row.order_id) || [];
    current.push(row);
    moneyByOrder.set(row.order_id, current);
  }
  const itemCountByOrder = new Map();
  for (const row of itemRows || []) {
    const current = Number(itemCountByOrder.get(row.order_id) || 0);
    itemCountByOrder.set(row.order_id, current + 1);
  }

  const broken = orders.filter((order) => {
    const paymentProvider = asText(order.payment_provider).toUpperCase();
    const hasItems = Number(itemCountByOrder.get(order.id) || 0) > 0;
    if (!hasItems) return false;
    if (paymentProvider && paymentProvider !== 'PAYPAL') return false;
    return isBroken(order, ledgerByOrder.get(order.id), snapshotsByOrder.get(order.id), moneyByOrder.get(order.id));
  });

  if (!broken.length) {
    console.log('No paid PayPal orders need dashboard visibility repair.');
    return;
  }

  console.log(`Found ${broken.length} paid PayPal order(s) needing visibility repair.`);
  const failures = [];
  for (const order of broken) {
    try {
      const result = await repairOrder(order);
      console.log(
        `repaired ${order.order_number || order.id}: idempotent=${Boolean(result?.idempotent)} repaired=${Boolean(result?.repaired)}`
      );
    } catch (error) {
      failures.push(`${order.order_number || order.id}: ${error?.message || error}`);
    }
  }

  if (failures.length) {
    console.error('Some orders could not be repaired:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
