import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, requireSellerOrAdmin } from './_lib/auth';
import { resolveOwnedProfileIdsForUser } from './_lib/owned-profiles';

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const asText = (value: unknown) => String(value || '').trim();
const asMoney = (value: unknown) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? round2(num) : 0;
};
const uniqueTexts = (values: Array<unknown>) => Array.from(new Set(values.map((value) => asText(value)).filter(Boolean)));
const needsSellerFulfillment = (row: { status?: string | null; payment_status?: string | null; fulfillment_status?: string | null }) => {
  const status = asText(row?.status).toLowerCase();
  const paymentStatus = asText(row?.payment_status).toLowerCase();
  const fulfillmentStatus = asText(row?.fulfillment_status).toLowerCase();

  if (fulfillmentStatus === 'pending' || fulfillmentStatus === 'manual_review' || fulfillmentStatus === 'unfulfilled') {
    return true;
  }

  return paymentStatus === 'paid' && status === 'completed';
};

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

const selectWithFallback = async (
  queryFactory: (selected: string[]) => PromiseLike<any>,
  fields: string[],
  maxAttempts = 8
) => {
  let selected = [...fields];
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await queryFactory(selected);
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

export const handler: Handler = async (event) => {
  try {
    await requireSellerOrAdmin(event);

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { ok: false, error: 'Unauthorized' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { ok: false, error: authError || 'Unauthorized' });

    const supabaseAdmin = createSupabaseAdmin();
    const ownerIds = await resolveOwnedProfileIdsForUser({ supabaseAdmin, user });
    if (!ownerIds.length) {
      return json(200, {
        ok: true,
        ownerIds: [],
        orders: [],
        summary: {
          total_sales: 0,
          total_revenue: 0,
          total_tax_collected: 0,
          pending_orders: 0,
          avg_order_value: 0,
        },
      });
    }

    const orderRowsById = new Map<string, any>();
    const orderFields = [
      'id',
      'order_number',
      'seller_id',
      'status',
      'payment_status',
      'fulfillment_status',
      'created_at',
      'provider_capture_id',
      'billing_email',
      'customer_email',
      'shipping_address',
      'total_amount',
      'total_charged',
      'tax_amount',
      'storefront_id',
      'store_id',
    ];

    const sellerOrdersResult = await selectWithFallback(
      (selected) =>
        supabaseAdmin
          .from('orders')
          .select(selected.join(','))
          .in('seller_id', ownerIds)
          .order('created_at', { ascending: false })
          .limit(500),
      orderFields
    );
    if (sellerOrdersResult.error) {
      return json(500, { ok: false, error: String((sellerOrdersResult.error as any)?.message || 'Failed to load seller orders') });
    }

    for (const row of sellerOrdersResult.data || []) {
      const id = asText((row as any)?.id);
      if (id) orderRowsById.set(id, row);
    }

    const ownedProducts = await supabaseAdmin
      .from('products')
      .select('id')
      .in('seller_id', ownerIds)
      .limit(2000);

    if (ownedProducts.error) {
      return json(500, { ok: false, error: ownedProducts.error.message });
    }

    const ownedProductIds = uniqueTexts(((ownedProducts.data as any[]) || []).map((row) => (row as any)?.id));
    const itemsByOrderId = new Map<string, any[]>();

    const ingestOrderItems = (rows: any[] | null | undefined) => {
      for (const item of rows || []) {
        const orderId = asText((item as any)?.order_id);
        if (!orderId) continue;
        const current = itemsByOrderId.get(orderId) || [];
        current.push(item);
        itemsByOrderId.set(orderId, current);
      }
    };

    const orderItemFields = [
      'id',
      'order_id',
      'product_id',
      'seller_id',
      'quantity',
      'price',
      'computed_listing_price',
      'product_title',
      'title_snapshot',
      'products(title,name)',
    ];

    if (ownedProductIds.length) {
      const productOrderItemsResult = await selectWithFallback(
        (selected) =>
          supabaseAdmin
            .from('order_items')
            .select(selected.join(','))
            .in('product_id', ownedProductIds)
            .limit(2000),
        orderItemFields
      );
      if (productOrderItemsResult.error) {
        return json(500, { ok: false, error: String((productOrderItemsResult.error as any)?.message || 'Failed to load product-linked seller order items') });
      }
      ingestOrderItems(productOrderItemsResult.data);
    }

    const sellerSnapshots = await supabaseAdmin
      .from('payout_snapshots')
      .select('order_id')
      .eq('payee_role', 'SELLER')
      .in('payee_user_id', ownerIds)
      .limit(1000);

    if (sellerSnapshots.error) {
      return json(500, { ok: false, error: sellerSnapshots.error.message });
    }

    const snapshotOrderIds = uniqueTexts(((sellerSnapshots.data as any[]) || []).map((row) => (row as any)?.order_id));
    const candidateOrderIds = uniqueTexts([...orderRowsById.keys(), ...itemsByOrderId.keys(), ...snapshotOrderIds]);

    const missingOrderIds = candidateOrderIds.filter((orderId) => !orderRowsById.has(orderId));
    if (missingOrderIds.length) {
      const missingOrdersResult = await selectWithFallback(
        (selected) =>
          supabaseAdmin
            .from('orders')
            .select(selected.join(','))
            .in('id', missingOrderIds)
            .order('created_at', { ascending: false })
            .limit(500),
        orderFields
      );
      if (missingOrdersResult.error) {
        return json(500, { ok: false, error: String((missingOrdersResult.error as any)?.message || 'Failed to load seller orders by derived ids') });
      }

      for (const row of missingOrdersResult.data || []) {
        const id = asText((row as any)?.id);
        if (id) orderRowsById.set(id, row);
      }
    }

    const allOrderIds = uniqueTexts([...orderRowsById.keys(), ...itemsByOrderId.keys(), ...snapshotOrderIds]);
    if (allOrderIds.length) {
      const orderItemsResult = await selectWithFallback(
        (selected) =>
          supabaseAdmin
            .from('order_items')
            .select(selected.join(','))
            .in('order_id', allOrderIds)
            .limit(2000),
        orderItemFields
      );
      if (orderItemsResult.error) {
        return json(500, { ok: false, error: String((orderItemsResult.error as any)?.message || 'Failed to load seller order items') });
      }

      ingestOrderItems(orderItemsResult.data);
    }

    const orderIds = uniqueTexts([...orderRowsById.keys(), ...itemsByOrderId.keys(), ...snapshotOrderIds]);

    const ledgerRows = orderIds.length
      ? await supabaseAdmin
          .from('payout_ledger')
          .select('id, order_id, seller_earnings, gross_amount, status, hold_release_at')
          .in('order_id', orderIds)
      : { data: [], error: null as any };

    if (ledgerRows.error) {
      return json(500, { ok: false, error: ledgerRows.error.message });
    }

    const ledgerByOrderId = new Map<string, any>();
    for (const row of (ledgerRows.data as any[]) || []) {
      const orderId = asText((row as any)?.order_id);
      if (orderId) ledgerByOrderId.set(orderId, row);
    }

    const orders = orderIds
      .map((orderId) => {
        const order = orderRowsById.get(orderId) || {};
        const orderItems = itemsByOrderId.get(orderId) || [];
        const ledger = ledgerByOrderId.get(orderId) || null;
        const totalAmount = asMoney((order as any)?.total_charged ?? (order as any)?.total_amount ?? (ledger as any)?.gross_amount);

        return {
          id: orderId,
          order_number: asText((order as any)?.order_number) || null,
          customer_name:
            asText((order as any)?.shipping_address?.name) ||
            asText((order as any)?.billing_email || (order as any)?.customer_email) ||
            'Customer',
          customer_email: asText((order as any)?.billing_email || (order as any)?.customer_email) || 'customer@example.com',
          product_title:
            asText((orderItems[0] as any)?.product_title) ||
            asText((orderItems[0] as any)?.title_snapshot) ||
            asText((orderItems[0] as any)?.products?.title) ||
            asText((orderItems[0] as any)?.products?.name) ||
            'Product',
          amount: totalAmount,
          status: asText((order as any)?.status) || 'pending',
          payment_status: asText((order as any)?.payment_status) || null,
          fulfillment_status: asText((order as any)?.fulfillment_status) || null,
          created_at: (order as any)?.created_at || null,
          payment_reference_id: asText((order as any)?.provider_capture_id) || null,
          shipping_address: (order as any)?.shipping_address || null,
          gross_amount: asMoney((ledger as any)?.gross_amount ?? totalAmount),
          seller_earnings: ledger ? asMoney((ledger as any)?.seller_earnings) : null,
          payout_status: ledger ? asText((ledger as any)?.status) || null : null,
          hold_release_at: ledger ? ((ledger as any)?.hold_release_at || null) : null,
          order_items: orderItems,
        };
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    const totalRevenue = round2(orders.reduce((sum, row) => sum + asMoney(row.amount), 0));
    const totalTaxCollected = round2(
      orders.reduce((sum, row) => {
        const order = orderRowsById.get(row.id) || {};
        return sum + asMoney((order as any)?.tax_amount);
      }, 0)
    );
    const completedCount = orders.filter((row) => ['completed', 'shipped', 'delivered'].includes(asText(row.status).toLowerCase())).length;
    const pendingCount = orders.filter((row) => needsSellerFulfillment(row)).length;

    return json(200, {
      ok: true,
      ownerIds,
      orders,
      summary: {
        total_sales: orders.length,
        total_revenue: totalRevenue,
        total_tax_collected: totalTaxCollected,
        pending_orders: pendingCount,
        avg_order_value: completedCount > 0 ? round2(totalRevenue / completedCount) : 0,
      },
    });
  } catch (e) {
    return json(500, {
      ok: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    });
  }
};
