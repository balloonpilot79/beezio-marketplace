import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { getPayPalAccessToken, getPayPalBaseUrl } from './_lib/paypal';
import { fetchPayPalPayoutBatchDetails, normalizePayoutItemStatus } from './_lib/paypalPayoutReconciliation';

type Body = {
  batch_id?: string;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    const body = parseJson<Body>(event.body);
    const batchId = String(body?.batch_id || '').trim();

    const supabaseAdmin = createSupabaseAdmin();

    const { data: batches, error: batchError } = batchId
      ? await supabaseAdmin
          .from('payout_batches')
          .select('id, provider_batch_id, status')
          .eq('id', batchId)
          .limit(1)
      : await supabaseAdmin
          .from('payout_batches')
          .select('id, provider_batch_id, status')
          .in('status', ['SUBMITTED', 'PARTIAL', 'RECONCILIATION_REQUIRED'])
          .limit(20);

    if (batchError) return json(500, { error: batchError.message });

    const rows = (batches as any[]) || [];
    if (!rows.length) return json(200, { ok: true, message: 'No batches to sync' });

    const token = await getPayPalAccessToken();
    const baseUrl = await getPayPalBaseUrl();

    const results: any[] = [];

    for (const b of rows) {
      const providerBatchId = String(b.provider_batch_id || '').trim();
      if (!providerBatchId) continue;

      const payoutBatchResult = await fetchPayPalPayoutBatchDetails({
        baseUrl,
        providerBatchId,
        token,
      });
      const apiData = payoutBatchResult.data;
      if (!payoutBatchResult.ok) {
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
          const payeeType =
            String(payoutItemRow.payee_role).toUpperCase() === 'SELLER'
              ? 'seller'
              : String(payoutItemRow.payee_role).toUpperCase() === 'PARTNER'
                ? 'affiliate'
                : 'influencer';

          if (payoutItemRow?.ledger_id) {
            await supabaseAdmin
              .from('payout_snapshots')
              .update({ status: 'PAID', paid_at: paidAt, updated_at: paidAt } as any)
              .eq('ledger_id', String(payoutItemRow.ledger_id))
              .eq('payee_user_id', String(payoutItemRow.payee_user_id))
              .eq('payee_role', String(payoutItemRow.payee_role));
          }

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
            // non-fatal for environments without the itemized ledger migration
          }
        } else if (status === 'FAILED' && payoutItemRow?.payee_user_id && payoutItemRow?.payee_role) {
          const updatedAt = new Date().toISOString();
          const payeeType =
            String(payoutItemRow.payee_role).toUpperCase() === 'SELLER'
              ? 'seller'
              : String(payoutItemRow.payee_role).toUpperCase() === 'PARTNER'
                ? 'affiliate'
                : 'influencer';

          if (payoutItemRow?.ledger_id) {
            await supabaseAdmin
              .from('payout_snapshots')
              .update({ updated_at: updatedAt } as any)
              .eq('ledger_id', String(payoutItemRow.ledger_id))
              .eq('payee_user_id', String(payoutItemRow.payee_user_id))
              .eq('payee_role', String(payoutItemRow.payee_role));
          }

          try {
            const query = supabaseAdmin
              .from('order_money_ledger')
              .update({
                status: 'ready',
                payout_batch_id: null,
                updated_at: updatedAt,
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
            // non-fatal for environments without the itemized ledger migration
          }
        }
      }

      // Decide batch status
      const batchStatus = String((apiData as any)?.batch_header?.batch_status || '').toUpperCase();
      const normalized =
        batchStatus === 'SUCCESS' ? 'PAID' : batchStatus === 'PROCESSING' ? 'SUBMITTED' : batchStatus === 'DENIED' ? 'FAILED' : 'PARTIAL';

      await supabaseAdmin
        .from('payout_batches')
        .update({ status: normalized } as any)
        .eq('id', b.id);

      // Mark a ledger PAID only when all expected role payouts for that ledger are SENT.
      // (A ledger can have multiple payees: seller+partner+influencer.)
      const { data: batchPayoutRows } = await supabaseAdmin
        .from('payout_items')
        .select('ledger_id')
        .eq('payout_batch_id', b.id);

      const ledgerIdsTouched = Array.from(
        new Set(((batchPayoutRows as any[]) || []).map((r) => String(r?.ledger_id || '')).filter(Boolean))
      );

      if (ledgerIdsTouched.length) {
        const [{ data: ledgers }, { data: expectedSnapshots }] = await Promise.all([
          supabaseAdmin
          .from('payout_ledger')
          .select('id, status, seller_id, partner_id, influencer_id, seller_earnings, partner_earnings, influencer_earnings')
          .in('id', ledgerIdsTouched),
          supabaseAdmin
            .from('payout_snapshots')
            .select('ledger_id, payee_user_id, payee_role, amount')
            .in('ledger_id', ledgerIdsTouched),
        ]);

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

        const expectedByLedger = new Map<string, Set<string>>();
        for (const snapshot of (expectedSnapshots as any[]) || []) {
          const ledgerId = String(snapshot?.ledger_id || '').trim();
          const payeeUserId = String(snapshot?.payee_user_id || '').trim();
          const payeeRole = String(snapshot?.payee_role || '').trim().toUpperCase();
          if (!ledgerId || !payeeUserId || !payeeRole || Number(snapshot?.amount || 0) <= 0) continue;
          const set = expectedByLedger.get(ledgerId) || new Set<string>();
          set.add(`${payeeUserId}::${payeeRole}`);
          expectedByLedger.set(ledgerId, set);
        }

        for (const l of (ledgers as any[]) || []) {
          const ledgerId = String(l?.id || '').trim();
          if (!ledgerId) continue;
          if (String(l?.status || '') !== 'READY_TO_PAY') continue;

          const frozenExpected = expectedByLedger.get(ledgerId);
          const expected: string[] = frozenExpected ? Array.from(frozenExpected) : [];
          if (!expected.length) {
            if (l?.seller_id && Number(l?.seller_earnings || 0) > 0) expected.push(`${String(l.seller_id)}::SELLER`);
            if (l?.partner_id && Number(l?.partner_earnings || 0) > 0) expected.push(`${String(l.partner_id)}::PARTNER`);
            if (l?.influencer_id && Number(l?.influencer_earnings || 0) > 0) expected.push(`${String(l.influencer_id)}::INFLUENCER`);
          }

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

    return json(200, { ok: true, results });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
