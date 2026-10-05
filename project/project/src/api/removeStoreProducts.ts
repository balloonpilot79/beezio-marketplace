import { supabase } from '../lib/supabase';

export async function removeStoreProducts(productIds: string[], role: 'affiliate' | 'seller' = 'affiliate'): Promise<void> {
  const ids = Array.from(new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) throw new Error('Missing product id');
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session?.access_token) throw new Error('Please sign in to remove products');
  const response = await fetch('/.netlify/functions/store-remove-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ product_ids: ids, role }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || 'Could not remove products');
  if (role === 'affiliate') {
    try {
      const key = `affiliate_products_${session.user.id}`;
      const saved = JSON.parse(window.localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) window.localStorage.setItem(key, JSON.stringify(saved.filter((item: any) => !ids.includes(String(item?.productId)))));
    } catch { /* The server is authoritative even if storage is unavailable. */ }
  }
  window.dispatchEvent(new CustomEvent(`${role}-products-changed`, { detail: { productIds: ids, action: 'removed' } }));
}
