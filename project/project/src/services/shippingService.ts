// Beezio: CJ Variants + Shipping extension (do not remove)
// Client-side helper to request CJ shipping quotes via Netlify (server-side token + CORS-safe).

export type ShippingQuoteItem = {
  productId: string;
  quantity: number;
  variantId?: string;
};

export type ShippingQuotePayload = {
  destinationCountryCode: string;
  destinationZip?: string;
  items: ShippingQuoteItem[];
};

export type CheckoutShippingOption = {
  id: string;
  methodCode: string;
  methodName: string;
  cost: number;
  aging?: string | null;
};

type CJQuoteResponse = {
  mappedProductIds?: string[];
  logisticName: string | null;
  logisticPrice: number;
  logisticAging?: string | null;
  options?: Array<{
    logisticName?: string;
    logisticPrice?: number | string;
    logisticAging?: string;
  }>;
};

const parseCost = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
};

export const quoteShippingFromCJ = async (payload: ShippingQuotePayload): Promise<CJQuoteResponse> => {
  const response = await fetch('/.netlify/functions/cj-quote-shipping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationCountryCode: payload.destinationCountryCode,
      destinationZip: payload.destinationZip,
      items: payload.items,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'CJ shipping quote failed');
  }

  return data as CJQuoteResponse;
};

const normalizeCheckoutOptions = (countryCode: string, quote: CJQuoteResponse): CheckoutShippingOption[] => {
  const rawOptions =
    Array.isArray(quote.options) && quote.options.length
      ? quote.options
      : quote.logisticName
        ? [
            {
              logisticName: quote.logisticName,
              logisticPrice: quote.logisticPrice,
              logisticAging: quote.logisticAging || undefined,
            },
          ]
        : [];

  const normalized = rawOptions
    .map((opt) => {
      const methodName = (opt?.logisticName || '').toString().trim();
      const cost = parseCost(opt?.logisticPrice);
      if (!methodName || !Number.isFinite(cost)) return null;
      return {
        id: `${countryCode}:${methodName}`.toLowerCase(),
        methodCode: methodName,
        methodName,
        cost: Math.round((cost + Number.EPSILON) * 100) / 100,
        aging: typeof opt?.logisticAging === 'string' ? opt.logisticAging : null,
      } satisfies CheckoutShippingOption;
    })
    .filter(Boolean) as CheckoutShippingOption[];

  normalized.sort((a, b) => a.cost - b.cost);
  return normalized;
};

export type CheckoutShippingQuote = {
  mappedProductIds: string[];
  options: CheckoutShippingOption[];
};

export const getCheckoutShippingQuote = async (payload: ShippingQuotePayload): Promise<CheckoutShippingQuote> => {
  const countryCode = payload.destinationCountryCode.trim().toUpperCase();
  const quote = await quoteShippingFromCJ({
    ...payload,
    destinationCountryCode: countryCode,
  });

  const mappedProductIds = Array.isArray(quote.mappedProductIds)
    ? quote.mappedProductIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  return {
    mappedProductIds,
    options: normalizeCheckoutOptions(countryCode, quote),
  };
};

export const getCheckoutShippingOptions = async (payload: ShippingQuotePayload): Promise<CheckoutShippingOption[]> => {
  const { options } = await getCheckoutShippingQuote(payload);
  return options;
};
