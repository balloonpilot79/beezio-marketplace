// Page through the entire eligible catalog, including pages whose rows are
// removed by visibility checks. Never silently present a partial page as complete.
export async function fetchMarketplaceCatalog(signal: AbortSignal): Promise<any[]> {
  const rows = new Map<string, any>();
  let offset = 0;
  while (true) {
    let payload: any;
    let lastError: unknown;
    for (const endpoint of ['/api/public/marketplace/products', '/.netlify/functions/public-marketplace-products']) {
      try {
        const response = await fetch(`${endpoint}?page_size=160&offset=${offset}`, { signal });
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data?.products)) throw new Error('Invalid catalog response');
        payload = data;
        break;
      } catch (error) {
        lastError = error;
        if (signal.aborted) throw error;
      }
    }
    if (!payload) throw lastError;
    payload.products.forEach((row: any) => rows.set(String(row.id), row));
    if (payload.next_offset == null) return [...rows.values()];
    if (!Number.isSafeInteger(payload.next_offset) || payload.next_offset <= offset) {
      throw new Error('Invalid catalog pagination');
    }
    offset = payload.next_offset;
  }
}
