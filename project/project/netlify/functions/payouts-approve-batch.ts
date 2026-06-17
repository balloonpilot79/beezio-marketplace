import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import { getEnvBool } from './_lib/env';
import { getPayPalAccessToken, getPayPalBaseUrl, paypalRequestId } from './_lib/paypal';
import { toAmountString } from './_lib/money';

type Body = {
  batch_id?: string;
};

const describePayPalPayoutFailure = (payload: any) => {
  const pieces = [
    String(payload?.name || '').trim(),
    String(payload?.message || '').trim(),
    String(payload?.details?.[0]?.issue || '').trim(),
    String(payload?.details?.[0]?.description || '').trim(),
  ].filter(Boolean);
  const summary = Array.from(new Set(pieces)).join(' | ') || 'Unknown PayPal payout error';
  const upper = summary.toUpperCase();

  if (upper.includes('NOT_AUTHORIZED') || upper.includes('PERMISSION') || upper.includes('AUTHORIZATION')) {
    return `${summary}. This PayPal account likely still needs Standard Payouts access enabled in PayPal.`;
  }
  if (upper.includes('INSUFFICIENT_FUNDS') || upper.includes('BALANCE')) {
    return `${summary}. Add enough PayPal balance to cover the payout run and PayPal fees.`;
  }
  if (upper.includes('BUSINESS')) {
    return `${summary}. PayPal Standard Payouts requires a PayPal business account with identity, email, and bank setup completed.`;
  }
  return summary;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);

    if (getEnvBool('PAYOUTS_PAUSED', false)) {
      return json(503, { error: 'Payouts are temporarily paused.', code: 'PAYOUTS_PAUSED' });
    }

    if (!getEnvBool('PAYOUTS_ENABLED', getEnvBool('PAYPAL_PAYOUTS_API_ENABLED', false))) {
      return json(503, { error: 'Payouts are disabled (set PAYOUTS_ENABLED=true).', code: 'PAYOUTS_DISABLED' });
    }

    const body = parseJson<Body>(event.body);
    const batchId = String(body?.batch_id || '').trim();
    if (!batchId) {
      return json(400, { error: 'Missing batch_id' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('payout_batches')
      .select('id, status')
      .eq('id', batchId)
      .maybeSingle();

    if (batchError) return json(500, { error: batchError.message });
    if (!batch) return json(404, { error: 'Payout batch not found' });

    const batchStatus = String((batch as any)?.status || '').trim().toUpperCase();
    if (batchStatus !== 'PREPARED') {
      return json(409, { error: `Batch ${batchId} is not awaiting approval. Current status: ${batchStatus || 'UNKNOWN'}` });
    }

    const { data: payoutItems, error: itemsError } = await supabaseAdmin
      .from('payout_items')
      .select('id, recipient, amount, status')
      .eq('payout_batch_id', batchId)
      .eq('status', 'PREPARED');

    if (itemsError) return json(500, { error: itemsError.message });

    const items = ((payoutItems as any[]) || []).filter((row) => String(row?.recipient || '').trim() && Number(row?.amount || 0) > 0);
    if (!items.length) {
      return json(400, { error: 'Prepared batch has no payout items ready for approval.' });
    }

    const token = await getPayPalAccessToken();
    const baseUrl = await getPayPalBaseUrl();

    const payPalItems = items.map((row) => ({
      recipient_type: 'EMAIL',
      receiver: String(row.recipient).toLowerCase(),
      amount: { value: toAmountString(Number(row.amount)), currency: 'USD' },
      recipient_wallet: 'PAYPAL',
      notification_language: 'en-US',
      note: 'Beezio payout',
      sender_item_id: String(row.id),
    }));

    const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': paypalRequestId(`bzo_payout_${batchId}`),
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `BZO_${batchId}`,
          email_subject: 'Your Beezio payout has been approved',
          email_message: 'Your approved Beezio payout is being processed.',
        },
        items: payPalItems,
      }),
    });

    const apiData = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(400, {
        error: 'PayPal payout batch failed during approval',
        details: describePayPalPayoutFailure(apiData),
        paypal_response: apiData,
      });
    }

    const providerBatchId = String((apiData as any)?.batch_header?.payout_batch_id || '').trim() || null;

    await supabaseAdmin
      .from('payout_items')
      .update({
        status: 'CREATED',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('payout_batch_id', batchId)
      .eq('status', 'PREPARED');

    await supabaseAdmin
      .from('payout_batches')
      .update({
        status: 'SUBMITTED',
        provider_batch_id: providerBatchId,
        submitted_at: new Date().toISOString(),
      } as any)
      .eq('id', batchId)
      .eq('status', 'PREPARED');

    return json(200, {
      ok: true,
      batch_id: batchId,
      provider_batch_id: providerBatchId,
      item_count: payPalItems.length,
      paypal_response: apiData,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
