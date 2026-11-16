import { getProductShipping, priceBeforeShipping } from './productShipping.ts';
import { productShareImage } from './productShareMetadata.ts';

export const SEARCH_ORIGIN = 'https://beezio.co';
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const plainText = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export const storeSearchUrl = (slug: string) => `${SEARCH_ORIGIN}/store/${encodeURIComponent(slug)}`;
const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export function injectSearchPage(html: string, page: { title: string; description: string; canonical: string; content: string; schema?: unknown; noindex?: boolean; image?: string | null }) {
  const tags = `<title>${escapeHtml(page.title)}</title>\n<meta name="description" content="${escapeHtml(page.description)}" />\n<link rel="canonical" href="${escapeHtml(page.canonical)}" />\n<meta name="robots" content="${page.noindex ? 'noindex,follow' : 'index,follow'}" />\n` +
    Object.entries({ 'og:type': 'website', 'og:site_name': 'Beezio', 'og:title': page.title, 'og:description': page.description, 'og:url': page.canonical, ...(page.image ? { 'og:image': page.image } : {}) }).map(([k,v]) => `<meta property="${k}" content="${escapeHtml(v)}" />`).join('\n') +
    (page.schema ? `\n<script type="application/ld+json" id="beezio-search-schema">${jsonLd(page.schema)}</script>` : '');
  let result = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*id=["']beezio-search-schema["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('</head>', `${tags}\n</head>`);
  // Replace only the React root's initial contents. React mounts the full store normally.
  const root = /<div\b[^>]*id=["']root["'][^>]*>/i.exec(result);
  if (root?.index != null) {
    const start = root.index + root[0].length;
    const divs = /<div\b[^>]*>|<\/div\s*>/gi;
    divs.lastIndex = start;
    let depth = 1, match;
    while ((match = divs.exec(result))) {
      depth += /^<\//.test(match[0]) ? -1 : 1;
      if (depth === 0) {
        result = result.slice(0, start) + `<main style="max-width:1100px;margin:0 auto;padding:32px;font-family:system-ui;color:#18202b;background:white"><a href="/">Beezio</a> · <a href="/stores">Browse stores</a>${page.content}</main>` + result.slice(match.index);
        break;
      }
    }
  }
  return result;
}

export function productSearchData(product: any, id: string, storageOrigin: string) {
  const canonical = `${SEARCH_ORIGIN}/product/${encodeURIComponent(id)}`;
  const title = plainText(product.title || 'Product');
  const description = plainText(product.description || `Shop ${title} on Beezio.`);
  const image = productShareImage(product, SEARCH_ORIGIN, storageOrigin);
  // The public API's normalized price includes shipping; the UI shows it separately.
  const price = priceBeforeShipping(Number(product.calculated_customer_price ?? product.price), getProductShipping(product));
  const currency = /^[A-Z]{3}$/.test(String(product.currency || '').toUpperCase()) ? String(product.currency).toUpperCase() : 'USD';
  const productSchema: any = { '@type': 'Product', '@id': canonical + '#product', name: title, description, url: canonical, ...(image ? { image: [image] } : {}) };
  if (Number.isFinite(price) && price > 0) productSchema.offers = { '@type': 'Offer', url: canonical, price: price.toFixed(2), priceCurrency: currency, availability: 'https://schema.org/InStock' };
  const seller = plainText(product.seller_name || product.profiles?.full_name);
  const content = `<h1>${escapeHtml(title)}</h1>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:100%;max-height:400px" />` : ''}<p>${escapeHtml(description)}</p>${Number.isFinite(price) && price > 0 ? `<p>${escapeHtml(currency)} ${price.toFixed(2)} · Shipping calculated at checkout</p>` : ''}${seller ? `<p>Sold by ${escapeHtml(seller)}</p>` : ''}<p><a href="/marketplace">Explore the marketplace</a></p>`;
  return { title: `${title} | Beezio`, description: description.slice(0,300), canonical, image, content,
    schema: { '@context': 'https://schema.org', '@graph': [productSchema, { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem',position:1,name:'Beezio',item:SEARCH_ORIGIN+'/' },{ '@type':'ListItem',position:2,name:'Marketplace',item:SEARCH_ORIGIN+'/marketplace' },{ '@type':'ListItem',position:3,name:title,item:canonical }] }] } };
}

// All concrete top-level app routes take precedence over custom store slugs.
export const SEARCH_APP_ROUTES = new Set(['', 'about', 'account', 'add-product', 'add-product-old', 'admin', 'affiliate', 'affiliate-dashboard-preview', 'affiliate-guide', 'affiliate-signup', 'affiliates', 'ambassadors', 'auth', 'business', 'buyer-dashboard-preview', 'cart', 'change-password', 'checkout', 'contact', 'contact-support', 'dashboard', 'dashboard-preview', 'debug-sw', 'digital-products', 'earn-by-referring', 'earnings', 'faq', 'get-started', 'help-center', 'home', 'how-it-works', 'inbox', 'influencers', 'insurance', 'join', 'marketplace', 'messages', 'messaging-smoke', 'onboarding', 'order-confirmation', 'orders', 'picks', 'privacy', 'products', 'profile', 'reset-password', 'returns', 'revolutionary', 'search', 'sellers', 'shipping', 'signup', 'start-earning', 'store-builder', 'stores', 'support', 'terms']);
