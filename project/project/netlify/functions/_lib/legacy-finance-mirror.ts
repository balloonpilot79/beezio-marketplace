const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const asText = (value: unknown) => String(value || '').trim();

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const isMissingRelationError = (error: any): boolean => {
  const message = [
    String((error as any)?.message || ''),
    String((error as any)?.details || ''),
    String((error as any)?.hint || ''),
  ]
    .join(' ')
    .toLowerCase();
  return message.includes('does not exist') || message.includes('could not find the table');
};

const selectWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filters: Array<{ column: string; value: unknown }>,
  limit = 50
) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let query = supabaseAdmin.from(table).select(selected.join(','));
    for (const filter of filters) {
      query = query.eq(filter.column, filter.value);
    }
    if (limit > 0) query = query.limit(limit);
    const { data, error } = await query;
    if (!error) return { data: (data as any[]) || [], selected, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], selected, error: lastError };
};

const insertWithFallback = async (supabaseAdmin: any, table: string, payload: any) => {
  let attemptPayload = Array.isArray(payload) ? payload.map((row) => ({ ...row })) : { ...payload };
  let lastError: any = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(attemptPayload as any).select();
    if (!error) return { data, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing) {
      if (Array.isArray(attemptPayload)) {
        attemptPayload = attemptPayload.map((row) => {
          const next = { ...row };
          delete next[missing];
          return next;
        });
      } else if (Object.prototype.hasOwnProperty.call(attemptPayload, missing)) {
        const next = { ...attemptPayload };
        delete next[missing];
        attemptPayload = next;
      } else {
        break;
      }
      continue;
    }
    break;
  }

  return { data: null, error: lastError };
};

type LegacyFinanceMirrorParams = {
  supabaseAdmin: any;
  orderId: string;
  sellerId: string | null;
  partnerId: string | null;
  influencerTotal: number;
  influencerPayeeIds: string[];
  subtotalListing: number;
  totalCharged: number;
  sellerEarnings: number;
  partnerEarnings: number;
  beezioProfit: number;
  currency: string;
  holdReleaseAt: string | null;
  paidAt: string;
  providerCaptureId: string | null;
};

