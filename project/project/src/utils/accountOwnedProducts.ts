import { supabase } from '../lib/supabase';

type AccountOwnedProductsResponse = {
  ok?: boolean;
  ownerIds?: string[];
  products?: any[];
  error?: string;
};

export async function fetchAccountOwnedProducts(): Promise<{ ownerIds: string[]; products: any[] }> {
  const { data } = await supabase.auth.getSession();
  const token = String(data?.session?.access_token || '').trim();

  if (!token) {
    return { ownerIds: [], products: [] };
  }

  const response = await fetch('/.netlify/functions/account-owned-products', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as AccountOwnedProductsResponse;
  if (!response.ok) {
    throw new Error(String(payload?.error || `Request failed (${response.status})`));
  }

  return {
    ownerIds: Array.isArray(payload?.ownerIds) ? payload.ownerIds.map((value) => String(value || '').trim()).filter(Boolean) : [],
    products: Array.isArray(payload?.products) ? payload.products : [],
  };
}