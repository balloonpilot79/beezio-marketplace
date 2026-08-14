import { buildCJCreateOrderV2Payload, parseCJUsd } from '../../../shared/cjContract';
import {
  createCJUnpaidOrder,
  findCJOrderByOrderNumber,
  getCJFreightQuote,
} from './cj-api';
import { createSupabaseAdmin } from './supabase';

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const text = (value: unknown): string => String(value ?? '').trim();

const normalizeCountryCode = (value: unknown): string => {
  const raw = text(value);
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    unitedstates: 'US', usa: 'US', unitedstatesofamerica: 'US',
    canada: 'CA', mexico: 'MX', unitedkingdom: 'GB', greatbritain: 'GB',
    australia: 'AU', newzealand: 'NZ', germany: 'DE', france: 'FR',
    spain: 'ES', italy: 'IT', ireland: 'IE', netherlands: 'NL', belgium: 'BE',
  };
  return aliases[key] || '';
};

const countryName = (code: string, original: unknown): string => {
  const supplied = text(original);
  if (supplied && !/^[a-z]{2}$/i.test(supplied)) return supplied;
  const names: Record<string, string> = {
    US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom',
    AU: 'Australia', NZ: 'New Zealand', DE: 'Germany', FR: 'France',
    ES: 'Spain', IT: 'Italy', IE: 'Ireland', NL: 'Netherlands', BE: 'Belgium',
  };
  return names[code] || supplied || code;
};

const nextRetryAt = (attemptCount: number): string => {
  const minutes = Math.min(60, Math.max(2, 2 ** Math.min(Math.max(attemptCount, 1), 5)));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};

export type CJFulfillmentResult = {
  ok: true;
  skipped?: boolean;
  alreadyExisted?: boolean;
  beezioOrderId: string;
  cjOrderNumber?: string;
  cjOrderId?: string | null;
  cjPayUrl?: string | null;
  status: string;
};