export async function mirrorOrderToLegacyFinance(params: LegacyFinanceMirrorParams) {
  const {
    supabaseAdmin,
    orderId,
    sellerId,
    partnerId,
    influencerTotal,
    influencerPayeeIds,
    subtotalListing,
    totalCharged,
    sellerEarnings,
    partnerEarnings,
    beezioProfit,
    currency,
    holdReleaseAt,
    paidAt,
    providerCaptureId,
  } = params;

  const existingTx = await selectWithFallback(
    supabaseAdmin,
    'transactions',
    ['id', 'order_id', 'status'],
    [{ column: 'order_id', value: orderId }],
    1
  );

  if (existingTx.error && isMissingRelationError(existingTx.error)) {
    return { ok: false, skipped: true, reason: 'transactions_missing' };
  }
  if (existingTx.error) throw new Error(String((existingTx.error as any)?.message || 'Failed to read transactions'));

  let transactionId = asText((existingTx.data as any[])?.[0]?.id) || null;

  if (!transactionId) {
    const transactionPayload: Record<string, unknown> = {
      order_id: orderId,
      stripe_payment_intent_id: providerCaptureId || `paypal_capture_${orderId}`,
      stripe_charge_id: providerCaptureId || null,
      total_amount: round2(totalCharged || subtotalListing),
      amount_total_cents: Math.round(round2(totalCharged || subtotalListing) * 100),
      currency: asText(currency || 'USD') || 'USD',
      status: 'completed',
      seller_id: sellerId,
      amount: round2(totalCharged || subtotalListing),
      created_at: paidAt,
      updated_at: paidAt,
    };

    const insertedTx = await insertWithFallback(supabaseAdmin, 'transactions', transactionPayload);
    if (insertedTx.error && isMissingRelationError(insertedTx.error)) {
      return { ok: false, skipped: true, reason: 'transactions_missing' };
    }
    if (insertedTx.error) throw new Error(String((insertedTx.error as any)?.message || 'Failed to create transaction mirror'));
    transactionId = asText((insertedTx.data as any[])?.[0]?.id) || transactionId;
  }

  const existingDistributions = await selectWithFallback(
    supabaseAdmin,
    'payment_distributions',
    ['id', 'recipient_type', 'recipient_id', 'order_id'],
    [{ column: 'order_id', value: orderId }],
    20
  );

  if (existingDistributions.error && isMissingRelationError(existingDistributions.error)) {
    return { ok: false, skipped: true, reason: 'payment_distributions_missing', transactionId };
  }
  if (existingDistributions.error) {
    throw new Error(String((existingDistributions.error as any)?.message || 'Failed to read payment distributions'));
  }

  const existingKeys = new Set(
    ((existingDistributions.data as any[]) || []).map((row: any) => `${asText(row?.recipient_type).toLowerCase()}::${asText(row?.recipient_id) || 'platform'}`)
  );

  const baseDistribution = {
    transaction_id: transactionId,
    order_id: orderId,
    status: 'pending',
    available_at: holdReleaseAt,
    paid_at: null,
    created_at: paidAt,
    updated_at: paidAt,
  };

  const distributionRows: Array<Record<string, unknown>> = [];
  const pushDistribution = (recipientType: string, recipientId: string | null, amount: number, percentage: number) => {
    const normalizedAmount = round2(amount);
    if (normalizedAmount <= 0) return;
    const key = `${recipientType.toLowerCase()}::${recipientId || 'platform'}`;
    if (existingKeys.has(key)) return;
    distributionRows.push({
      ...baseDistribution,
      recipient_type: recipientType,
      recipient_id: recipientId,
      amount: normalizedAmount,
      percentage: round2(percentage),
    });
  };

  const grossBase = Math.max(round2(subtotalListing || totalCharged), 0.01);
  pushDistribution('seller', sellerId, sellerEarnings, (sellerEarnings / grossBase) * 100);
  pushDistribution('affiliate', partnerId, partnerEarnings, (partnerEarnings / grossBase) * 100);

  const influencerIds = Array.from(new Set(influencerPayeeIds.map((value) => asText(value)).filter(Boolean)));
  if (influencerIds.length === 1) {
    pushDistribution('influencer', influencerIds[0], influencerTotal, (influencerTotal / grossBase) * 100);
  } else if (influencerIds.length > 1 && influencerTotal > 0) {
    const splitAmount = round2(influencerTotal / influencerIds.length);
    influencerIds.forEach((influencerId, index) => {
      const isLast = index === influencerIds.length - 1;
      const allocated = isLast
        ? round2(influencerTotal - splitAmount * (influencerIds.length - 1))
        : splitAmount;
      pushDistribution('influencer', influencerId, allocated, (allocated / grossBase) * 100);
    });
  }

  pushDistribution('platform', null, beezioProfit, (beezioProfit / grossBase) * 100);

  if (distributionRows.length > 0) {
    const insertedDistributions = await insertWithFallback(supabaseAdmin, 'payment_distributions', distributionRows);
    if (insertedDistributions.error && !isMissingRelationError(insertedDistributions.error)) {
      throw new Error(String((insertedDistributions.error as any)?.message || 'Failed to mirror payment distributions'));
    }
  }

  const monthYear = String(paidAt || new Date().toISOString()).slice(0, 7);
  const existingRevenue = await selectWithFallback(
    supabaseAdmin,
    'platform_revenue',
    ['id', 'amount', 'transaction_id'],
    transactionId ? [{ column: 'transaction_id', value: transactionId }] : [{ column: 'order_id', value: orderId }],
    10
  );

  if (!existingRevenue.error && ((existingRevenue.data as any[]) || []).length === 0 && beezioProfit > 0) {
    await insertWithFallback(supabaseAdmin, 'platform_revenue', {
      transaction_id: transactionId,
      order_id: orderId,
      amount: round2(beezioProfit),
      revenue_type: 'fee',
      month_year: monthYear,
      description: 'PayPal capture platform fee mirror',
      created_at: paidAt,
    });
  }

  return {
    ok: true,
    transactionId,
    distributionsInserted: distributionRows.length,
  };
}
