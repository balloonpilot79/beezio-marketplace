import { escapeHtml, injectSearchPage, plainText, SEARCH_ORIGIN, SEARCH_APP_ROUTES, storeSearchUrl } from '../../shared/searchMetadata.ts';
import { RESERVED_STORE_SLUGS } from '../../src/utils/storeSlug.ts';

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const directory = url.pathname.replace(/\/$/,'') === '/stores';
  let slug = parts.length === 1 ? parts[0] : parts.length === 2 && ['store','seller'].includes(parts[0]) ? parts[1] : '';
  if (!directory && (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug) || RESERVED_STORE_SLUGS.has(slug) || SEARCH_APP_ROUTES.has(slug) || ['ambassadors','earn-by-referring','business','store-builder'].includes(slug))) return;
  slug = slug.toLowerCase();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  try {
    const result = await fetch(new URL('/.netlify/functions/public-stores',url.origin), { signal:AbortSignal.timeout(8000) });
    if (!result.ok) return response;
    const payload = await result.json();
    if (!payload.ok || !Array.isArray(payload.stores)) return response;
    const stores = payload.stores;
    const store = stores.find((entry: any) => entry.slug === slug);
    let page: any;
    let status = 200;
    if (directory) {
      page = { title:'Discover Independent Stores | Beezio', description:'Explore independent seller and affiliate stores on Beezio.', canonical:SEARCH_ORIGIN+'/stores', content:`<h1>Discover Beezio stores</h1><p>Explore independent seller and affiliate stores.</p><ul>${stores.map((entry: any) => `<li><a href="${escapeHtml(storeSearchUrl(entry.slug))}">${escapeHtml(entry.name)}</a>${entry.description ? ` — ${escapeHtml(plainText(entry.description).slice(0,200))}` : ''}</li>`).join('')}</ul>`, schema:{ '@context':'https://schema.org','@type':'CollectionPage',name:'Beezio stores',url:SEARCH_ORIGIN+'/stores',mainEntity:{ '@type':'ItemList',itemListElement:stores.map((entry: any,index: number) => ({ '@type':'ListItem',position:index+1,name:entry.name,url:storeSearchUrl(entry.slug) })) } } };
    } else if (store) {
      const canonical = storeSearchUrl(store.slug);
      // Use exactly the same public products and placements as the live storefront.
      const api = new URL('/api/public/store/get',url.origin);
      api.searchParams.set('store',store.slug);
      const detailResponse = await fetch(api,{ signal:AbortSignal.timeout(8000) });
      if (!detailResponse.ok) return response;
      const detail = await detailResponse.json();
      if (!detail.ok || !detail.seller) return response;
      const description = plainText(detail.seller.bio || store.description || `Explore ${store.name} on Beezio.`);
      const products = Array.isArray(detail.products) ? detail.products.slice(0,48) : [];
      page = { title:`${store.name} | Beezio`,description:description.slice(0,300),canonical,content:`<h1>${escapeHtml(store.name)}</h1><p>${escapeHtml(description)}</p><h2>Shop the collection</h2>${products.length ? `<ul>${products.map((product: any) => `<li><a href="/store/${encodeURIComponent(store.slug)}/product/${encodeURIComponent(product.id)}">${escapeHtml(product.title)}</a></li>`).join('')}</ul>` : '<p>This store is preparing its collection. Check back for new products.</p>'}`,schema:{ '@context':'https://schema.org','@graph':[{ '@type':'CollectionPage','@id':canonical,name:store.name,description,url:canonical,mainEntity:{ '@type':'ItemList',itemListElement:products.map((product: any,index: number) => ({ '@type':'ListItem',position:index+1,name:product.title,url:`${canonical}/product/${encodeURIComponent(product.id)}` })) } },{ '@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Beezio',item:SEARCH_ORIGIN+'/' },{ '@type':'ListItem',position:2,name:'Stores',item:SEARCH_ORIGIN+'/stores' },{ '@type':'ListItem',position:3,name:store.name,item:canonical }] }] } };
    } else {
      status = 404;
      page = { title:'Store unavailable | Beezio', description:'This store is currently unavailable.',canonical:storeSearchUrl(slug),content:'<h1>Store unavailable</h1>',noindex:true };
    }
    const html = injectSearchPage(await response.text(),page);
    const headers = new Headers(response.headers);
    for (const key of ['content-length','content-encoding','etag']) headers.delete(key);
    // Never cache referral-bearing HTML; links and the browser URL retain attribution.
    headers.set('cache-control','no-store');
    if (status === 404) headers.set('x-robots-tag','noindex');
    return new Response(html,{status,headers});
  } catch (error) {
    console.error('[store-search] Public search content unavailable',error);
    return response;
  }
};
export const config = { path:['/:slug','/store/:slug','/seller/:slug'], onError:'bypass' };
