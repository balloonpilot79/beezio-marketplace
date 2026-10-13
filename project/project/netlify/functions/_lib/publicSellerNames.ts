import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicSellerName } from '../../../shared/publicSellerIdentity';

export async function fetchPublicSellerNames(client: SupabaseClient, sellerIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(sellerIds.filter(Boolean))).slice(0, 500);
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const [profiles, settings] = await Promise.all([
    client.from('profiles').select('id,full_name').in('id', ids),
    client.from('store_settings').select('seller_id,store_name').in('seller_id', ids),
  ]);
  if (profiles.error || settings.error) console.warn('[publicSellerNames] Optional seller label lookup failed');
  const settingsById = new Map((settings.data || []).map(row => [String(row.seller_id), row]));
  (profiles.data || []).forEach(row => names.set(String(row.id), getPublicSellerName(row.full_name, settingsById.get(String(row.id)))));
  (settings.data || []).forEach(row => { if (!names.has(String(row.seller_id))) names.set(String(row.seller_id), getPublicSellerName(null, row)); });
  return names;
}
