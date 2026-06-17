import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { resolveAuthUserIdFromProfileId } from './_lib/auth';
import { decryptSecret } from './_lib/crypto';
import { createPrintifyOrder } from './_lib/printify';
import { createPrintfulOrder } from './_lib/printful';

type DispatchBody = {
  orderId?: string;
};

function toAddressName(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return { first: 'Customer', last: 'Order' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || 'Customer',
    last: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Order',
  };
}

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<DispatchBody>(event.body);
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return json(400, { error: 'Missing orderId' });

    const supabaseAdmin = createSupabaseAdmin();

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) return json(500, { error: orderError.message });
    if (!order) return json(404, { error: 'Order not found' });

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*, product:products(*), variant:product_variants(*)')
      .eq('order_id', orderId);
    if (itemsError) return json(500, { error: itemsError.message });

    const lineItems = (items as any[]) || [];
    if (!lineItems.length) return json(200, { ok: true, message: 'No order items to fulfill' });

    const manualFulfillmentOnly = String(process.env.MANUAL_FULFILLMENT_ONLY || 'true').trim().toLowerCase() !== 'false';

    const { data: existingVendorOrders, error: existingVendorOrdersError } = await supabaseAdmin
      .from('vendor_orders')
      .select('id, vendor_id, vendor_order_id, status')
      .eq('order_id', orderId);
    if (existingVendorOrdersError) return json(500, { error: existingVendorOrdersError.message });

    const existingVendorOrderByVendor = new Map<string, any>();
    for (const row of (existingVendorOrders as any[]) || []) {
      const vendorId = String(row?.vendor_id || '').trim().toLowerCase();
      if (vendorId && !existingVendorOrderByVendor.has(vendorId)) {
        existingVendorOrderByVendor.set(vendorId, row);
      }
    }

    if (manualFulfillmentOnly) {
      await supabaseAdmin.from('vendor_orders').upsert({
        order_id: orderId,
        vendor_id: 'manual_seller',
        vendor_order_id: null,
        items: lineItems.map((item) => ({
          order_item_id: item?.id || null,
          product_id: item?.product_id || null,
          title: item?.product?.title || null,
          quantity: Number(item?.quantity || 1),
          source_platform: item?.variant?.source_platform || item?.source_platform || null,
        })),
        shipping_address: (order as any)?.shipping_address || null,
        status: 'pending',
        vendor_response: { mode: 'manual_fulfillment_only', queued_at: new Date().toISOString() },
      }, { onConflict: 'order_id,vendor_id' });

      await supabaseAdmin
        .from('orders')
        .update({ fulfillment_status: 'manual_review', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      return json(200, {
        ok: true,
        manual_only: true,
        existing_vendor_orders: (existingVendorOrders as any[]) || [],
        message: 'Order queued for manual fulfillment',
      });
    }

    const shipping = (order as any)?.shipping_address || {};
    const billingName = String((order as any)?.billing_name || (order as any)?.customer_name || '').trim();
    const billingEmail = String((order as any)?.billing_email || (order as any)?.customer_email || '').trim();
    const name = toAddressName(billingName || shipping?.name || '');

    const baseRecipient = {
      name: billingName || shipping?.name || `${name.first} ${name.last}`,
      email: billingEmail,
    };

    const printifyItems = lineItems.filter((it) => String(it?.variant?.source_platform || it?.source_platform || '').toLowerCase() === 'printify');
    const printfulItems = lineItems.filter((it) => String(it?.variant?.source_platform || it?.source_platform || '').toLowerCase() === 'printful');
    const cjItems = lineItems.filter((it) => {
      const source = String(it?.variant?.source_platform || it?.source_platform || '').toLowerCase();
      return source === 'cj' || Boolean(it?.cj_product_id || it?.cj_variant_id);
    });

    let printifyResult: any = null;
    let printfulResult: any = null;

    if (printifyItems.length && !existingVendorOrderByVendor.has('printify')) {
      const sellerId = String((order as any)?.seller_id || '').trim();
      const integrationUserId = await resolveAuthUserIdFromProfileId(sellerId);
      const { data: integration } = await supabaseAdmin
        .from('user_integrations')
        .select('*')
        .eq('user_id', integrationUserId || sellerId)
        .eq('platform', 'printify')
        .maybeSingle();

      if (integration) {
        const token = decryptSecret((integration as any)?.api_key);
        const shopId = Number((integration as any)?.settings?.shop_id);
        const addressTo = {
          first_name: name.first,
          last_name: name.last,
          email: billingEmail || '',
          phone: shipping?.phone || '',
          country: shipping?.country || 'US',
          region: shipping?.state || '',
          address1: shipping?.address || shipping?.address1 || shipping?.street || '',
          address2: shipping?.address2 || '',
          city: shipping?.city || '',
          zip: shipping?.zip || shipping?.postal_code || '',
        };

        const linePayload = printifyItems.map((item) => {
          const variant = (item as any)?.variant || {};
          const product = (item as any)?.product || {};
          return {
            product_id: String(variant?.external_product_id || product?.external_id || ''),
            variant_id: Number(variant?.external_variant_id || 0),
            quantity: Number(item?.quantity || 1),
            print_provider_id: (variant as any)?.external_data?.print_provider_id || null,
          };
        }).filter((li) => li.product_id && li.variant_id);

        if (linePayload.length && token && Number.isFinite(shopId)) {
          printifyResult = await createPrintifyOrder({
            token,
            shopId,
            externalId: `BZO-${orderId}`,
            addressTo,
            lineItems: linePayload,
          });

          await supabaseAdmin.from('vendor_orders').upsert({
            order_id: orderId,
            vendor_id: 'printify',
            vendor_order_id: String(printifyResult?.id || printifyResult?.order_id || ''),
            items: linePayload,
            shipping_address: addressTo,
            status: 'processing',
            vendor_response: printifyResult,
          }, { onConflict: 'order_id,vendor_id' });
        }
      }
    }

    if (printfulItems.length && !existingVendorOrderByVendor.has('printful')) {
      const sellerId = String((order as any)?.seller_id || '').trim();
      const integrationUserId = await resolveAuthUserIdFromProfileId(sellerId);
      const { data: integration } = await supabaseAdmin
        .from('user_integrations')
        .select('*')
        .eq('user_id', integrationUserId || sellerId)
        .eq('platform', 'printful')
        .maybeSingle();

      if (integration) {
        const token = decryptSecret((integration as any)?.api_key);
        const storeId = Number((integration as any)?.settings?.store_id);
        const recipient = {
          ...baseRecipient,
          address1: shipping?.address || shipping?.address1 || shipping?.street || '',
          address2: shipping?.address2 || '',
          city: shipping?.city || '',
          state_code: shipping?.state || '',
          country_code: shipping?.country || 'US',
          zip: shipping?.zip || shipping?.postal_code || '',
          phone: shipping?.phone || '',
        };

        const linePayload = printfulItems.map((item) => {
          const variant = (item as any)?.variant || {};
          return {
            sync_variant_id: Number(variant?.external_variant_id || 0),
            quantity: Number(item?.quantity || 1),
          };
        }).filter((li) => li.sync_variant_id);

        if (linePayload.length && token) {
          printfulResult = await createPrintfulOrder({
            token,
            storeId: Number.isFinite(storeId) ? storeId : undefined,
            externalId: `BZO-${orderId}`,
            recipient,
            items: linePayload,
          });

          await supabaseAdmin.from('vendor_orders').upsert({
            order_id: orderId,
            vendor_id: 'printful',
            vendor_order_id: String(printfulResult?.result?.id || printfulResult?.id || ''),
            items: linePayload,
            shipping_address: recipient,
            status: 'processing',
            vendor_response: printfulResult,
          }, { onConflict: 'order_id,vendor_id' });
        }
      }
    }

    const hasExistingAutomatedVendorOrders =
      existingVendorOrderByVendor.has('printify') || existingVendorOrderByVendor.has('printful');

    if (printifyResult || printfulResult || hasExistingAutomatedVendorOrders) {
      await supabaseAdmin
        .from('orders')
        .update({ fulfillment_status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    if (cjItems.length) {
      await supabaseAdmin
        .from('orders')
        .update({
          fulfillment_status: printifyResult || printfulResult || hasExistingAutomatedVendorOrders ? 'processing' : 'manual_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }

    return json(200, {
      ok: true,
      printify: printifyResult,
      printful: printfulResult,
      existing_vendor_orders: (existingVendorOrders as any[]) || [],
      cj_manual_required: cjItems.length,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
