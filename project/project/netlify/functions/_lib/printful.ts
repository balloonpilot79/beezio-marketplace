type PrintfulStore = {
  id: number;
  name?: string;
};

type PrintfulSyncProduct = {
  id: number;
  name?: string;
  thumbnail_url?: string;
  external_id?: string | null;
  variants?: number;
};

type PrintfulSyncProductDetail = {
  sync_product: {
    id: number;
    name?: string;
    description?: string;
    thumbnail_url?: string;
  };
  sync_variants: Array<{
    id: number;
    sku?: string;
    name?: string;
    price?: string | number;
    retail_price?: string | number;
    currency?: string;
    files?: Array<{ url?: string }>;
    options?: Array<{ id?: number; value?: string; name?: string }>;
    product?: { image?: string };
  }>;
};

const BASE_URL = 'https://api.printful.com';

async function request<T>(params: {
  token: string;
  method?: string;
  path: string;
  body?: unknown;
  storeId?: number;
  query?: Record<string, string | number | boolean | undefined>;
}): Promise<T> {
  const url = new URL(`${BASE_URL}${params.path}`);
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.token}`,
    'Content-Type': 'application/json',
  };
  if (params.storeId) {
    headers['X-PF-Store-Id'] = String(params.storeId);
  }
  const response = await fetch(url.toString(), {
    method: params.method || 'GET',
    headers,
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.result?.message || data?.error || response.statusText;
    throw new Error(`Printful API error: ${response.status} ${message}`);
  }
  return data as T;
}

export async function listPrintfulStores(token: string): Promise<PrintfulStore[]> {
  const data = await request<{ result?: PrintfulStore[] }>({
    token,
    path: '/stores',
  });
  return data?.result || [];
}

export async function listPrintfulProducts(token: string, storeId?: number, offset = 0, limit = 50) {
  return request<{ result?: PrintfulSyncProduct[] }>({
    token,
    path: '/store/products',
    query: { offset, limit },
    storeId,
  });
}

export async function getPrintfulProduct(token: string, productId: number, storeId?: number) {
  return request<{ result?: PrintfulSyncProductDetail }>({
    token,
    path: `/store/products/${productId}`,
    storeId,
  });
}

export async function createPrintfulOrder(params: {
  token: string;
  storeId?: number;
  externalId: string;
  recipient: any;
  items: Array<{ sync_variant_id: number; quantity: number }>;
}) {
  return request<any>({
    token: params.token,
    method: 'POST',
    path: '/orders',
    storeId: params.storeId,
    query: { confirm: true },
    body: {
      external_id: params.externalId,
      recipient: params.recipient,
      items: params.items.map((item) => ({
        sync_variant_id: item.sync_variant_id,
        quantity: item.quantity,
      })),
    },
  });
}

export async function createPrintfulWebhook(params: {
  token: string;
  storeId?: number;
  url: string;
  secret?: string;
}) {
  return request<any>({
    token: params.token,
    method: 'POST',
    path: '/webhooks',
    storeId: params.storeId,
    body: {
      url: params.url,
      types: [
        'product_updated',
        'product_deleted',
        'package_shipped',
        'order_failed',
        'order_canceled',
      ],
      ...(params.secret ? { secret: params.secret } : {}),
    },
  });
}
