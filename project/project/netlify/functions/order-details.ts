import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';
import { extractAuthHeader, getAuthedUser, requireAdmin } from './_lib/auth';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): boolean => UUID_REGEX.test(String(value || '').trim());

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

const selectMaybeSingleWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValue: string
) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selected.join(','))
      .eq(filterColumn, filterValue)
      .maybeSingle();
    if (!error) return { data: data || null, error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: null, error: lastError };
};

const selectWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValue: string
) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selected.join(','))
      .eq(filterColumn, filterValue);
    if (!error) return { data: (data as any[]) || [], error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], error: lastError };
};

const selectInWithFallback = async (
  supabaseAdmin: any,
  table: string,
  fields: string[],
  filterColumn: string,
  filterValues: string[]
) => {
  let selected = [...fields];
  let lastError: any = null;
  const uniqueValues = Array.from(new Set((filterValues || []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (uniqueValues.length === 0) return { data: [], error: null };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selected.join(','))
      .in(filterColumn, uniqueValues);
    if (!error) return { data: (data as any[]) || [], error: null };
    lastError = error;
    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && selected.includes(missing)) {
      selected = selected.filter((field) => field !== missing);
      continue;
    }
    break;
  }

  return { data: [], error: lastError };
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const orderId = String(event.queryStringParameters?.id || event.queryStringParameters?.order || '').trim();
    const providerOrderId = String(
      event.queryStringParameters?.providerOrderId ||
      event.queryStringParameters?.provider_order_id ||
      event.queryStringParameters?.token ||
      ''
    ).trim();

    if (!orderId && !providerOrderId) return json(400, { error: 'Missing order reference' });

    const supabaseAdmin = createSupabaseAdmin();
    const authHeader = extractAuthHeader(event as any);
    let ownerIdSet = new Set<string>();
    let isAdminRequest = false;
    if (authHeader) {
      const { user, error: authError } = await getAuthedUser(authHeader);
      if (!user || authError) return json(401, { error: authError || 'Unauthorized' });
      ownerIdSet = new Set(
        (await resolveOwnedProfileIdsForUser({ supabaseAdmin, user }))
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      );

      try {
        await requireAdmin(event as any);
        isAdminRequest = true;
      } catch {
        isAdminRequest = false;
      }
    }

    const orderFields = [
      'id',
      'order_number',
      'buyer_id',
      'seller_id',
      'partner_id',
      'affiliate_id',
      'influencer_id',
      'user_id',
      'provider_order_id',
      'provider_capture_id',
      'status',
      'payment_status',
      'fulfillment_status',
      'created_at',
      'billing_email',
      'billing_name',
      'shipping_address',
      'total_amount',
      'total_charged',
      'tracking_number',
      'tracking_url',
    ];

    let orderResult =
      orderId && isUuid(orderId)
        ? await selectMaybeSingleWithFallback(supabaseAdmin, 'orders', orderFields, 'id', orderId)
        : { data: null, error: null };

    if (!orderResult.data && providerOrderId) {
      orderResult = await selectMaybeSingleWithFallback(
        supabaseAdmin,
        'orders',
        orderFields,
        'provider_order_id',
        providerOrderId
      );
    }

    if (orderResult.error) {
      return json(500, { error: String((orderResult.error as any)?.message || 'Failed to load order') });
    }

    const orderRow = orderResult.data as any;
    if (!orderRow?.id) return json(404, { error: 'Order not found' });

    if (ownerIdSet.size === 0) {
      const status = String(orderRow.status || '').trim().toLowerCase();
      const paymentStatus = String(orderRow.payment_status || '').trim().toLowerCase();
      const isPaidReceipt =
        paymentStatus === 'paid' ||
        status === 'paid' ||
        status === 'completed' ||
        status === 'processing';
      if (!isPaidReceipt) return json(404, { error: 'Order is still processing' });
    }

    const participantIds = [
      orderRow.buyer_id,
      orderRow.seller_id,
      orderRow.partner_id,
      orderRow.affiliate_id,
      orderRow.influencer_id,
      orderRow.user_id,
    ]
      .map((value: unknown) => String(value || '').trim())
      .filter(Boolean);

    if (ownerIdSet.size > 0 && !isAdminRequest && !participantIds.some((value) => ownerIdSet.has(value))) {
      return json(403, { error: 'Forbidden' });
    }

    const itemsResult = await selectWithFallback(
      supabaseAdmin,
      'order_items',
      [
        'id',
        'product_id',
        'variant_id',
        'quantity',
        'price',
        'sku',
        'title_snapshot',
        'product_title',
        'cj_variant_id',
        'external_variant_id',
        'seller_ask_amount',
        'computed_listing_price',
        'affiliate_commission_percent_at_purchase',
        'platform_percent_at_purchase',
        'partner_rate',
      ],
      'order_id',
      String(orderRow.id)
    );
    if (itemsResult.error) {
      return json(500, { error: String((itemsResult.error as any)?.message || 'Failed to load order items') });
    }

    const rawItems = (itemsResult.data as any[]) || [];
    const productIds = rawItems.map((item) => String(item?.product_id || '').trim()).filter(Boolean);
    const variantIds = rawItems.map((item) => String(item?.variant_id || '').trim()).filter(Boolean);

    const productsResult = await selectInWithFallback(
      supabaseAdmin,
      'products',
      ['id', 'title', 'description', 'images', 'image_url', 'sku', 'seller_id'],
      'id',
      productIds
    );
    if (productsResult.error) {
      return json(500, { error: String((productsResult.error as any)?.message || 'Failed to load product details') });
    }
    const productById = new Map(
      ((productsResult.data as any[]) || []).map((row) => [String(row?.id || '').trim(), row])
    );

    const variantsResult = await selectInWithFallback(
      supabaseAdmin,
      'product_variants',
      ['id', 'product_id', 'attributes', 'sku', 'variant_display_sku', 'cj_variant_id', 'cj_vid'],
      'id',
      variantIds
    );
    if (variantsResult.error) {
      return json(500, { error: String((variantsResult.error as any)?.message || 'Failed to load variant details') });
    }
    const variantById = new Map(
      ((variantsResult.data as any[]) || []).map((row) => [String(row?.id || '').trim(), row])
    );

    let sellerProfile: any = null;
    const sellerProfileId = String(orderRow.seller_id || '').trim();
    if (sellerProfileId) {
      const sellerResult = await selectMaybeSingleWithFallback(
        supabaseAdmin,
        'profiles',
        ['id', 'full_name', 'email'],
        'id',
        sellerProfileId
      );
      sellerProfile = sellerResult.data || null;
    }

    let buyerProfile: any = null;
    const buyerProfileId = String(orderRow.buyer_id || orderRow.user_id || '').trim();
    if (buyerProfileId) {
      const buyerResult = await selectMaybeSingleWithFallback(
        supabaseAdmin,
        'profiles',
        ['id', 'full_name', 'email'],
        'id',
        buyerProfileId
      );
      buyerProfile = buyerResult.data || null;
    }

    const items = rawItems.map((item) => {
      const quantity = Math.max(1, Number(item?.quantity || 1));
      const price = Number(item?.price || item?.computed_listing_price || 0) || 0;
      const sellerAskAmount = Number(item?.seller_ask_amount || 0) || 0;
      const configuredAffiliatePercent = Math.max(0, Number(item?.affiliate_commission_percent_at_purchase || 0) || 0);
      const appliedAffiliateRate = Math.max(0, Number(item?.partner_rate || 0) || 0);
      const lineTotal = price * quantity;
      const sellerAskLineTotal = sellerAskAmount * quantity;
      const productId = String(item?.product_id || '').trim();
      const variantId = String(item?.variant_id || '').trim();
      const productRow = productById.get(productId) || null;
      const variantRow = variantById.get(variantId) || null;

      return {
        id: String(item?.id || ''),
        product_id: productId,
        variant_id: variantId || null,
        quantity,
        price,
        seller_ask_amount: Number(item?.seller_ask_amount || 0) || 0,
        line_total: lineTotal,
        title: String(item?.product_title || item?.title_snapshot || productRow?.title || 'Unknown Product'),
        description: String(productRow?.description || '').trim() || null,
        images: Array.isArray(productRow?.images)
          ? productRow.images
          : productRow?.image_url
            ? [String(productRow.image_url)]
            : [],
        sku:
          String(item?.sku || '').trim() ||
          String(variantRow?.variant_display_sku || variantRow?.sku || '').trim() ||
          String(productRow?.sku || '').trim() ||
          null,
        variant_label:
          variantRow?.attributes && typeof variantRow.attributes === 'object'
            ? Object.entries(variantRow.attributes)
                .map(([key, value]) => `${key}: ${String(value || '').trim()}`)
                .filter(Boolean)
                .join(' | ') || null
            : null,
        variant_sku:
          String(variantRow?.variant_display_sku || variantRow?.sku || '').trim() || null,
        cj_variant_id:
          String(item?.cj_variant_id || variantRow?.cj_vid || variantRow?.cj_variant_id || '').trim() || null,
        external_variant_id:
          String(item?.external_variant_id || '').trim() || null,
        applied_affiliate_commission_basis: 'seller_ask_amount',
        configured_affiliate_commission_percent: configuredAffiliatePercent,
        configured_affiliate_commission_amount: Number(((lineTotal * configuredAffiliatePercent) / 100).toFixed(2)),
        applied_affiliate_rate: appliedAffiliateRate,
        applied_affiliate_commission_amount: Number((sellerAskLineTotal * appliedAffiliateRate).toFixed(2)),
        platform_percent_at_purchase: Math.max(0, Number(item?.platform_percent_at_purchase || 0) || 0),
      };
    });

    const payoutLedgerResult = await selectMaybeSingleWithFallback(
      supabaseAdmin,
      'payout_ledger',
      [
        'order_id',
        'seller_earnings',
        'partner_earnings',
        'influencer_earnings',
        'beezio_fee_gross',
        'beezio_fee_net',
        'beezio_profit',
        'paypal_fee_estimate',
        'hold_release_at',
        'status',
      ],
      'order_id',
      String(orderRow.id)
    );
    if (payoutLedgerResult.error) {
      return json(500, { error: String((payoutLedgerResult.error as any)?.message || 'Failed to load payout ledger') });
    }

    const payoutLedger = payoutLedgerResult.data as any;
    const payoutSnapshotsResult = await selectWithFallback(
      supabaseAdmin,
      'payout_snapshots',
      ['id', 'payee_role', 'payee_user_id', 'amount', 'snapshot_json'],
      'order_id',
      String(orderRow.id)
    );
    if (payoutSnapshotsResult.error) {
      return json(500, { error: String((payoutSnapshotsResult.error as any)?.message || 'Failed to load payout snapshots') });
    }
    const payoutSnapshotRows = (payoutSnapshotsResult.data as any[]) || [];
    const primarySnapshot = payoutSnapshotRows.find((row) => row?.snapshot_json && typeof row.snapshot_json === 'object')?.snapshot_json || null;
    const snapshotBreakdown = primarySnapshot && typeof primarySnapshot === 'object'
      ? (primarySnapshot as any).payee_breakdown || {}
      : {};
    const sellerInfluencerId = String((primarySnapshot as any)?.seller_influencer_id || '').trim() || null;
    const affiliateInfluencerId = String((primarySnapshot as any)?.partner_influencer_id || '').trim() || null;
    const sellerInfluencerEarnings = payoutSnapshotRows
      .filter((row) => String(row?.payee_role || '').trim().toUpperCase() === 'INFLUENCER')
      .filter((row) => sellerInfluencerId && String(row?.payee_user_id || '').trim() === sellerInfluencerId)
      .reduce((sum, row) => sum + (Number(row?.amount || 0) || 0), 0);
    const affiliateInfluencerEarnings = payoutSnapshotRows
      .filter((row) => String(row?.payee_role || '').trim().toUpperCase() === 'INFLUENCER')
      .filter((row) => affiliateInfluencerId && String(row?.payee_user_id || '').trim() === affiliateInfluencerId)
      .reduce((sum, row) => sum + (Number(row?.amount || 0) || 0), 0);
    const influencerBonusPoolTotal = Number((primarySnapshot as any)?.influencer_bonus_pool_total || 0) || 0;
    const influencerBonusPaidTotal = Number((primarySnapshot as any)?.influencer_bonus_paid_total || 0) || 0;
    const influencerBonusRetainedTotal = Number((primarySnapshot as any)?.influencer_bonus_retained_total || 0) || 0;
    const beezioKeptTotal =
      Number(snapshotBreakdown?.beezio_fee_net || 0) ||
      Number((primarySnapshot as any)?.beezio_fee_net_total || 0) ||
      Number(payoutLedger?.beezio_fee_net || payoutLedger?.beezio_profit || 0) ||
      0;
    const beezioOperatingProfit = Math.max(0, Number((beezioKeptTotal - influencerBonusRetainedTotal).toFixed(2)));

    const disputesResult = await selectWithFallback(
      supabaseAdmin,
      'disputes',
      ['id', 'order_id', 'dispute_type', 'status', 'resolution_type', 'refund_amount', 'resolution', 'created_at', 'updated_at', 'resolved_at'],
      'order_id',
      String(orderRow.id)
    );
    if (disputesResult.error) {
      return json(500, { error: String((disputesResult.error as any)?.message || 'Failed to load disputes') });
    }
    const configuredAffiliateCommissionTotal = Number(
      items.reduce((sum, item) => sum + Number(item?.configured_affiliate_commission_amount || 0), 0).toFixed(2)
    );
    const appliedAffiliateCommissionTotal =
      Number(payoutLedger?.partner_earnings || 0) || Number(
        items.reduce((sum, item) => sum + Number(item?.applied_affiliate_commission_amount || 0), 0).toFixed(2)
      );

    return json(200, {
      ok: true,
      order: {
        id: String(orderRow.id),
        order_number: String(orderRow.order_number || '').trim() || null,
        provider_order_id: String(orderRow.provider_order_id || '').trim() || null,
        provider_capture_id: String(orderRow.provider_capture_id || '').trim() || null,
        total_amount: Number(orderRow.total_amount || 0) || 0,
        total_charged: Number(orderRow.total_charged || 0) || null,
        status: String(orderRow.status || '').trim() || 'completed',
        payment_status: String(orderRow.payment_status || '').trim() || null,
        fulfillment_status: String(orderRow.fulfillment_status || '').trim() || null,
        created_at: String(orderRow.created_at || ''),
        billing_email: String(orderRow.billing_email || '').trim() || '',
        billing_name: String(orderRow.billing_name || '').trim() || '',
        shipping_address: orderRow.shipping_address || null,
        tracking_number: String(orderRow.tracking_number || '').trim() || null,
        tracking_url: String(orderRow.tracking_url || '').trim() || null,
        seller: {
          id: sellerProfileId || String(productById.get(String(rawItems[0]?.product_id || '').trim())?.seller_id || '').trim() || null,
          name: String(sellerProfile?.full_name || '').trim() || 'Seller',
          email: String(sellerProfile?.email || '').trim() || null,
        },
        buyer: {
          id: buyerProfileId || null,
          name: String(orderRow.billing_name || buyerProfile?.full_name || '').trim() || '',
          email: String(orderRow.billing_email || buyerProfile?.email || '').trim() || '',
        },
        items,
        fee_summary: {
          seller_earnings: Number(payoutLedger?.seller_earnings || 0) || 0,
          configured_affiliate_commission_total: configuredAffiliateCommissionTotal,
          applied_affiliate_commission_total: appliedAffiliateCommissionTotal,
          influencer_earnings: Number(payoutLedger?.influencer_earnings || 0) || 0,
          seller_influencer_earnings: Number(sellerInfluencerEarnings.toFixed(2)) || 0,
          affiliate_influencer_earnings: Number(affiliateInfluencerEarnings.toFixed(2)) || 0,
          beezio_fee_gross: Number(payoutLedger?.beezio_fee_gross || 0) || 0,
          beezio_fee_net: beezioKeptTotal,
          beezio_operating_profit: beezioOperatingProfit,
          paypal_fee_estimate: Number(payoutLedger?.paypal_fee_estimate || 0) || 0,
          influencer_bonus_pool_total: influencerBonusPoolTotal,
          influencer_bonus_paid_total: influencerBonusPaidTotal,
          influencer_bonus_retained_total: influencerBonusRetainedTotal,
          hold_release_at: String(payoutLedger?.hold_release_at || '').trim() || null,
          payout_status: String(payoutLedger?.status || '').trim() || null,
        },
        disputes: ((disputesResult.data as any[]) || []).map((dispute) => ({
          id: String(dispute?.id || ''),
          dispute_type: String(dispute?.dispute_type || '').trim() || null,
          status: String(dispute?.status || '').trim() || null,
          resolution_type: String(dispute?.resolution_type || '').trim() || null,
          resolution: String(dispute?.resolution || '').trim() || null,
          refund_amount: Number(dispute?.refund_amount || 0) || 0,
          created_at: String(dispute?.created_at || '').trim() || null,
          updated_at: String(dispute?.updated_at || '').trim() || null,
          resolved_at: String(dispute?.resolved_at || '').trim() || null,
        })),
      },
    });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, {
      error: e instanceof Error ? e.message : 'Unexpected error',
    });
  }
};

export default handler;
