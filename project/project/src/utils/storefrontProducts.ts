export type StorefrontOrderEntry = {
  product_id: string;
  display_order?: number | null;
  is_featured?: boolean | null;
};

export type StorefrontProduct = {
  id: string;
  created_at?: string | null;
  [key: string]: any;
};

export function buildSellerStorefrontProducts(params: {
  sellerOwnedProducts: StorefrontProduct[];
  curatedProducts: StorefrontProduct[];
  orderEntries: StorefrontOrderEntry[];
}): Array<StorefrontProduct & { display_order: number; is_featured: boolean }> {
  const byId = new Map<string, StorefrontProduct>();

  for (const p of params.sellerOwnedProducts || []) {
    if (p?.id) byId.set(String(p.id), p);
  }
  for (const p of params.curatedProducts || []) {
    if (p?.id) byId.set(String(p.id), p);
  }

  const orderById = new Map<string, StorefrontOrderEntry>();
  for (const entry of params.orderEntries || []) {
    if (entry?.product_id) orderById.set(String(entry.product_id), entry);
  }

  const products = Array.from(byId.values()).map((product) => {
    const order = orderById.get(String(product.id));
    return {
      ...product,
      display_order: Number.isFinite(Number(order?.display_order))
        ? Number(order?.display_order)
        : Number.isFinite(Number((product as any)?.display_order))
          ? Number((product as any).display_order)
          : 999,
      is_featured: order?.is_featured ?? Boolean((product as any)?.is_featured),
    };
  });

  products.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return products;
}
