import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import {
  cjRequest,
  getCJFreightQuote,
  getCJInventory,
  getCJOrderDetail,
  getCJVariantByVid,
} from './_lib/cj-api';

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function normalizeCountryCode(value: unknown): string {
  const raw = text(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

async function selectVerifiedVariant(supabase: any) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,title,cj_product_id,cj_pid')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .order('created_at', { ascending: true })
    .limit(25);
  if (productError) throw new Error(`Sandbox product lookup failed: ${productError.message}`);

  for (const product of products || []) {
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id,product_id,cj_product_id,cj_variant_id,cj_vid,cj_variant_sku,is_orderable,order_reference_type,supplier_cost_amount,shipping_reserve_amount')
      .eq('product_id', product.id)
      .eq('is_orderable', true)
      .eq('order_reference_type', 'cj_vid')
      .limit(20);
    if (variantError) continue;

    for (const variant of variants || []) {
      const vid = text(variant?.cj_vid);
      if (!vid) continue;
      const { data: mapping, error: mappingError } = await supabase
        .from('cj_variant_mappings')
        .select('product_variant_id,beezio_product_id,cj_product_id,cj_vid,cj_variant_sku,origin_country_code,freight_method,freight_cost_amount,is_active')
        .eq('product_variant_id', variant.id)
        .eq('is_active', true)
        .maybeSingle();
      if (mappingError || !mapping) continue;
      if (text(mapping.cj_vid) !== vid || text(mapping.beezio_product_id) !== text(product.id)) continue;
      return { product, variant, mapping };
    }
  }

  throw new Error('No verified SupplyLine Plus CJ variant is available for sandbox testing yet.');
}

async function chooseFreight(mapping: any, vid: string) {
  const origins = Array.from(new Set([
    normalizeCountryCode(mapping?.origin_country_code),
    'US',
    'CN',
  ].filter(Boolean)));
  let lastError: unknown = null;

  for (const originCountryCode of origins) {
    try {
      const quote = await getCJFreightQuote({
        originCountryCode,
        destinationCountryCode: 'US',
        destinationZip: '10001',
        items: [{ vid, quantity: 1 }],
      });
      const preferred = text(mapping?.freight_method);
      const option = quote.options.find((row) => preferred && row.logisticName.toLowerCase() === preferred.toLowerCase()) || quote.options[0];
      if (option) return { originCountryCode, option };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Sandbox freight quote failed: ${lastError instanceof Error ? lastError.message : 'no valid method'}`);
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: state } = await supabase.from('cj_sandbox_test_state').select('*').eq('id', 1).maybeSingle();
  if (text(state?.status) === 'passed') return { statusCode: 202, body: '' };

  const attemptCount = Math.max(0, Number(state?.attempt_count || 0)) + 1;
  await supabase.from('cj_sandbox_test_state').upsert({
    id: 1,
    status: 'running',
    attempt_count: attemptCount,
    started_at: state?.started_at || now,
    last_run_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: 'id' });

  const result: Record<string, any> = { attempt_count: attemptCount, started_at: now };

  try {
    const selected = await selectVerifiedVariant(supabase);
    const product = selected.product;
    const variant = selected.variant;
    const mapping = selected.mapping;
    const vid = text(mapping.cj_vid || variant.cj_vid);
    const cjProductId = text(mapping.cj_product_id || variant.cj_product_id || product.cj_product_id || product.cj_pid);

    const liveVariant = await getCJVariantByVid(vid);
    if (text(liveVariant?.vid) !== vid) throw new Error(`CJ sandbox exact-VID check failed for ${vid}.`);
    const liveCost = Number(liveVariant?.variantSellPrice || 0);
    if (!(liveCost > 0)) throw new Error(`CJ sandbox live supplier cost is invalid for VID ${vid}.`);

    let liveInventory: number | null = null;
    if (cjProductId) {
      try { liveInventory = await getCJInventory(cjProductId, vid); } catch { liveInventory = null; }
    }
    if (liveInventory !== null && liveInventory <= 0) throw new Error(`CJ sandbox test VID ${vid} is currently out of stock.`);

    const freight = await chooseFreight(mapping, vid);
    const orderNumber = `BZO-SBX-${Date.now()}`;
    const payload = {
      orderNumber,
      shippingZip: '10001',
      shippingCountry: 'United States',
      shippingCountryCode: 'US',
      shippingProvince: 'New York',
      shippingCity: 'New York',
      shippingCustomerName: 'Beezio Sandbox',
      shippingAddress: '123 Test Street',
      email: 'sandbox@beezio.co',
      remark: 'Beezio SupplyLine Plus CJ sandbox verification',
      payType: 3,
      isSandbox: 1,
      logisticName: freight.option.logisticName,
      fromCountryCode: freight.originCountryCode,
      platform: 'Api',
      orderFlow: 1,
      products: [{ vid, quantity: 1, storeLineItemId: `sandbox-${variant.id}` }],
    };

    const createdRaw: any = await cjRequest('shopping/order/createOrderV2', payload, 'POST');
    const created = createdRaw?.data ?? createdRaw;
    const orderId = text(created?.orderId || created?.cjOrderId || created?.id);
    const shipmentOrderId = text(created?.shipmentOrderId || created?.shipmentOrderNumber || created?.shipmentId);
    if (!orderId && !shipmentOrderId) throw new Error('CJ sandbox create-order response contained no order identifier.');

    result.product_id = product.id;
    result.product_title = product.title;
    result.product_variant_id = variant.id;
    result.cj_product_id = cjProductId;
    result.cj_vid = vid;
    result.live_variant_sku = text(liveVariant?.variantSku);
    result.live_supplier_cost = money(liveCost);
    result.live_inventory = liveInventory;
    result.freight_method = freight.option.logisticName;
    result.freight_cost = money(freight.option.totalPostageFee);
    result.order_number = orderNumber;
    result.cj_order_id = orderId || null;
    result.shipment_order_id = shipmentOrderId || null;
    result.create_response = created;

    const payPayload = shipmentOrderId ? { shipmentOrderId } : { orderId };
    const payRaw: any = await cjRequest('shopping/sandbox/simulatePay', payPayload, 'POST');
    if (payRaw?.result === false) throw new Error(payRaw?.message || 'CJ sandbox simulated payment failed.');
    result.simulate_pay = true;

    const statusOrderId = orderId || shipmentOrderId;
    const processingRaw: any = await cjRequest('shopping/sandbox/updateStatus', { orderId: statusOrderId, targetStatus: 400 }, 'POST');
    if (processingRaw?.result === false) throw new Error(processingRaw?.message || 'CJ sandbox processing-status update failed.');
    result.processing_status = 400;

    const trackingNumber = `BZO-SBX-${Date.now().toString(36).toUpperCase()}`.slice(0, 64);
    const trackingRaw: any = await cjRequest('shopping/sandbox/updateTrackNumber', { orderId: statusOrderId, trackNumber: trackingNumber }, 'POST');
    if (trackingRaw?.result === false) throw new Error(trackingRaw?.message || 'CJ sandbox tracking-number update failed.');
    result.tracking_number = trackingNumber;

    const shippedRaw: any = await cjRequest('shopping/sandbox/updateStatus', { orderId: statusOrderId, targetStatus: 500 }, 'POST');
    if (shippedRaw?.result === false) throw new Error(shippedRaw?.message || 'CJ sandbox shipped-status update failed.');
    result.shipped_status = 500;

    const detail = orderId ? await getCJOrderDetail(orderId) : null;
    if (detail) {
      const sandboxFlag = Number(detail?.isSandbox ?? detail?.sandbox ?? 0);
      if (sandboxFlag !== 1) throw new Error('CJ returned the sandbox test order as a real order.');
      const returnedVid = text(
        detail?.products?.[0]?.vid ||
        detail?.productList?.[0]?.vid ||
        detail?.orderItemList?.[0]?.vid
      );
      if (returnedVid && returnedVid !== vid) throw new Error(`CJ sandbox order VID mismatch: expected ${vid}, got ${returnedVid}.`);
      const returnedTracking = text(detail?.trackNumber || detail?.trackingNumber);
      if (returnedTracking && returnedTracking !== trackingNumber) throw new Error('CJ sandbox tracking number did not round-trip correctly.');
      result.order_detail = detail;
    }

    const passedAt = new Date().toISOString();
    await supabase.from('cj_sandbox_test_state').upsert({
      id: 1,
      status: 'passed',
      attempt_count: attemptCount,
      product_id: product.id,
      product_variant_id: variant.id,
      cj_product_id: cjProductId || null,
      cj_vid: vid,
      cj_order_id: orderId || shipmentOrderId || null,
      cj_order_number: orderNumber,
      simulated_tracking_number: trackingNumber,
      last_error: null,
      last_result: { ...result, passed_at: passedAt },
      passed_at: passedAt,
      last_run_at: now,
      updated_at: passedAt,
    }, { onConflict: 'id' });

    await supabase.from('cj_fulfillment_settings').upsert({
      id: 1,
      sandbox_verified: true,
      updated_at: passedAt,
    }, { onConflict: 'id' });

    return { statusCode: 202, body: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedAt = new Date().toISOString();
    await supabase.from('cj_sandbox_test_state').upsert({
      id: 1,
      status: 'retrying',
      attempt_count: attemptCount,
      last_error: message,
      last_result: { ...result, error: message, failed_at: failedAt },
      last_run_at: now,
      updated_at: failedAt,
    }, { onConflict: 'id' });
    return { statusCode: 202, body: '' };
  }
};

export default handler;
