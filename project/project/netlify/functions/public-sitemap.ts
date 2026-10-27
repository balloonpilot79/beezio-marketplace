import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

// Only list public, active physical products; never expose private drafts.
const handler: Handler = async () => {
  try {
    const db = createSupabaseAdmin();
    const urls = ['https://beezio.co/', 'https://beezio.co/marketplace'];
    const pageSize = 500;
    for (let offset = 0; offset < 10000; offset += pageSize) {
      const { data, error } = await db.from('products')
        .select('id,is_digital')
        .eq('is_active', true)
        .eq('is_promotable', true)
        .eq('affiliate_enabled', true)
        .eq('status', 'active')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const product of data || []) {
        if (product.is_digital !== true && /^[0-9a-f-]{36}$/i.test(product.id)) {
          urls.push('https://beezio.co/product/' + product.id);
        }
      }
      if (!data || data.length < pageSize) break;
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(url => '  <url><loc>' + url + '</loc></url>').join('\n') +
      '\n</urlset>\n';
    return { statusCode: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' }, body: xml };
  } catch (error) {
    console.error('Sitemap generation failed', error);
    return { statusCode: 503, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, body: 'Sitemap temporarily unavailable' };
  }
};
export { handler };
