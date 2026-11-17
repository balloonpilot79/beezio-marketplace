import { loadPublicSearchStores } from './_lib/publicSearchStores';
import { isPublicMarketplaceProduct } from '../../shared/publicProductVisibility';
import { storeSearchUrl, escapeHtml } from '../../shared/searchMetadata';
import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

// Only list public, active physical products; never expose private drafts.
const handler: Handler = async () => {
  try {
    const db = createSupabaseAdmin();
    const stores = await loadPublicSearchStores(db);
    const urls = ['https://beezio.co/', 'https://beezio.co/marketplace', 'https://beezio.co/stores', ...stores.map(store => storeSearchUrl(store.slug))];
    const pageSize = 500;
    for (let offset = 0; offset < 49000; offset += pageSize) {
      const { data, error } = await db.from('products')
        .select('id,is_digital,is_active,status,is_promotable,affiliate_enabled,direct_marketplace_listing,stock_quantity,total_inventory,in_stock,track_inventory')
        .eq('is_active', true)
        .eq('status', 'active')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const product of data || []) {
        if (isPublicMarketplaceProduct(product) && /^[0-9a-f-]{36}$/i.test(product.id)) {
          urls.push('https://beezio.co/product/' + product.id);
        }
      }
      if (!data || data.length < pageSize) break;
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(url => '  <url><loc>' + escapeHtml(url) + '</loc></url>').join('\n') +
      '\n</urlset>\n';
    return { statusCode: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' }, body: xml };
  } catch (error) {
    console.error('Sitemap generation failed', error);
    return { statusCode: 503, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, body: 'Sitemap temporarily unavailable' };
  }
};
export { handler };
