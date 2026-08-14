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

const statusName = (value: unknown): string => text(value).toUpperCase();
const statusNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function isUnpaid(value: unknown): boolean {
  const name = statusName(value);
  const number = statusNumber(value);
  return name === 'UNPAID' || number === 200;
}

function isUnshipped(value: unknown): boolean {
  const name = statusName(value);
  const number = statusNumber(value);
  return name === 'UNSHIPPED' || (number !== null && number >= 300 && number < 500);
}

function normalizeCountryCode(value: unknown): string {
  const raw = text(value).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
}

function listRows(payload: any): any[] {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  for (const value of [data?.list, data?.content, data?.records, data?.rows]) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function rowContainsVid(row: any, vid: string): boolean {
  const products = [row?.productList, row?.products, row?.orderItemList, row?.productInfoList]
    .find((value) => Array.isArray(value)) || [];
  return products.some((item: any) =>
    text(item?.vid || item?.variantId || item?.variant_id) === vid
  );
}

async function resolveSandboxChildOrderId(shipmentOrderId: string, vid: string): Promise<string> {
  if (!shipmentOrderId) return '';
  const response: any = await cjRequest('shopping/order/list', {
    pageNum: 1,
    pageSize: 20,
    shipmentOrderId,
  }, 'GET');
  const rows = listRows(response);
  const match = rows.find((row) => Number(row?.isSandbox ?? 0) === 1 && rowContainsVid(row, vid))
    || rows.find((row) => Number(row?.isSandbox ?? 0) === 1)
    || rows[0];
  return text(match?.orderId || match?.id);
}

async function selectLiveAuditedVariant(supabase: any) {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,title,cj_product_id,cj_pid')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('cj_live_audit_status', 'passed')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .order('created_at', { ascending: true })
    .limit(25);
  if (productError) throw new Error(`Sandbox product lookup failed: ${productError.message}`);

  for (const product of products || []) {
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id,product_id,cj_product_id,cj_vid,cj_variant_sku,is_orderable,order_reference_type')
      .eq('product_id', product.id)
      .eq('is_orderable', true)
      .eq('order_reference_type', 'cj_vid')
      .order('created_at', { ascending: true })
      .limit(25);
    if (variantError) continue;

    for (const variant of variants || []) {
      const { data: mapping, error: mappingError } = await supabase
        .from('cj_variant_mappings')
        .select('product_variant_id,beezio_product_id,cj_product_id,cj_vid,cj_variant_sku,origin_country_code,freight_method,is_active')
        .eq('product_variant_id', variant.id)
        .eq('is_active', true)
        .maybeSingle();
      if (mappingError || !mapping) continue;
      if (text(mapping?.beezio_product_id) !== text(product.id)) continue;
      if (!text(mapping?.cj_vid) || text(mapping?.cj_vid) !== text(variant?.cj_vid)) continue;
      if (!text(mapping?.cj_variant_sku) || text(mapping?.cj_variant_sku) !== text(variant?.cj_variant_sku)) continue;
      return { product, variant, mapping };
    }
  }

  throw new Error('No live-audited SupplyLine Plus CJ variant is available for sandbox testing.');
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
  const { data: previous } = await supabase.from('cj_sandbox_test_state').select('*').eq('id', 1).maybeSingle();
  if (text(previous?.status).toLowerCase() === 'passed') return { statusCode: 202, body: '' };

  const attemptCount = Math.max(0, Number(previous?.attempt_count || 0)) + 1;
  await supabase.from('cj_sandbox_test_state').upsert({
    id: 1,
    status: 'running',
    attempt_count: attemptCount,
    started_at: previous?.started_at || now,
    last_run_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: 'id' });

  const result: Record<string, any> = {
    version: 'sandbox_v2_state_aware',
    attempt_count: attemptCount,
    started_at: now,
  };

  try {
    const { product, variant, mapping } = await selectLiveAuditedVariant(supabase);
    const vid = text(mapping.cj_vid);
    const cjProductId = text(mapping.cj_product_id || variant.cj_product_id || product.cj_product_id || product.cj_pid);

    const liveVariant = await getCJVariantByVid(vid);
    if (text(liveVariant?.vid) !== vid) throw new Error(`Live CJ VID mismatch: expected ${vid}.`);
    if (text(liveVariant?.variantSku) !== text(mapping?.cj_variant_sku)) {
      throw new Error(`Live CJ SKU mismatch for VID ${vid}.`);
    }
    const liveCost = Number(liveVariant?.variantSellPrice || 0);
    if (!(liveCost > 0)) throw new Error(`Live CJ supplier cost is invalid for VID ${vid}.`);

    const inventory = await getCJInventory(cjProductId, vid);
    if (inventory === null || inventory <= 0) throw new Error(`Live CJ VID ${vid} has no verified inventory.`);

    const freight = await chooseFreight(mapping, vid);
    const orderNumber = `BZO-SBX-${Date.now()}`;
    const createPayload = {
      orderNumber,
      shippingZip: '10001',
      shippingCountry: 'United States',
      shippingCountryCode: 'US',
      shippingProvince: 'New York',
      shippingCity: 'New York',
      shippingCustomerName: 'Beezio Sandbox',
      shippingAddress: '123 Test Street',
      email: 'sandbox@beezio.co',
      remark: 'Beezio SupplyLine Plus exact-variant sandbox verification',
      payType: 1,
      isSandbox: 1,
      logisticName: freight.option.logisticName,
      fromCountryCode: freight.originCountryCode,
      platform: 'Api',
      orderFlow: 1,
      products: [{ vid, quantity: 1, storeLineItemId: `sandbox-${variant.id}` }],
    };

    const createRaw: any = await cjRequest('shopping/order/createOrderV2', createPayload, 'POST');
    const created = createRaw?.data ?? createRaw;
    let orderId = text(created?.orderId || created?.cjOrderId || created?.id);
    const shipmentOrderId = text(created?.shipmentOrderId || created?.shipmentOrderNumber || created?.shipmentId);
    const payId = text(created?.payId || created?.paymentId);
    if (!orderId && !shipmentOrderId) throw new Error('CJ sandbox create response contained no order identifier.');
    if (!orderId && shipmentOrderId) orderId = await resolveSandboxChildOrderId(shipmentOrderId, vid);
    if (!orderId) throw new Error('Could not resolve CJ sandbox child order id.');

    result.product_id = product.id;
    result.product_title = product.title;
    result.product_variant_id = variant.id;
    result.cj_product_id = cjProductId;
    result.cj_vid = vid;
    result.cj_variant_sku = text(mapping.cj_variant_sku);
    result.live_supplier_cost = money(liveCost);
    result.live_inventory = inventory;
    result.freight_method = freight.option.logisticName;
    result.freight_cost = money(freight.option.totalPostageFee);
    result.order_number = orderNumber;
    result.cj_order_id = orderId;
    result.shipment_order_id = shipmentOrderId || null;
    result.pay_id = payId || null;

    let detail = await getCJOrderDetail(orderId);
    if (Number(detail?.isSandbox ?? detail?.sandbox ?? 0) !== 1) {
      throw new Error('CJ order query did not identify the test order as sandbox.');
    }

    const returnedVid = text(
      detail?.products?.[0]?.vid ||
      detail?.productList?.[0]?.vid ||
      detail?.orderItemList?.[0]?.vid ||
      detail?.productInfoList?.[0]?.variantId
    );
    if (returnedVid && returnedVid !== vid) {
      throw new Error(`Sandbox order VID mismatch: expected ${vid}, got ${returnedVid}.`);
    }

    let currentStatus: unknown = detail?.orderStatus ?? detail?.status;
    result.status_after_create = currentStatus;

    if (isUnpaid(currentStatus)) {
      const payPayload = shipmentOrderId ? { shipmentOrderId } : { orderId };
      const payRaw: any = await cjRequest('shopping/sandbox/simulatePay', payPayload, 'POST');
      if (payRaw?.result === false) throw new Error(payRaw?.message || 'CJ sandbox simulate-pay failed.');
      result.payment_phase = 'simulatePay';
      detail = await getCJOrderDetail(orderId);
      currentStatus = detail?.orderStatus ?? detail?.status;
    } else if (isUnshipped(currentStatus)) {
      result.payment_phase = 'sandbox_create_auto_fake_paid';
    } else {
      throw new Error(`Unexpected CJ sandbox status after create: ${text(currentStatus) || '(blank)'}.`);
    }

    if (!isUnshipped(currentStatus)) {
      throw new Error(`CJ sandbox order did not reach paid/unshipped state: ${text(currentStatus)}.`);
    }

    const numericStatus = statusNumber(currentStatus);
    if (statusName(currentStatus) === 'UNSHIPPED' || numericStatus === 300 || numericStatus === null) {
      const processingRaw: any = await cjRequest('shopping/sandbox/updateStatus', { orderId, targetStatus: 400 }, 'POST');
      if (processingRaw?.result === false) throw new Error(processingRaw?.message || 'CJ sandbox status 300→400 failed.');
      result.processing_status = 400;
    } else if (numericStatus !== null && numericStatus > 400) {
      throw new Error(`CJ sandbox order unexpectedly advanced beyond processing before test: ${numericStatus}.`);
    }

    const trackingNumber = `BZO-SBX-${Date.now().toString(36).toUpperCase()}`.slice(0, 64);
    const trackingRaw: any = await cjRequest('shopping/sandbox/updateTrackNumber', { orderId, trackNumber: trackingNumber }, 'POST');
    if (trackingRaw?.result === false) throw new Error(trackingRaw?.message || 'CJ sandbox tracking update failed.');
    result.tracking_number = trackingNumber;

    const shippedRaw: any = await cjRequest('shopping/sandbox/updateStatus', { orderId, targetStatus: 500 }, 'POST');
    if (shippedRaw?.result === false) throw new Error(shippedRaw?.message || 'CJ sandbox status 400→500 failed.');
    result.shipped_status = 500;

    const finalDetail = await getCJOrderDetail(orderId);
    if (Number(finalDetail?.isSandbox ?? finalDetail?.sandbox ?? 0) !== 1) {
      throw new Error('Final CJ order query lost sandbox flag.');
    }
    const finalStatus = finalDetail?.orderStatus ?? finalDetail?.status;
    const finalStatusNumber = statusNumber(finalStatus);
    if (!(statusName(finalStatus) === 'SHIPPED' || finalStatusNumber === 500)) {
      throw new Error(`CJ sandbox order did not finish at SHIPPED/500: ${text(finalStatus)}.`);
    }
    const returnedTracking = text(finalDetail?.trackNumber || finalDetail?.trackingNumber);
    if (returnedTracking && returnedTracking !== trackingNumber) {
      throw new Error('CJ sandbox tracking number did not round-trip correctly.');
    }

    const passedAt = new Date().toISOString();
    result.final_status = finalStatus;
    result.passed_at = passedAt;
    await supabase.from('cj_sandbox_test_state').upsert({
      id: 1,
      status: 'passed',
      attempt_count: attemptCount,
      product_id: product.id,
      product_variant_id: variant.id,
      cj_product_id: cjProductId,
      cj_vid: vid,
      cj_order_id: orderId,
      cj_order_number: orderNumber,
      simulated_tracking_number: trackingNumber,
      last_error: null,
      last_result: result,
      passed_at: passedAt,
      last_run_at: now,
      updated_at: passedAt,
    }, { onConflict: 'id' });

    await supabase.from('cj_fulfillment_settings').update({
      sandbox_verified: true,
      updated_at: passedAt,
    }).eq('id', 1);

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
