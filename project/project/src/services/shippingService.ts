import { supabase } from '../lib/supabase';

export type ShippingQuoteItem = {
  productId: string;
  quantity: number;
  variantId?: string;
};

export type ShippingQuotePayload = {
  items: ShippingQuoteItem[];
};

export type CheckoutShippingOption = {
  id: string;
  methodCode: string;
  methodName: string;
  cost: number;
  minDays?: number | null;
  maxDays?: number | null;
  aging?: string | null;
};

type StoredShippingOption = {
  name?: string;
  title?: string;
  method_name?: string;
  methodName?: string;
  method_code?: string;
  methodCode?: string;
  cost?: number | string;
  price?: number | string;
  shipping_price?: number | string;
  shippingPrice?: number | string;
  estimated_days?: string;
  estimatedDays?: string;
  days?: string;
  included_in_price?: boolean;
  seller_shipping_cost?: number | string;
  live_carrier_rates?: boolean;
};

type ProductShippingRow = {
  id: string;
  requires_shipping?: boolean | null;
  is_digital?: boolean | null;
  shipping_price?: number | null;
  shipping_cost?: number | null;
  shipping_options?: unknown;
};

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const extractMissingColumnName = (message: string): string | null => {
  const quoted = message.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
  if (quoted?.[1]) return quoted[1].split('.').pop() || quoted[1];
  const unquoted = message.match(/column\s+([a-z0-9_.]+)\s+does\s+not\s+exist/i);
  if (unquoted?.[1]) return unquoted[1].split('.').pop() || unquoted[1];
  const pgrst = message.match(/Could not find the '([^']+)' column/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const parseStoredOptions = (value: unknown): StoredShippingOption[] => {
  if (Array.isArray(value)) return value as StoredShippingOption[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as StoredShippingOption[]) : [];
  } catch {
    return [];
  }
};

const parseTransitRange = (value: string | undefined): { minDays: number | null; maxDays: number | null } => {
  const raw = String(value || '').trim();
  if (!raw) return { minDays: null, maxDays: null };
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return { minDays: null, maxDays: null };
  const numbers = matches
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part) && part > 0);
  if (!numbers.length) return { minDays: null, maxDays: null };
  if (numbers.length === 1) return { minDays: numbers[0], maxDays: numbers[0] };
  return {
    minDays: Math.min(numbers[0], numbers[1]),
    maxDays: Math.max(numbers[0], numbers[1]),
  };
};

const normalizeProductOption = (row: ProductShippingRow): CheckoutShippingOption => {
  const storedOptions = parseStoredOptions(row.shipping_options);
  const freeShippingOption = storedOptions.find((option) => option?.included_in_price === true);
  const firstOption = storedOptions[0] || null;
  const fallbackCost = parseNumber(row.shipping_price ?? row.shipping_cost ?? 0);
  const sellerControlledCost = freeShippingOption
    ? parseNumber(freeShippingOption.seller_shipping_cost ?? fallbackCost)
    : fallbackCost;
  const checkoutCost = freeShippingOption ? 0 : sellerControlledCost;
  const methodName = freeShippingOption ? 'Free Shipping' : 'Seller Shipping';
  const transitText = String(
    firstOption?.estimated_days ??
    firstOption?.estimatedDays ??
    firstOption?.days ??
    (checkoutCost > 0 ? '3-5 business days' : '3-5 business days')
  ).trim();
  const range = parseTransitRange(transitText);

  return {
    id: `${row.id}:${freeShippingOption ? 'free-shipping' : 'seller-shipping'}`,
    methodCode: freeShippingOption ? 'free-shipping' : 'seller-shipping',
    methodName,
    cost: roundMoney(checkoutCost),
    minDays: range.minDays,
    maxDays: range.maxDays,
    aging: transitText || null,
  };
};

export type CheckoutShippingQuote = {
  mappedProductIds: string[];
  options: CheckoutShippingOption[];
};

export const getCheckoutShippingQuote = async (payload: ShippingQuotePayload): Promise<CheckoutShippingQuote> => {
  const productIds = Array.from(
    new Set(payload.items.map((item) => String(item.productId || '').trim()).filter(Boolean))
  );

  if (!productIds.length) {
    return { mappedProductIds: [], options: [] };
  }

  let selectedColumns = ['id', 'requires_shipping', 'is_digital', 'shipping_price', 'shipping_cost', 'shipping_options'];
  let data: any[] | null = null;
  let lastError: any = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from('products')
      .select(selectedColumns.join(','))
      .in('id', productIds);

    if (!result.error) {
      data = (result.data as any[]) || [];
      lastError = null;
      break;
    }

    lastError = result.error;
    const missing = extractMissingColumnName(String(result.error?.message || ''));
    if (missing && selectedColumns.includes(missing)) {
      selectedColumns = selectedColumns.filter((column) => column !== missing);
      continue;
    }

    break;
  }

  if (lastError) {
    throw new Error(lastError.message || 'Failed to load seller shipping settings');
  }

  const productMap = new Map<string, ProductShippingRow>(
    ((data as ProductShippingRow[]) || []).map((row) => [String(row.id), row])
  );

  const shippingLineItems = payload.items
    .map((item) => {
      const product = productMap.get(String(item.productId || '').trim());
      if (!product) return null;
      if (product.is_digital === true || product.requires_shipping === false) return null;
      return {
        item,
        product,
        option: normalizeProductOption(product),
      };
    })
    .filter(Boolean) as Array<{ item: ShippingQuoteItem; product: ProductShippingRow; option: CheckoutShippingOption }>;

  if (!shippingLineItems.length) {
    return { mappedProductIds: [], options: [] };
  }

  const combinedCost = roundMoney(
    shippingLineItems.reduce((sum, entry) => {
      return sum + Number(entry.option.cost || 0) * Math.max(1, Number(entry.item.quantity || 1));
    }, 0)
  );

  const minDaysCandidates = shippingLineItems
    .map((entry) => entry.option.minDays)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const maxDaysCandidates = shippingLineItems
    .map((entry) => entry.option.maxDays)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const minDays = minDaysCandidates.length ? Math.min(...minDaysCandidates) : null;
  const maxDays = maxDaysCandidates.length ? Math.max(...maxDaysCandidates) : null;

  return {
    mappedProductIds: shippingLineItems.map((entry) => String(entry.product.id)),
    options: [
      {
        id: 'seller-shipping-total',
        methodCode: combinedCost > 0 ? 'seller-shipping' : 'free-shipping',
        methodName: combinedCost > 0 ? 'Seller Shipping' : 'Free Shipping',
        cost: combinedCost,
        minDays,
        maxDays,
        aging:
          minDays != null && maxDays != null
            ? minDays === maxDays
              ? `${minDays} business days`
              : `${minDays}-${maxDays} business days`
            : null,
      },
    ],
  };
};

export const getCheckoutShippingOptions = async (payload: ShippingQuotePayload): Promise<CheckoutShippingOption[]> => {
  const { options } = await getCheckoutShippingQuote(payload);
  return options;
};
