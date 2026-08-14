export type SupplyLineSeedCandidate = {
  cjProductId: string;
  category: string;
  publicReferenceUrl: string;
};

export const SUPPLYLINE_SEED_TARGET_COUNT = 3;

// Public CJ catalog references chosen for low item cost, low weight, multiple
// variants, and an existing product video. Live CJ API checks still decide
// whether any candidate is safe to import.
export const SUPPLYLINE_SEED_CANDIDATES: SupplyLineSeedCandidate[] = [
  {
    cjProductId: '1783371385029529600',
    category: 'Pet Supplies',
    publicReferenceUrl:
      'https://cjdropshipping.com/product/string-sisal-ball-self-hi-relieving-stuffy-funny-cat-toy-p-1783371385029529600.html',
  },
  {
    cjProductId: '1387252237029478400',
    category: 'Beauty & Personal Care',
    publicReferenceUrl:
      'https://cjdropshipping.com/product/stainless-steel-tongue-scraper-p-1387252237029478400.html',
  },
  {
    cjProductId: '1394558713930584064',
    category: 'Pet Supplies',
    publicReferenceUrl:
      'https://cjdropshipping.com/product/pet-supplies-dog-plush-toys-p-1394558713930584064.html',
  },
  {
    cjProductId: '1452893259000057856',
    category: 'Pet Supplies',
    publicReferenceUrl:
      'https://cjdropshipping.com/product/dog-cloak-cute-plaid-cat-and-dog-cover-quilt-with-cotton-p-1452893259000057856.html',
  },
];

export function getRemainingSupplyLineSeedCandidates(existingProductIds: unknown[]): SupplyLineSeedCandidate[] {
  const existing = new Set(
    (existingProductIds || []).map((value) => String(value ?? '').trim()).filter(Boolean)
  );
  return SUPPLYLINE_SEED_CANDIDATES.filter((candidate) => !existing.has(candidate.cjProductId));
}

export function getSupplyLineSeedPricing(maxSupplierCost: number): {
  markup: number;
  affiliateCommission: number;
} {
  const cost = Number.isFinite(maxSupplierCost) ? Math.max(0, maxSupplierCost) : 0;
  if (cost <= 5) return { markup: 3, affiliateCommission: 3.5 };
  if (cost <= 15) return { markup: 5, affiliateCommission: 4 };
  return { markup: 8, affiliateCommission: 5 };
}
