const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function sharedProductId(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^/(?:[^/]+/|(?:store|seller|affiliate|partner)/[^/]+/)?product/(${UUID})/?$`, 'i'));
  return match?.[1] || null;
}

export function productShareUrl(origin: string, id: string, targetPath?: string, affiliateCode?: string): string {
  const safePath = targetPath?.startsWith('/') && !targetPath.startsWith('//') ? targetPath : `/product/${encodeURIComponent(id)}`;
  const url = new URL(safePath, origin);
  if (url.origin !== new URL(origin).origin) throw new Error('Invalid product share origin');
  if (affiliateCode) url.searchParams.set('ref', affiliateCode);
  return url.href;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function productShareImage(product: any, origin: string, storageOrigin: string): string | null {
  const images = Array.isArray(product?.images) ? product.images : [];
  for (const raw of images) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const image = raw.trim();
    if (/^(?:data|javascript):/i.test(image) || image.includes('api/placeholder')) continue;
    try {
      const target = /^https?:\/\//i.test(image) || image.startsWith('/')
        ? new URL(image, origin)
        : new URL(`/storage/v1/object/public/product-images/${image.replace(/^(?:public\/|product-images\/)/, '')}`, storageOrigin);
      if (target.protocol === 'https:' || target.protocol === 'http:') return target.href;
    } catch { /* Try the next public image. */ }
  }
  return null;
}

export function injectProductShareMetadata(html: string, product: any, url: string, storageOrigin: string): string {
  const title = product ? String(product.title || 'Product') : 'Product unavailable';
  const description = product
    ? String(product.description || `Shop ${title} on Beezio.`).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
    : 'This product is currently unavailable on Beezio.';
  const image = product ? productShareImage(product, new URL(url).origin, storageOrigin) : null;
  const meta = (name: string, value: string, property = true) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escapeHtml(value)}" />`;
  const tags = [
    `<title>${escapeHtml(title)} | Beezio</title>`,
    meta('description', description, false),
    meta('og:type', product ? 'product' : 'website'),
    meta('og:site_name', 'Beezio'),
    meta('og:title', title),
    meta('og:description', description),
    meta('og:url', url),
    meta('twitter:card', image ? 'summary_large_image' : 'summary', false),
    meta('twitter:title', title, false),
    meta('twitter:description', description, false),
    ...(image ? [meta('og:image', image), meta('og:image:alt', title), meta('twitter:image', image, false)] : []),
  ].join('\n');
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, '')
    .replace('</head>', `${tags}\n</head>`);
}
