export const SUPPLYLINE_PLUS_NAME = 'SupplyLine Plus';
export const SUPPLYLINE_PLUS_SLUG = 'supplyline-plus';

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const asPositiveInteger = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
};

const asString = (value: unknown): string => String(value ?? '').trim();

/**
 * CJ's documented monetary fields are decimal US-dollar amounts. An integer
 * such as 1299 therefore means $1,299.00, never $12.99.
 *
 * When CJ returns a range, use its high end so a listing cannot be created
 * from an understated supplier cost.
 */
export function parseCJUsd(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? round2(value) : 0;
  }

  const matches = asString(value).match(/\d+(?:\.\d+)?/g) || [];
  const prices = matches
    .map(Number)
    .filter((price) => Number.isFinite(price) && price > 0)
    .map(round2);

  return prices.length ? Math.max(...prices) : 0;
}

export function requireExactCJVid(value: unknown, context = 'CJ variant'): string {
  const vid = asString(value);
  if (!vid) throw new Error(`${context} is missing its exact CJ VID.`);
  return vid;
}

export type CJFreightItem = {
  vid: string;
  quantity: number;
};

export type CJFreightRequest = {
  startCountryCode: string;
  endCountryCode: string;
  zip?: string;
  products: CJFreightItem[];
};

export function buildCJFreightRequest(params: {
  originCountryCode: string;
  destinationCountryCode: string;
  destinationZip?: string | null;
  items: Array<{ vid: unknown; quantity: unknown }>;
}): CJFreightRequest {
  const startCountryCode = asString(params.originCountryCode).toUpperCase();
  const endCountryCode = asString(params.destinationCountryCode).toUpperCase();
  if (!startCountryCode || !endCountryCode) {
    throw new Error('CJ freight calculation requires origin and destination country codes.');
  }

  const products = params.items.map((item, index) => ({
    vid: requireExactCJVid(item.vid, `CJ freight item ${index + 1}`),
    quantity: asPositiveInteger(item.quantity),
  }));
  if (!products.length) throw new Error('CJ freight calculation requires at least one exact VID.');

  const zip = asString(params.destinationZip);
  return {
    startCountryCode,
    endCountryCode,
    ...(zip ? { zip } : {}),
    products,
  };
}

export type CJFreightOption = {
  logisticName: string;
  logisticAging: string | null;
  logisticPrice: number;
  taxesFee: number;
  clearanceOperationFee: number;
  tariff: number;
  totalPostageFee: number;
  raw: Record<string, unknown>;
};

export function normalizeCJFreightOptions(payload: any): CJFreightOption[] {
  const data = payload?.data ?? payload;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data?.options)
        ? data.options
        : [];

  return rows
    .map((raw: any) => {
      const logisticName = asString(raw?.logisticName ?? raw?.logisticsName ?? raw?.methodName);
      const logisticPrice = parseCJUsd(raw?.logisticPrice ?? raw?.postage ?? raw?.postageAmount);
      const taxesFee = parseCJUsd(raw?.taxesFee);
      const clearanceOperationFee = parseCJUsd(raw?.clearanceOperationFee);
      const tariff = parseCJUsd(raw?.tariff);
      const documentedTotal = parseCJUsd(raw?.totalPostageFee);
      const totalPostageFee = documentedTotal > 0
        ? documentedTotal
        : round2(logisticPrice + taxesFee + clearanceOperationFee + tariff);

      if (!logisticName || totalPostageFee <= 0) return null;
      return {
        logisticName,
        logisticAging: asString(raw?.logisticAging ?? raw?.arrivalTime) || null,
        logisticPrice,
        taxesFee,
        clearanceOperationFee,
        tariff,
        totalPostageFee,
        raw: raw && typeof raw === 'object' ? raw : {},
      } satisfies CJFreightOption;
    })
    .filter((option: CJFreightOption | null): option is CJFreightOption => Boolean(option))
    .sort((left, right) => left.totalPostageFee - right.totalPostageFee);
}

export type CJCreateOrderV2Item = {
  vid: string;
  quantity: number;
  storeLineItemId?: string;
};

