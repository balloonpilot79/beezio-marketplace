type PrintifyShop = {
  id: number;
  title?: string;
  sales_channel?: string;
};

type PrintifyProduct = {
  id: string;
  title?: string;
  description?: string;
  visible?: boolean;
  images?: Array<{ src?: string }>;
  tags?: string[];
  variants?: Array<{
    id: number;
    sku?: string;
    price?: number;
    cost?: number;
    is_enabled?: boolean;
    is_available?: boolean;
    quantity?: number;
    options?: number[];
    print_provider_id?: number;
    blueprint_id?: number;
  }>;
  options?: Array<{
    type?: string;
    name?: string;
    values?: Array<{ id?: number; title?: string }>;
  }>;
};

const BASE_URL = 'https://api.printify.com/v1';

async function request<T>(params: {
  token: string;
  method?: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}): Promise<T> {
  const url = new URL(`${BASE_URL}${params.path}`);
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString(), {
    method: params.method || 'GET',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(`Printify API error: ${response.status} ${message}`);
  }
  return data as T;
}

export async function listPrintifyShops(token: string): Promise<PrintifyShop[]> {
  const data = await request<{ data?: PrintifyShop[] } | PrintifyShop[]>({
    token,
    path: '/shops.json',
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function listPrintifyProducts(token: string, shopId: number, page = 1, limit = 50) {
  return request<{ data?: PrintifyProduct[] } | PrintifyProduct[]>({
    token,
    path: `/shops/${shopId}/products.json`,
    query: { page, limit },
  });
}

export async function getPrintifyProduct(token: string, shopId: number, productId: string) {
  return request<PrintifyProduct>({
    token,
    path: `/shops/${shopId}/products/${encodeURIComponent(productId)}.json`,
  });
}

export async function createPrintifyWebhook(params: {
  token: string;
  shopId: number;
  url: string;
  secret?: string;
}) {
  return request<any>({
    token: params.token,
    method: 'POST',
    path: `/shops/${params.shopId}/webhooks.json`,
    body: {
      url: params.url,
      secret: params.secret,
      topics: ['product:publish', 'product:update', 'order:created', 'order:sent_to_production', 'order:delivered'],
    },
  });
}

export async function createPrintifyOrder(params: {
  token: string;
  shopId: number;
  externalId: string;
  addressTo: any;
  lineItems: Array<{ product_id: string; variant_id: number; quantity: number; print_provider_id?: number }>;
}) {
  return request<any>({
    token: params.token,
    method: 'POST',
    path: `/shops/${params.shopId}/orders.json`,
    body: {
      external_id: params.externalId,
      label: 'Beezio',
      line_items: params.lineItems.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        print_provider_id: item.print_provider_id,
      })),
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: params.addressTo,
    },
  });
}
