import { applyCJOrderUpdate, extractCJOrderUpdate } from './cj-order-status';

const text = (value: unknown): string => String(value ?? '').trim();

async function markProductsPendingAudit(
  supabaseAdmin: any,
  productIds: string[],
  details: Record<string, unknown>,
) {
  const ids = Array.from(new Set(productIds.map(text).filter(Boolean)));
  if (!ids.length) return;
  const checkedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('products')
    .update({
      cj_live_audit_status: 'pending',
      cj_live_audited_at: null,
      cj_live_audit_details: {
        invalidated_at: checkedAt,
        source: 'cj_webhook',
        ...details,
      },
      updated_at: checkedAt,
    })
    .in('id', ids);
  if (error) throw error;
}

async function applyProductMessage(supabaseAdmin: any, payload: any) {
  const params = payload?.params || {};
  const pid = text(params?.pid);
  if (!pid) return;

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id')
    .or(`cj_product_id.eq.${pid},cj_pid.eq.${pid}`)
    .eq('source_platform', 'cj');
  if (error) throw error;

  const productIds = ((products as any[]) || []).map((row) => text(row?.id)).filter(Boolean);
  if (!productIds.length) return;

  const messageType = text(payload?.messageType).toUpperCase();
  const productStatus = Number(params?.productStatus);
  const fields = Array.isArray(params?.fields) ? params.fields.map(text).filter(Boolean) : [];
  const now = new Date().toISOString();

  if (messageType === 'DELETE' || productStatus === 2) {
    const { error: disableError } = await supabaseAdmin
      .from('products')
      .update({
        is_active: false,
        is_promotable: false,
        status: 'draft',
        import_status: 'needs_review',
        verification_status: 'failed',
        verified_at: null,
        cj_live_audit_status: 'failed',
        cj_live_audited_at: now,
        cj_live_audit_details: {
          invalidated_at: now,
          source: 'cj_product_webhook',
          message_type: messageType,
          product_status: Number.isFinite(productStatus) ? productStatus : null,
          fields,
          reason: 'cj_product_off_sale_or_deleted',
        },
        updated_at: now,
      })
      .in('id', productIds);
    if (disableError) throw disableError;
    return;
  }

  await markProductsPendingAudit(supabaseAdmin, productIds, {
    event_type: 'PRODUCT',
    message_type: messageType,
    pid,
    fields,
    product_status: Number.isFinite(productStatus) ? productStatus : null,
  });
}

async function applyVariantMessage(supabaseAdmin: any, payload: any) {
  const params = payload?.params || {};
  const vid = text(params?.vid);
  if (!vid) return;

  const { data: mappings, error } = await supabaseAdmin
    .from('cj_variant_mappings')
    .select('product_variant_id,beezio_product_id,cj_vid')
    .eq('cj_vid', vid);
  if (error) throw error;
  const rows = (mappings as any[]) || [];
  if (!rows.length) return;

  const messageType = text(payload?.messageType).toUpperCase();
  const variantStatus = Number(params?.variantStatus);
  const fields = Array.isArray(params?.fields) ? params.fields.map(text).filter(Boolean) : [];
  const offSale = messageType === 'DELETE' || variantStatus === 0;
  const now = new Date().toISOString();

  if (offSale) {
    const variantIds = rows.map((row) => text(row?.product_variant_id)).filter(Boolean);
    if (variantIds.length) {
      const { error: variantError } = await supabaseAdmin
        .from('product_variants')
        .update({
          is_active: false,
          is_orderable: false,
          import_status: 'needs_review',
          updated_at: now,
        })
        .in('id', variantIds);
      if (variantError) throw variantError;
    }

    const { error: mappingError } = await supabaseAdmin
      .from('cj_variant_mappings')
      .update({ is_active: false, updated_at: now })
      .eq('cj_vid', vid);
    if (mappingError) throw mappingError;
  }

  await markProductsPendingAudit(
    supabaseAdmin,
    rows.map((row) => text(row?.beezio_product_id)),
    {
      event_type: 'VARIANT',
      message_type: messageType,
      vid,
      fields,
      variant_status: Number.isFinite(variantStatus) ? variantStatus : null,
      off_sale: offSale,
    },
  );
}

async function applyStockMessage(supabaseAdmin: any, params: any) {
  const stockRows = Object.values(params && typeof params === 'object' ? params : {})
    .flatMap((value: any) => Array.isArray(value) ? value : [])
    .map((row: any) => ({
      vid: text(row?.vid),
      stock: Number(row?.storageNum),
    }))
    .filter((row) => row.vid && Number.isFinite(row.stock));
  if (!stockRows.length) return;

  const vids = Array.from(new Set(stockRows.map((row) => row.vid)));
  const { data: mappings, error } = await supabaseAdmin
    .from('cj_variant_mappings')
    .select('cj_vid,product_variant_id,beezio_product_id')
    .in('cj_vid', vids);
  if (error) throw error;
  const stockByVid = new Map<string, number>();
  for (const row of stockRows) {
    stockByVid.set(row.vid, (stockByVid.get(row.vid) || 0) + Math.max(0, Math.floor(row.stock)));
  }
  const productIds = new Set<string>();

  for (const mapping of (mappings as any[]) || []) {
    const stock = stockByVid.get(text(mapping?.cj_vid));
    if (stock === undefined) continue;
    const { error: variantError } = await supabaseAdmin.from('product_variants').update({
      inventory: stock,
      in_stock: stock > 0,
      updated_at: new Date().toISOString(),
    }).eq('id', mapping.product_variant_id);
    if (variantError) throw variantError;
    productIds.add(text(mapping?.beezio_product_id));
  }

  for (const productId of productIds) {
    if (!productId) continue;
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('inventory')
      .eq('product_id', productId)
      .eq('is_active', true);
    const inventories = ((variants as any[]) || [])
      .map((variant) => Number(variant?.inventory))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (!inventories.length) continue;
    const total = inventories.reduce((sum, value) => sum + value, 0);
    const { error: productError } = await supabaseAdmin.from('products').update({
      stock_quantity: total,
      total_inventory: total,
      in_stock: total > 0,
      updated_at: new Date().toISOString(),
    }).eq('id', productId);
    if (productError) throw productError;
  }
}

export async function processCJWebhookPayload(supabaseAdmin: any, payload: any): Promise<void> {
  const eventType = text(payload?.type).toUpperCase();
  if (eventType === 'ORDER' || eventType === 'LOGISTIC') {
    await applyCJOrderUpdate({
      supabaseAdmin,
      update: extractCJOrderUpdate(payload),
      sendShipmentNotice: false,
    });
  } else if (eventType === 'PRODUCT') {
    await applyProductMessage(supabaseAdmin, payload);
  } else if (eventType === 'VARIANT') {
    await applyVariantMessage(supabaseAdmin, payload);
  } else if (eventType === 'STOCK') {
    await applyStockMessage(supabaseAdmin, payload?.params);
  }
}
