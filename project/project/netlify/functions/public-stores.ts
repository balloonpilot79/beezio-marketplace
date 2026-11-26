import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { loadPublicSearchStores } from './_lib/publicSearchStores';

export const handler: Handler = async () => {
  try {
    const stores = await loadPublicSearchStores(createSupabaseAdmin(), { ownListingsOnly: true });
    return { statusCode:200, headers:{ 'Content-Type':'application/json', 'Cache-Control':'public, max-age=60, s-maxage=300' }, body:JSON.stringify({ ok:true, stores }) };
  } catch (error) {
    console.error('Public store directory failed', error);
    return { statusCode:503, headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' }, body:JSON.stringify({ ok:false, error:'Store directory temporarily unavailable' }) };
  }
};
