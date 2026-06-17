import { supabase } from '../lib/supabase';

interface ArchiveProductOptions {
  productId: string;
  sellerId?: string | null;
}

export const archiveProductById = async ({ productId, sellerId }: ArchiveProductOptions): Promise<void> => {
  const normalizedId = String(productId || '').trim();
  if (!normalizedId) {
    throw new Error('Missing product id');
  }

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (token) {
    const response = await fetch(`/.netlify/functions/product-archive?id=${encodeURIComponent(normalizedId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as any));
      const message = String(payload?.error || '').trim();
      throw new Error(message || `Archive failed (${response.status})`);
    }

    return;
  }

  let query = supabase
    .from('products')
    .update({
      status: 'archived',
      is_active: false,
      is_promotable: false,
      in_stock: false,
    })
    .eq('id', normalizedId);

  if (sellerId) {
    query = query.eq('seller_id', sellerId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
};
