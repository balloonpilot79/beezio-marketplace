import { deriveProductStock, deriveVariantInStock } from './cj-import-utils';

export async function recomputeProductStock(params: {
  supabaseAdmin: any;
  productId: string;
  trackInventory?: boolean;
  status?: 'draft' | 'active' | 'archived';
}) {
  const { data: productRow } = await params.supabaseAdmin
    .from('products')
    .select('id, track_inventory, status')
    .eq('id', params.productId)
    .maybeSingle();

  const trackInventory = params.trackInventory ?? (productRow as any)?.track_inventory ?? true;
  const status = (params.status ?? (productRow as any)?.status ?? 'draft') as 'draft' | 'active' | 'archived';

  const { data: variants } = await params.supabaseAdmin
    .from('product_variants')
    .select('id, inventory, inventory_policy, is_active')
    .eq('product_id', params.productId);

  const normalized = (variants as any[] | null)?.map((variant) => {
    const inventory = Number(variant?.inventory ?? 0);
    const policy = (variant?.inventory_policy || 'deny') as 'deny' | 'continue';
    const isActive = variant?.is_active !== false;
    return {
      inventory: Number.isFinite(inventory) ? Math.max(0, Math.floor(inventory)) : 0,
      inventory_policy: policy,
      is_active: isActive,
      in_stock: deriveVariantInStock({
        is_active: isActive,
        inventory: Number.isFinite(inventory) ? Math.max(0, Math.floor(inventory)) : 0,
        inventory_policy: policy,
      }),
    };
  }) ?? [];

  const stock = deriveProductStock({
    track_inventory: Boolean(trackInventory),
    status,
    variants: normalized.map((variant) => ({
      inventory: variant.inventory,
      is_active: variant.is_active,
      in_stock: variant.in_stock,
    })),
  });

  await params.supabaseAdmin
    .from('products')
    .update({
      total_inventory: stock.total_inventory,
      in_stock: stock.in_stock,
      stock_quantity: stock.total_inventory,
    })
    .eq('id', params.productId);

  return stock;
}

