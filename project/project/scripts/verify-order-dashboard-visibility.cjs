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

const identifier = String(process.argv[2] || '').trim();
if (!identifier) {
  console.error('Usage: node scripts/verify-order-dashboard-visibility.cjs <order_id|provider_order_id|order_number>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

function moneySummary(rows, payeeType) {
  return round2(
    (rows || [])
      .filter((row) => asText(row?.payee_type).toLowerCase() === payeeType)
      .reduce((sum, row) => sum + Number(row?.net_amount || row?.gross_amount || 0), 0)
  );
}

async function main() {
  const order = await findOrder(identifier);
  if (!order) {
    console.error('Order not found');
    process.exit(1);
  }

  const orderId = asText(order.id);
  const [{ data: ledger }, { data: snapshots }, { data: moneyRows }] = await Promise.all([
    supabase
      .from('payout_ledger')
      .select('id, order_id, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings, beezio_profit, paypal_fee_estimate, status, hold_release_at')
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('payout_snapshots')
      .select('id, order_id, payee_user_id, payee_role, amount, status, snapshot_json')
      .eq('order_id', orderId),
    supabase
      .from('order_money_ledger')
      .select('id, order_id, payee_type, payee_id, gross_amount, net_amount, status')
      .eq('order_id', orderId),
  ]);

  const snapshotRows = Array.isArray(snapshots) ? snapshots : [];
  const moneyLedgerRows = Array.isArray(moneyRows) ? moneyRows : [];
  const sellerSnapshot = snapshotRows.find((row) => asText(row?.payee_role).toUpperCase() === 'SELLER');
  const affiliateSnapshot = snapshotRows.find((row) => asText(row?.payee_role).toUpperCase() === 'PARTNER');
  const influencerSnapshot = snapshotRows.find((row) => asText(row?.payee_role).toUpperCase() === 'INFLUENCER');

  const sellerVisible = Boolean(sellerSnapshot);

  const affiliateExpected = Math.max(Number(ledger?.partner_earnings || 0), moneySummary(moneyLedgerRows, 'affiliate')) > 0;
  const affiliateVisible = !affiliateExpected || Boolean(affiliateSnapshot);

  const influencerExpected = Math.max(Number(ledger?.influencer_earnings || 0), moneySummary(moneyLedgerRows, 'influencer')) > 0;
  const influencerVisible = !influencerExpected || Boolean(influencerSnapshot);

  const adminVisible = Boolean(ledger?.id) && moneyLedgerRows.length > 0;

  const output = {
    order: {
      id: orderId,
      order_number: asText(order.order_number) || null,
      provider_order_id: asText(order.provider_order_id) || null,
      status: asText(order.status) || null,
      payment_status: asText(order.payment_status) || null,
      seller_id: asText(order.seller_id) || null,
      partner_id: asText(order.partner_id || order.affiliate_id || affiliateSnapshot?.payee_user_id) || null,
      influencer_id: asText(order.influencer_id || influencerSnapshot?.payee_user_id) || null,
    },
    visibility: {
      seller_dashboard: sellerVisible,
      affiliate_dashboard: affiliateVisible,
      influencer_dashboard: influencerVisible,
      admin_sales_ledger: adminVisible,
    },
    splits: {
      seller: round2(Number(ledger?.seller_earnings || 0)),
      affiliate: round2(Number(ledger?.partner_earnings || 0)),
      influencer: round2(Number(ledger?.influencer_earnings || 0)),
      beezio: round2(Number(ledger?.beezio_profit || 0)),
      paypal_fee: round2(Number(ledger?.paypal_fee_estimate || 0)),
      money_ledger_seller: moneySummary(moneyLedgerRows, 'seller'),
      money_ledger_affiliate: moneySummary(moneyLedgerRows, 'affiliate'),
      money_ledger_influencer: moneySummary(moneyLedgerRows, 'influencer'),
      money_ledger_beezio: moneySummary(moneyLedgerRows, 'beezio'),
    },
    counts: {
      payout_snapshots: snapshotRows.length,
      order_money_ledger_rows: moneyLedgerRows.length,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
