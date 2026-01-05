import { supabase } from '../lib/supabase';

export async function ensureSellerProductInOrder(params: { sellerId?: string | null; productId?: string | null }) {
  const sellerId = String(params.sellerId || '').trim();
  const productId = String(params.productId || '').trim();
  if (!sellerId || !productId) return;

  try {
    const { count } = await supabase
      .from('seller_product_order')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId);

    const displayOrder = typeof count === 'number' ? count : 0;

    await supabase
      .from('seller_product_order')
      .upsert(
        {
          seller_id: sellerId,
          product_id: productId,
          display_order: displayOrder,
          is_featured: false,
        },
        { onConflict: 'seller_id,product_id' }
      );
  } catch (error) {
    console.warn('[ensureSellerProductInOrder] failed (non-fatal):', error);
  }
}

