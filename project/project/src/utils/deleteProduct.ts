import { supabase } from '../lib/supabase';

interface DeleteProductOptions {
  productId: string;
  sellerId?: string | null;
}

export interface DeleteProductResult {
  mode: 'deleted' | 'archived';
  warning?: string | null;
  deletedOrders?: number;
  deletedOrderItems?: number;
}

const cleanupRelatedRows = async (productId: string) => {
  const cleanupTasks = [
    supabase.from('affiliate_products').delete().eq('product_id', productId),
    supabase.from('seller_product_order').delete().eq('product_id', productId),
    supabase.from('affiliate_links').delete().eq('product_id', productId),
  ];

  await Promise.allSettled(cleanupTasks);
};

const archiveProductFallback = async (productId: string, sellerId?: string | null, warning?: string | null): Promise<DeleteProductResult> => {
  let query = supabase
    .from('products')
    .update({
      status: 'archived',
      is_active: false,
      is_promotable: false,
      in_stock: false,
    })
    .eq('id', productId);

  if (sellerId) {
    query = query.eq('seller_id', sellerId);
  }

  const { error } = await query;
  if (error) throw error;

  await cleanupRelatedRows(productId);
  return { mode: 'archived', warning: warning || null };
};

const isOrderHistoryDeleteBlock = (message: string) => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('violates foreign key constraint') ||
    normalized.includes('order_products_id_fkey') ||
    normalized.includes('order_items exist') ||
    normalized.includes('order items exist') ||
    normalized.includes('product has order history')
  );
};

export const deleteProductById = async ({ productId, sellerId }: DeleteProductOptions): Promise<DeleteProductResult> => {
  const normalizedId = String(productId || '').trim();
  if (!normalizedId) {
    throw new Error('Missing product id');
  }

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (token) {
    try {
      const response = await fetch(`/.netlify/functions/product-delete?id=${encodeURIComponent(normalizedId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await cleanupRelatedRows(normalizedId);
        const payload = await response.json().catch(() => ({} as any));
        return {
          mode: payload?.archived ? 'archived' : 'deleted',
          warning: String(payload?.warning || '').trim() || null,
          deletedOrders: Number(payload?.deletedOrders || 0) || 0,
          deletedOrderItems: Number(payload?.deletedOrderItems || 0) || 0,
        };
      }

      const payload = await response.json().catch(() => ({} as any));
      const status = response.status;
      const message = String(payload?.error || '').trim();
      const shouldFallback = status === 401 || status === 403 || status === 404;

      if (!shouldFallback) {
        throw new Error(message || `Delete failed (${status})`);
      }
    } catch (error) {
      const rawMessage = String((error as any)?.message || '').trim();
      if (isOrderHistoryDeleteBlock(rawMessage)) {
        return archiveProductFallback(normalizedId, sellerId, rawMessage);
      }
      const message = rawMessage.toLowerCase();
      const canFallback =
        !message ||
        message.includes('401') ||
        message.includes('403') ||
        message.includes('404') ||
        message.includes('failed to fetch');

      if (!canFallback) {
        throw error;
      }
    }
  }

  let query = supabase.from('products').delete().eq('id', normalizedId);
  if (sellerId) {
    query = query.eq('seller_id', sellerId);
  }

  const { error } = await query;
  if (error) {
    const message = String(error.message || '').trim();
    if (isOrderHistoryDeleteBlock(message)) {
      return archiveProductFallback(normalizedId, sellerId, message);
    }
    throw error;
  }

  await cleanupRelatedRows(normalizedId);
  return { mode: 'deleted', warning: null, deletedOrders: 0, deletedOrderItems: 0 };
};
