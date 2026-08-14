import { buildShipmentEmail, sendTransactionalEmail } from './email';

const text = (value: unknown): string => String(value ?? '').trim();

const firstObject = (...values: unknown[]): any =>
  values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};

const firstArray = (...values: unknown[]): any[] =>
  (values.find((value) => Array.isArray(value)) as any[]) || [];

export type CJOrderUpdate = {
  cjOrderId: string | null;
  orderNumber: string | null;
  status: string | null;
  shipmentOrderId: string | null;
  logisticName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  raw: any;
};

export function extractCJOrderUpdate(payload: any): CJOrderUpdate {
  const root = payload?.data ?? payload?.params ?? payload ?? {};
  const order = firstObject(root?.order, root?.orderInfo, root);
  const trackingRows = firstArray(
    order?.trackingList,
    order?.trackList,
    order?.logisticList,
    order?.packages,
    root?.trackingList,
    root?.trackList,
  );
  const tracking = firstObject(trackingRows[0], order?.tracking, root?.tracking);

  const trackingStatus = Number(order?.trackingStatus ?? root?.trackingStatus);
  const inferredTrackingStatus = Number.isFinite(trackingStatus)
    ? trackingStatus === 12
      ? 'delivered'
      : trackingStatus >= 1
        ? 'shipped'
        : ''
    : '';
  const storeOrderNumbers = Array.isArray(root?.storeOrderNumbers) ? root.storeOrderNumbers : [];

  return {
    cjOrderId: text(order?.orderId ?? order?.cjOrderId ?? root?.orderId ?? root?.cjOrderId) || null,
    orderNumber: text(order?.orderNumber ?? order?.orderNum ?? root?.orderNumber ?? root?.orderNum ?? storeOrderNumbers[0]) || null,
    status: text(order?.orderStatus ?? order?.status ?? root?.orderStatus ?? root?.status ?? inferredTrackingStatus).toLowerCase() || null,
    shipmentOrderId: text(order?.shipmentOrderId ?? tracking?.shipmentOrderId ?? root?.shipmentOrderId) || null,
    logisticName: text(
      order?.logisticName ?? order?.logisticsName ?? tracking?.logisticName ?? tracking?.logisticsName ?? root?.logisticName
    ) || null,
    trackingNumber: text(
      order?.trackingNumber ?? order?.trackNumber ?? tracking?.trackingNumber ?? tracking?.trackNumber ?? tracking?.trackingNo ?? root?.trackingNumber ?? root?.trackNumber
    ) || null,
    trackingUrl: text(
      order?.trackingUrl ?? order?.trackUrl ?? tracking?.trackingUrl ?? tracking?.trackUrl ?? root?.trackingUrl
    ) || null,
    raw: payload,
  };
}

const toBeezioFulfillmentStatus = (status: string | null, hasTracking: boolean): string => {
  const normalized = text(status).toLowerCase();
  if (normalized.includes('deliver')) return 'delivered';
  if (normalized.includes('cancel') || normalized.includes('close')) return 'cancelled';
  if (hasTracking || normalized.includes('ship') || normalized.includes('dispatch')) return 'shipped';
  return 'processing';
};

async function updateOrderResilient(supabaseAdmin: any, orderId: string, payload: Record<string, any>) {
  let next = { ...payload };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabaseAdmin.from('orders').update(next).eq('id', orderId);
    if (!error) return;
    const message = String(error?.message || '');
    const missing = message.match(/column\s+"?([a-z0-9_]+)"?.*does not exist/i)?.[1] ||
      message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (missing && Object.prototype.hasOwnProperty.call(next, missing)) {
      const clone = { ...next };
      delete clone[missing];
      next = clone;
      continue;
    }
    throw error;
  }
}

export async function applyCJOrderUpdate(params: {
  supabaseAdmin: any;
  update: CJOrderUpdate;
  fallbackCjOrderRow?: any;
  sendShipmentNotice?: boolean;
}): Promise<{ matched: boolean; beezioOrderId?: string; trackingAdded?: boolean }> {
  const { supabaseAdmin, update } = params;
  let cjOrder = params.fallbackCjOrderRow || null;
  if (!cjOrder && update.cjOrderId) {
    const { data } = await supabaseAdmin.from('cj_orders').select('*').eq('cj_order_id', update.cjOrderId).maybeSingle();
    cjOrder = data || null;
  }
  if (!cjOrder && update.orderNumber) {
    const { data } = await supabaseAdmin.from('cj_orders').select('*').eq('cj_order_number', update.orderNumber).maybeSingle();
    cjOrder = data || null;
  }
  if (!cjOrder) return { matched: false };

  const now = new Date().toISOString();
  const previousTracking = text(cjOrder?.cj_tracking_number);
  const trackingNumber = update.trackingNumber || previousTracking || null;
  const trackingAdded = Boolean(trackingNumber && !previousTracking);
  const cjStatus = update.status || text(cjOrder?.cj_status) || 'processing';
  const responseData = {
    ...(cjOrder?.response_data && typeof cjOrder.response_data === 'object' ? cjOrder.response_data : {}),
    last_status_payload: update.raw,
  };

  const { error: cjUpdateError } = await supabaseAdmin.from('cj_orders').update({
    cj_order_id: update.cjOrderId || cjOrder?.cj_order_id || null,
    shipment_order_id: update.shipmentOrderId || cjOrder?.shipment_order_id || null,
    cj_status: cjStatus,
    cj_tracking_number: trackingNumber,
    cj_tracking_url: update.trackingUrl || cjOrder?.cj_tracking_url || null,
    cj_logistic_name: update.logisticName || cjOrder?.cj_logistic_name || null,
    response_data: responseData,
    last_synced_at: now,
    error_message: null,
    updated_at: now,
  }).eq('id', cjOrder.id);
  if (cjUpdateError) throw cjUpdateError;

  const beezioOrderId = text(cjOrder?.beezio_order_id);
  if (!beezioOrderId) return { matched: true, trackingAdded };
  const fulfillmentStatus = toBeezioFulfillmentStatus(cjStatus, Boolean(trackingNumber));
  await updateOrderResilient(supabaseAdmin, beezioOrderId, {
    fulfillment_status: fulfillmentStatus,
    ...(trackingNumber ? { tracking_number: trackingNumber, cj_tracking_number: trackingNumber } : {}),
    ...(update.trackingUrl ? { tracking_url: update.trackingUrl, cj_tracking_url: update.trackingUrl } : {}),
    updated_at: now,
  });

  if (trackingAdded && params.sendShipmentNotice !== false) {
    try {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id,billing_email,billing_name')
        .eq('id', beezioOrderId)
        .maybeSingle();
      const recipient = text(order?.billing_email);
      if (recipient) {
        const email = buildShipmentEmail({
          orderId: text(order?.id) || beezioOrderId,
          buyerName: text(order?.billing_name) || null,
          trackingNumber: trackingNumber!,
          trackingUrl: update.trackingUrl,
          carrier: update.logisticName,
        });
        await sendTransactionalEmail({ to: recipient, subject: email.subject, html: email.html });
      }
    } catch (error) {
      console.warn('SupplyLine shipment email failed (non-fatal):', error);
    }
  }

  return { matched: true, beezioOrderId, trackingAdded };
}
