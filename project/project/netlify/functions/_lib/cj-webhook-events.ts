import { applyCJOrderUpdate, extractCJOrderUpdate } from './cj-order-status';

const text = (value: unknown): string => String(value ?? '').trim();

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
  } else if (eventType === 'STOCK') {
    await applyStockMessage(supabaseAdmin, payload?.params);
  }
}
