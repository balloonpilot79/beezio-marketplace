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

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const nearlyEqual = (left, right, tolerance = 0.01) => Math.abs(round2(left) - round2(right)) <= tolerance;
const PAYPAL_PERCENT = Math.max(0, Number(process.env.PAYPAL_FEE_PERCENT || 0.0399) || 0.0399);
const PAYPAL_FIXED = Math.max(0, Number(process.env.PAYPAL_FEE_FIXED || 0.6) || 0.6);

const extractMissingColumnName = (message) => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg && pg[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst && pgrst[1]) return pgrst[1];
  return null;
};

async function updateWithFallback(table, id, payload) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from(table).update(nextPayload).eq('id', id);
    if (!error) return;

    const missing = extractMissingColumnName(error.message);
    if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
      delete nextPayload[missing];
      continue;
    }

    throw error;
  }
}

async function run() {
  const { data: ledgerRows, error } = await supabase
    .from('payout_ledger')
    .select(`
      id,
      order_id,
      gross_amount,
      seller_earnings,
      partner_earnings,
      influencer_earnings,
      beezio_fee,
      beezio_fee_gross,
      beezio_fee_net,
      beezio_profit,
      paypal_fee_estimate,
      orders!inner(id, payment_provider, payment_status)
    `)
    .eq('orders.payment_provider', 'PAYPAL')
    .eq('orders.payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(ledgerRows) ? ledgerRows : [];
  let updatedCount = 0;

  for (const row of rows) {
    const gross = round2(Number(row.gross_amount || 0));
    const seller = round2(Number(row.seller_earnings || 0));
    const partner = round2(Number(row.partner_earnings || 0));
    const influencer = round2(Number(row.influencer_earnings || 0));
    const paypalFee = round2((gross * PAYPAL_PERCENT) + PAYPAL_FIXED);

    const beezioAfterProcessor = round2(Math.max(gross - seller - partner - influencer - paypalFee, 0));

    const needsLedgerUpdate =
      !nearlyEqual(row.paypal_fee_estimate, paypalFee) ||
      !nearlyEqual(row.beezio_fee, beezioAfterProcessor) ||
      !nearlyEqual(row.beezio_fee_gross, beezioAfterProcessor) ||
      !nearlyEqual(row.beezio_fee_net, beezioAfterProcessor) ||
      !nearlyEqual(row.beezio_profit, beezioAfterProcessor);

    if (needsLedgerUpdate) {
      await updateWithFallback('payout_ledger', row.id, {
        beezio_fee: beezioAfterProcessor,
        beezio_fee_gross: beezioAfterProcessor,
        beezio_fee_net: beezioAfterProcessor,
        platform_fee_gross: beezioAfterProcessor,
        platform_fee_net: beezioAfterProcessor,
        beezio_profit: beezioAfterProcessor,
        paypal_fee_estimate: paypalFee,
        updated_at: new Date().toISOString(),
      });
    }

    const { data: moneyRows, error: moneyError } = await supabase
      .from('order_money_ledger')
      .select('id, gross_amount, net_amount, metadata')
      .eq('order_id', row.order_id)
      .eq('payee_type', 'beezio');

    if (moneyError) {
      throw moneyError;
    }

    for (const moneyRow of moneyRows || []) {
      const needsMoneyUpdate =
        !nearlyEqual(moneyRow.gross_amount, beezioAfterProcessor) ||
        !nearlyEqual(moneyRow.net_amount, beezioAfterProcessor);

      if (!needsMoneyUpdate) continue;

      const nextMetadata = {
        ...(moneyRow.metadata && typeof moneyRow.metadata === 'object' ? moneyRow.metadata : {}),
        beezio_fee_gross: beezioAfterProcessor,
        beezio_fee_net: beezioAfterProcessor,
        beezio_profit: beezioAfterProcessor,
        paypal_fee_estimate: paypalFee,
      };

      await updateWithFallback('order_money_ledger', moneyRow.id, {
        gross_amount: beezioAfterProcessor,
        net_amount: beezioAfterProcessor,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      });
    }

    if (needsLedgerUpdate || (moneyRows || []).some((moneyRow) => !nearlyEqual(moneyRow.gross_amount, beezioAfterProcessor) || !nearlyEqual(moneyRow.net_amount, beezioAfterProcessor))) {
      updatedCount += 1;
      console.log(`repaired ${row.order_id}: paypal=${paypalFee.toFixed(2)} beezio=${beezioAfterProcessor.toFixed(2)}`);
    }
  }

  console.log(`repair complete: ${updatedCount} order(s) updated`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
