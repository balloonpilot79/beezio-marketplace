import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { getEnvBool } from './_lib/env';
import { getPayPalAccessToken, getPayPalBaseUrl } from './_lib/paypal';

const normalizePayoutItemStatus = (transactionStatus: string) => {
  const txStatus = String(transactionStatus || '').trim().toUpperCase();
  if (txStatus === 'SUCCESS') {
    return { status: 'SENT', errorMessage: null as string | null };
  }

  if (
    txStatus === 'FAILED' ||
    txStatus === 'BLOCKED' ||
    txStatus === 'DENIED' ||
    txStatus === 'RETURNED' ||
    txStatus === 'REFUNDED' ||
    txStatus === 'UNCLAIMED'
  ) {
    return { status: 'FAILED', errorMessage: txStatus || 'FAILED' };
  }

  return { status: 'CREATED', errorMessage: null as string | null };
};

export const config = {
  // Hourly sync of PayPal payout batch statuses.
  schedule: '15 * * * *',
};

export const handler: Handler = async () => {
  const scheduledEnabled = getEnvBool('PAYOUTS_SCHEDULED_ENABLED', false);
  if (!scheduledEnabled) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, reason: 'PAYOUTS_SCHEDULED_ENABLED=false' }),
    };
  }

  const usePaypalApi = getEnvBool('PAYOUTS_ENABLED', getEnvBool('PAYPAL_PAYOUTS_API_ENABLED', false));
  if (!usePaypalApi) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, skipped: true, reason: 'PAYOUTS_ENABLED=false' }),
    };
  }

  const supabaseAdmin = createSupabaseAdmin();

  const { data: batches, error: batchError } = await supabaseAdmin
    .from('payout_batches')
    .select('id, provider_batch_id, status')
    .in('status', ['SUBMITTED', 'PARTIAL'])
    .limit(20);

  if (batchError) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: batchError.message }),
    };
  }

  const rows = (batches as any[]) || [];
  if (!rows.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, message: 'No batches to sync' }),
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = await getPayPalBaseUrl();

  const results: any[] = [];

  for (const b of rows) {
    const providerBatchId = String(b.provider_batch_id || '').trim();
    if (!providerBatchId) continue;

    const res = await fetch(`${baseUrl}/v1/payments/payouts/${encodeURIComponent(providerBatchId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const apiData = await res.json().catch(() => ({}));
    if (!res.ok) {
      results.push({ id: b.id, provider_batch_id: providerBatchId, ok: false, error: apiData });
      continue;
    }

    const items = ((apiData as any)?.items || []) as any[];

    // Update payout_items by sender_item_id
    for (const item of items) {
      const senderItemId = String(item?.payout_item?.sender_item_id || '').trim();
      if (!senderItemId) continue;

      const payoutItemId = String(item?.payout_item_id || '').trim() || null;
      const txStatus = String(item?.transaction_status || '').toUpperCase();
      const normalizedItem = normalizePayoutItemStatus(txStatus);
      const status = normalizedItem.status;
      const errorMessage =
        status === 'FAILED'
          ? String(item?.errors?.message || item?.errors?.name || normalizedItem.errorMessage || 'FAILED')
          : null;

      await supabaseAdmin
        .from('payout_items')
        .update({
          status,
          provider_item_id: payoutItemId,
          error_message: errorMessage,
        } as any)
        .eq('id', senderItemId);

      const { data: payoutItemRow } = await supabaseAdmin
        .from('payout_items')
        .select('ledger_id, order_money_ledger_id, payee_user_id, payee_role')
        .eq('id', senderItemId)
        .maybeSingle();

      if (status === 'SENT' && payoutItemRow?.payee_user_id && payoutItemRow?.payee_role) {
        const paidAt = new Date().toISOString();

        if (payoutItemRow?.ledger_id) {
          await supabaseAdmin
            .from('payout_snapshots')
            .update({ status: 'PAID', paid_at: paidAt, updated_at: paidAt } as any)
            .eq('ledger_id', String(payoutItemRow.ledger_id))
            .eq('payee_user_id', String(payoutItemRow.payee_user_id))
            .eq('payee_role', String(payoutItemRow.payee_role));
        }

        const payeeType =
          String(payoutItemRow.payee_role).toUpperCase() === 'SELLER'
            ? 'seller'
            : String(payoutItemRow.payee_role).toUpperCase() === 'PARTNER'
              ? 'affiliate'
              : 'influencer';

        try {
          const query = supabaseAdmin
            .from('order_money_ledger')
            .update({ status: 'paid', paid_at: paidAt, updated_at: paidAt } as any);

          if (payoutItemRow?.order_money_ledger_id) {
            await query
              .eq('id', String(payoutItemRow.order_money_ledger_id))
              .eq('status', 'ready');
          } else {
            await query
              .eq('payout_batch_id', b.id)
              .eq('payee_id', String(payoutItemRow.payee_user_id))
              .eq('payee_type', payeeType)
              .eq('status', 'ready');
          }
        } catch {
          // Itemized ledger may not be deployed in older environments.
        }
      } else if (status === 'FAILED' && payoutItemRow?.payee_user_id && payoutItemRow?.payee_role) {
        const failedAt = new Date().toISOString();
        const payeeType =
          String(payoutItemRow.payee_role).toUpperCase() === 'SELLER'
            ? 'seller'
            : String(payoutItemRow.payee_role).toUpperCase() === 'PARTNER'
              ? 'affiliate'
              : 'influencer';

        try {
          const query = supabaseAdmin
            .from('order_money_ledger')
            .update({
              status: 'ready',
              payout_batch_id: null,
              updated_at: failedAt,
            } as any);

          if (payoutItemRow?.order_money_ledger_id) {
            await query
              .eq('id', String(payoutItemRow.order_money_ledger_id))
              .in('status', ['ready', 'failed']);
          } else {
            await query
              .eq('payout_batch_id', b.id)
              .eq('payee_id', String(payoutItemRow.payee_user_id))
              .eq('payee_type', payeeType)
              .in('status', ['ready', 'failed']);
          }
        } catch {
          // Itemized ledger may not be deployed in older environments.
        }
      }
    }

    // Decide batch status
    const batchStatus = String((apiData as any)?.batch_header?.batch_status || '').toUpperCase();
    const normalized =
      batchStatus === 'SUCCESS' ? 'PAID' : batchStatus === 'PROCESSING' ? 'SUBMITTED' : batchStatus === 'DENIED' ? 'FAILED' : 'PARTIAL';

    await supabaseAdmin.from('payout_batches').update({ status: normalized } as any).eq('id', b.id);

    // Mark a ledger PAID only when all expected role payouts for that ledger are SENT.
    const { data: batchPayoutRows } = await supabaseAdmin
      .from('payout_items')
      .select('ledger_id')
      .eq('payout_batch_id', b.id);

    const ledgerIdsTouched = Array.from(
      new Set(((batchPayoutRows as any[]) || []).map((r) => String(r?.ledger_id || '')).filter(Boolean))
    );

    if (ledgerIdsTouched.length) {
      const { data: ledgers } = await supabaseAdmin
        .from('payout_ledger')
        .select('id, status, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings')
        .in('id', ledgerIdsTouched);

      const { data: sentItems } = await supabaseAdmin
        .from('payout_items')
        .select('ledger_id, payee_user_id, payee_role, status')
        .in('ledger_id', ledgerIdsTouched)
        .in('status', ['SENT']);

      const sentByLedger = new Map<string, Set<string>>();
      for (const it of (sentItems as any[]) || []) {
        const ledgerId = String(it?.ledger_id || '').trim();
        const payeeUserId = String(it?.payee_user_id || '').trim();
        const payeeRole = String(it?.payee_role || '').trim();
        if (!ledgerId || !payeeUserId || !payeeRole) continue;
        const set = sentByLedger.get(ledgerId) || new Set<string>();
        set.add(`${payeeUserId}::${payeeRole}`);
        sentByLedger.set(ledgerId, set);
      }

      for (const l of (ledgers as any[]) || []) {
        const ledgerId = String(l?.id || '').trim();
        if (!ledgerId) continue;
        if (String(l?.status || '') !== 'READY_TO_PAY') continue;

        const expected: string[] = [];
        if (l?.seller_id && Number(l?.seller_earnings || 0) > 0) expected.push(`${String(l.seller_id)}::SELLER`);
        if (l?.partner_id && Number(l?.partner_earnings || 0) > 0) expected.push(`${String(l.partner_id)}::PARTNER`);
        if (l?.influencer_id && Number(l?.influencer_earnings || 0) > 0) expected.push(`${String(l.influencer_id)}::INFLUENCER`);

        if (!expected.length) continue;
        const sentSet = sentByLedger.get(ledgerId) || new Set<string>();
        const allPaid = expected.every((k) => sentSet.has(k));
        if (!allPaid) continue;

        await supabaseAdmin
          .from('payout_ledger')
          .update({ status: 'PAID', paid_at: new Date().toISOString() } as any)
          .eq('id', ledgerId)
          .eq('status', 'READY_TO_PAY');
      }

      const { data: insuranceLedgers } = await supabaseAdmin
        .from('payout_ledger')
        .select('insurance_lead_id, paid_at')
        .in('id', ledgerIdsTouched)
        .eq('status', 'PAID')
        .not('insurance_lead_id', 'is', null);

      const paidInsuranceLeadIds = ((insuranceLedgers as any[]) || [])
        .map((row) => ({
          leadId: String(row?.insurance_lead_id || '').trim(),
          paidAt: row?.paid_at ? String(row.paid_at) : new Date().toISOString(),
        }))
        .filter((row) => row.leadId);

      if (paidInsuranceLeadIds.length) {
        const leadIds = paidInsuranceLeadIds.map((row) => row.leadId);
        const paidAt = paidInsuranceLeadIds[0]?.paidAt || new Date().toISOString();
        await Promise.all([
          supabaseAdmin
            .from('insurance_affiliate_earnings')
            .update({ status: 'paid', paid_at: paidAt, updated_at: new Date().toISOString() } as any)
            .in('lead_id', leadIds),
          supabaseAdmin
            .from('insurance_influencer_earnings')
            .update({ status: 'paid', paid_at: paidAt, updated_at: new Date().toISOString() } as any)
            .in('lead_id', leadIds),
        ]);
      }
    }

    results.push({ id: b.id, provider_batch_id: providerBatchId, ok: true, batch_status: normalized, items: items.length });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, results }),
  };
};

export default handler;