export async function createUnpaidCJOrderForBeezioOrder(params: {
  orderId: string;
  supabaseAdmin?: any;
}): Promise<CJFulfillmentResult> {
  const orderId = text(params.orderId);
  if (!orderId) throw new Error('Beezio order id is required.');
  const supabaseAdmin = params.supabaseAdmin || createSupabaseAdmin();

  const [{ data: order, error: orderError }, { data: orderItems, error: itemError }, { data: queued }] = await Promise.all([
    supabaseAdmin.from('orders').select('*').eq('id', orderId).maybeSingle(),
    supabaseAdmin
      .from('order_items')
      .select('id,product_id,variant_id,quantity,source_platform,cj_product_id,cj_variant_id,supplier_cost_amount,shipping_reserve_amount')
      .eq('order_id', orderId),
    supabaseAdmin.from('cj_orders').select('*').eq('beezio_order_id', orderId).maybeSingle(),
  ]);

  if (orderError || !order) throw new Error(orderError?.message || 'Beezio order not found.');
  if (itemError) throw new Error(itemError.message);
  const paid = text((order as any)?.payment_status).toLowerCase() === 'paid' ||
    text((order as any)?.status).toLowerCase() === 'completed';
  if (!paid) throw new Error('CJ order creation is blocked until Beezio payment is captured.');

  if (text((queued as any)?.cj_order_id)) {
    return {
      ok: true,
      alreadyExisted: true,
      beezioOrderId: orderId,
      cjOrderNumber: text((queued as any)?.cj_order_number),
      cjOrderId: text((queued as any)?.cj_order_id),
      cjPayUrl: text((queued as any)?.cj_pay_url) || null,
      status: text((queued as any)?.cj_status) || 'unpaid',
    };
  }

  const items = Array.isArray(orderItems) ? orderItems : [];
  const variantIds = Array.from(new Set(items.map((item: any) => text(item?.variant_id)).filter(Boolean)));
  if (!variantIds.length) {
    return { ok: true, skipped: true, beezioOrderId: orderId, status: 'not_supplyline' };
  }

  const { data: mappingRows, error: mappingError } = await supabaseAdmin
    .from('cj_variant_mappings')
    .select('product_variant_id,beezio_product_id,cj_product_id,cj_vid,supplier_cost_amount,origin_country_code,freight_method,freight_cost_amount,is_active')
    .in('product_variant_id', variantIds);
  if (mappingError) throw new Error(mappingError.message);
  const mappingByVariantId = new Map<string, any>();
  for (const mapping of (mappingRows as any[]) || []) {
    const variantId = text(mapping?.product_variant_id);
    if (variantId) mappingByVariantId.set(variantId, mapping);
  }

  const mappedItems = items
    .map((item: any) => ({ item, mapping: mappingByVariantId.get(text(item?.variant_id)) }))
    .filter(({ mapping }) => Boolean(mapping));
  if (!mappedItems.length) {
    if (queued) throw new Error('SupplyLine Plus order has no private exact-VID mappings.');
    return { ok: true, skipped: true, beezioOrderId: orderId, status: 'not_supplyline' };
  }

  for (const { item, mapping } of mappedItems) {
    if (mapping?.is_active === false) throw new Error(`SupplyLine variant mapping is inactive for order item ${item.id}.`);
    if (!text(mapping?.cj_vid) || !text(mapping?.cj_product_id)) {
      throw new Error(`SupplyLine variant mapping is incomplete for order item ${item.id}.`);
    }
    if (text(mapping?.beezio_product_id) !== text(item?.product_id)) {
      throw new Error(`SupplyLine product/variant mapping mismatch for order item ${item.id}.`);
    }
  }

  const origins = Array.from(new Set(mappedItems
    .map(({ mapping }) => text(mapping?.origin_country_code).toUpperCase())
    .filter(Boolean)));
  if (origins.length !== 1) throw new Error('One CJ order cannot contain variants from different origin countries.');

  const shipping = (order as any)?.shipping_address || (order as any)?.shipping_info || {};
  const destinationCountryCode = normalizeCountryCode(shipping?.country || shipping?.country_code);
  if (!destinationCountryCode) throw new Error('SupplyLine order has no supported shipping country code.');

  const freight = await getCJFreightQuote({
    originCountryCode: origins[0],
    destinationCountryCode,
    destinationZip: shipping?.zip || shipping?.postal_code || shipping?.zipCode || null,
    items: mappedItems.map(({ item, mapping }) => ({
      vid: mapping.cj_vid,
      quantity: Math.max(1, Math.floor(Number(item?.quantity || 1))),
    })),
  });
  const preferredMethod = text((queued as any)?.cj_logistic_name);
  const selectedFreight = freight.options.find(
    (option) => preferredMethod && option.logisticName.toLowerCase() === preferredMethod.toLowerCase()
  ) || freight.options[0];

  const customerName = text(
    shipping?.name ||
    [shipping?.firstName, shipping?.lastName].map(text).filter(Boolean).join(' ') ||
    (order as any)?.billing_name
  ) || 'Customer Order';
  const orderNumber = text((queued as any)?.cj_order_number || (order as any)?.order_number) || `BZO-${orderId}`;
  const createPayload = buildCJCreateOrderV2Payload({
    orderNumber,
    logisticName: selectedFreight.logisticName,
    fromCountryCode: origins[0],
    address: {
      countryCode: destinationCountryCode,
      country: countryName(destinationCountryCode, shipping?.country),
      province: shipping?.state || shipping?.province || shipping?.region || shipping?.city,
      city: shipping?.city,
      county: shipping?.county,
      postalCode: shipping?.zip || shipping?.postal_code || shipping?.zipCode,
      customerName,
      address1: shipping?.address || shipping?.address1 || shipping?.street,
      address2: shipping?.address2,
      phone: shipping?.phone,
      email: (order as any)?.billing_email || shipping?.email,
    },
    items: mappedItems.map(({ item, mapping }) => ({
      vid: mapping.cj_vid,
      quantity: Math.max(1, Math.floor(Number(item?.quantity || 1))),
      storeLineItemId: item.id,
    })),
  });

  const attemptCount = Math.max(0, Number((queued as any)?.attempt_count || 0)) + 1;
  const attemptAt = new Date().toISOString();
  try {
    let response = attemptCount > 1 ? await findCJOrderByOrderNumber(orderNumber) : null;
    const alreadyExisted = Boolean(response);
    if (!response) response = await createCJUnpaidOrder(createPayload);

    const cjOrderId = text(response?.orderId || response?.cjOrderId || response?.id) || null;
    if (!cjOrderId) throw new Error('CJ created no order id.');
    const cjPayUrl = text(response?.cjPayUrl || response?.payUrl) || null;
    const productCost = parseCJUsd(response?.productAmount) || round2(mappedItems.reduce(
      (total, { item, mapping }) => total + Number(mapping?.supplier_cost_amount || item?.supplier_cost_amount || 0) * Math.max(1, Number(item?.quantity || 1)),
      0
    ));
    const shippingCost = parseCJUsd(response?.postageAmount) || selectedFreight.totalPostageFee;
    const totalCost = parseCJUsd(response?.orderAmount) || round2(productCost + shippingCost);

    const storedReserve = round2(mappedItems.reduce(
      (total, { item }) => total + Number(item?.shipping_reserve_amount || 0) * Math.max(1, Number(item?.quantity || 1)),
      0
    ));
    const orderData = {
      create_order_v2: createPayload,
      freight: {
        logistic_name: selectedFreight.logisticName,
        total_postage_fee: selectedFreight.totalPostageFee,
        reserved_shipping_total: storedReserve,
        reserve_shortfall: round2(Math.max(0, selectedFreight.totalPostageFee - storedReserve)),
        quoted_at: attemptAt,
      },
    };

    const { error: saveError } = await supabaseAdmin.from('cj_orders').upsert({
      beezio_order_id: orderId,
      cj_order_number: orderNumber,
      cj_order_id: cjOrderId,
      cj_status: 'unpaid',
      cj_pay_url: cjPayUrl,
      cj_logistic_name: selectedFreight.logisticName,
      cj_origin_country_code: origins[0],
      cj_product_cost: productCost,
      cj_shipping_cost: shippingCost,
      cj_cost: totalCost,
      actual_payment: parseCJUsd(response?.actualPayment) || null,
      order_data: orderData,
      response_data: response || {},
      error_message: null,
      attempt_count: attemptCount,
      last_attempt_at: attemptAt,
      next_attempt_at: null,
      last_synced_at: attemptAt,
      updated_at: attemptAt,
    }, { onConflict: 'beezio_order_id' });
    if (saveError) throw new Error(saveError.message);

    await supabaseAdmin
      .from('orders')
      .update({ fulfillment_status: 'processing', updated_at: attemptAt })
      .eq('id', orderId);

    return {
      ok: true,
      alreadyExisted,
      beezioOrderId: orderId,
      cjOrderNumber: orderNumber,
      cjOrderId,
      cjPayUrl,
      status: 'unpaid',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from('cj_orders').upsert({
      beezio_order_id: orderId,
      cj_order_number: orderNumber,
      cj_status: 'create_failed',
      cj_logistic_name: selectedFreight.logisticName,
      cj_origin_country_code: origins[0],
      order_data: { create_order_v2: createPayload },
      error_message: message,
      attempt_count: attemptCount,
      last_attempt_at: attemptAt,
      next_attempt_at: nextRetryAt(attemptCount),
      updated_at: attemptAt,
    }, { onConflict: 'beezio_order_id' });
    throw error;
  }
}