export type CJCreateOrderV2Payload = {
  orderNumber: string;
  shippingZip?: string;
  shippingCountry: string;
  shippingCountryCode: string;
  shippingProvince: string;
  shippingCity: string;
  shippingCounty?: string;
  shippingPhone?: string;
  shippingCustomerName: string;
  shippingAddress: string;
  shippingAddress2?: string;
  email?: string;
  remark?: string;
  payType: 3;
  logisticName: string;
  fromCountryCode: string;
  platform: 'Api';
  orderFlow: 1;
  products: CJCreateOrderV2Item[];
};

export function buildCJCreateOrderV2Payload(params: {
  orderNumber: unknown;
  logisticName: unknown;
  fromCountryCode: unknown;
  address: {
    countryCode: unknown;
    country: unknown;
    province: unknown;
    city: unknown;
    county?: unknown;
    postalCode?: unknown;
    customerName: unknown;
    address1: unknown;
    address2?: unknown;
    phone?: unknown;
    email?: unknown;
  };
  items: Array<{ vid: unknown; quantity: unknown; storeLineItemId?: unknown }>;
}): CJCreateOrderV2Payload {
  const required = {
    orderNumber: asString(params.orderNumber),
    logisticName: asString(params.logisticName),
    fromCountryCode: asString(params.fromCountryCode).toUpperCase(),
    shippingCountryCode: asString(params.address.countryCode).toUpperCase(),
    shippingCountry: asString(params.address.country),
    shippingProvince: asString(params.address.province),
    shippingCity: asString(params.address.city),
    shippingCustomerName: asString(params.address.customerName),
    shippingAddress: asString(params.address.address1),
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`CJ order is missing required fields: ${missing.join(', ')}.`);
  }

  const products = params.items.map((item, index) => {
    const storeLineItemId = asString(item.storeLineItemId);
    return {
      vid: requireExactCJVid(item.vid, `CJ order item ${index + 1}`),
      quantity: asPositiveInteger(item.quantity),
      ...(storeLineItemId ? { storeLineItemId } : {}),
    };
  });
  if (!products.length) throw new Error('CJ order requires at least one exact VID.');

  const optional = {
    shippingZip: asString(params.address.postalCode),
    shippingCounty: asString(params.address.county),
    shippingPhone: asString(params.address.phone),
    shippingAddress2: asString(params.address.address2),
    email: asString(params.address.email),
  };

  return {
    ...required,
    ...(optional.shippingZip ? { shippingZip: optional.shippingZip } : {}),
    ...(optional.shippingCounty ? { shippingCounty: optional.shippingCounty } : {}),
    ...(optional.shippingPhone ? { shippingPhone: optional.shippingPhone } : {}),
    ...(optional.shippingAddress2 ? { shippingAddress2: optional.shippingAddress2 } : {}),
    ...(optional.email ? { email: optional.email } : {}),
    remark: `Beezio ${required.orderNumber}`.slice(0, 500),
    payType: 3,
    platform: 'Api',
    orderFlow: 1,
    products,
  };
}

export type CJVideoAsset = {
  id: string;
  videoUrl: string;
  coverUrl: string | null;
  videoSize: number | null;
  duration: number | null;
};

export function normalizeCJVideoAssets(payload: any): CJVideoAsset[] {
  const data = payload?.data ?? payload;
  const rows = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
  const seen = new Set<string>();

  return rows
    .map((row: any) => {
      const videoUrl = asString(row?.videoUrl ?? row?.video_url ?? row?.url);
      if (!/^https:\/\//i.test(videoUrl) || seen.has(videoUrl)) return null;
      seen.add(videoUrl);
      const rawSize = Number(row?.videoSize);
      const rawDuration = Number(row?.duration);
      return {
        id: asString(row?.videoId ?? row?.id) || videoUrl,
        videoUrl,
        coverUrl: asString(row?.coverURL ?? row?.coverUrl) || null,
        videoSize: Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null,
        duration: Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : null,
      } satisfies CJVideoAsset;
    })
    .filter((asset: CJVideoAsset | null): asset is CJVideoAsset => Boolean(asset));
}
