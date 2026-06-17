import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getCJInventory } from './_lib/cj-api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler: Handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      body: 'Missing Supabase credentials',
    };
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch all CJ products (assuming lineage or vendor field marks them)
  const { data: products, error } = await supabase
    .from('products')
    .select('id, cj_product_id, lineage, stock_quantity, api_integration')
    .or('lineage.eq.CJ,api_integration->>supplier.eq.CJdropshipping')
    // No limit: process all matching CJ products

  if (error) {
    return {
      statusCode: 500,
      body: 'Failed to fetch products: ' + error.message,
    };
  }

  let updated = 0;
  for (const product of products || []) {
    const candidateIds = [
      product.cj_product_id,
      product.api_integration?.supplier_product_id,
      product.api_integration?.product_id,
      product.api_integration?.pid,
    ]
      .map((value: unknown) => String(value || '').trim())
      .filter(Boolean);

    const cjId = candidateIds.find((id) => !UUID_REGEX.test(id));
    if (!cjId) {
      console.warn(`[sync-cj-inventory] Skipping ${product.id}: missing valid CJ product id`);
      continue;
    }

    try {
      console.log(`[sync-cj-inventory] Fetching stock for product ${product.id} (CJ ID: ${cjId})`);
      const stock = await getCJInventory(cjId);
      console.log(`[sync-cj-inventory] Stock for ${product.id}:`, stock);
      if (typeof stock === 'number' && stock !== product.stock_quantity) {
        await supabase
          .from('products')
          .update({
            stock_quantity: stock,
            total_inventory: stock,
            in_stock: stock > 0,
          })
          .eq('id', product.id);
        updated++;
        console.log(`[sync-cj-inventory] Updated stock for ${product.id} to ${stock}`);
      }
    } catch (e) {
      console.error(`[sync-cj-inventory] Failed to sync inventory for ${product.id}:`, e);
    }
  }

  return {
    statusCode: 200,
    body: `Synced inventory for ${updated} CJ products`,
  };
};

export { handler };
