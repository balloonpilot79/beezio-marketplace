import { injectProductShareMetadata, sharedProductId } from '../../shared/productShareMetadata.ts';

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const url = new URL(request.url);
  const id = sharedProductId(url.pathname);
  if (!id || request.method !== 'GET') return;
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  try {
    // Use the public endpoint so withdrawn and sold-out products cannot leak via previews.
    const api = new URL('/api/public/product/get', url.origin);
    api.searchParams.set('id', id);
    const result = await fetch(api, { signal: AbortSignal.timeout(8000) });
    if (!result.ok && result.status !== 404) return response;
    const payload = await result.json();
    if (result.ok && (!payload.ok || !payload.product)) return response;
    const product = result.ok ? payload.product : null;
    const html = injectProductShareMetadata(await response.clone().text(), product, url.href, 'https://jzciypbdqkuwrepbfipx.supabase.co');
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('cache-control', 'no-store');
    return new Response(html, { status: response.status, headers });
  } catch (error) {
    console.error('[product-share] Preview metadata unavailable', error);
    return response;
  }
};

export const config = {
  path: ['/product/*', '/*/product/*', '/store/*/product/*', '/seller/*/product/*', '/partner/*/product/*', '/affiliate/*/product/*'],
  onError: 'bypass',
};
