import { supabase } from '../lib/supabase';

export async function ensureSellerProductInOrder(params: { sellerId?: string | null; productId?: string | null }) {
  const sellerId = String(params.sellerId || '').trim();
  const productId = String(params.productId || '').trim();
  if (!sellerId || !productId) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = String(sessionData?.session?.user?.id || '').trim();
    const sellerIds = Array.from(new Set([sellerId, authUserId].filter(Boolean)));

    const { count } = await supabase
      .from('seller_product_order')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId);

    const displayOrder = typeof count === 'number' ? count : 0;
    const { data: existingRows } = await supabase
      .from('seller_product_order')
      .select('seller_id')
      .in('seller_id', sellerIds)
      .eq('product_id', productId);
    const existingIds = new Set(((existingRows as any[]) || []).map((row) => String(row?.seller_id || '').trim()));

    for (const id of sellerIds.filter((candidate) => !existingIds.has(candidate))) {
      const { error } = await supabase.from('seller_product_order').insert({
        seller_id: id,
        product_id: productId,
        display_order: displayOrder,
        is_featured: false,
      });
      if (error && String((error as any)?.code || '') !== '23505') {
        console.warn('[ensureSellerProductInOrder] insert failed (non-fatal):', error);
      }
    }
  } catch (error) {
    console.warn('[ensureSellerProductInOrder] failed (non-fatal):', error);
  }
}
