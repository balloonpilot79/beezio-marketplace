export type LedgerFinanceParty = {
  amount?: number | null;
};

export type LedgerFinanceRow = {
  created_at?: string | null;
  gross_sales?: number | null;
  shipping?: number | null;
  beezio_fee?: number | null;
  paypal_fee?: number | null;
  beezio_gross_revenue?: number | null;
  beezio_net_revenue?: number | null;
  sales_tax?: number | null;
  is_counted_sale?: boolean | null;
  is_refunded?: boolean | null;
  order_status?: string | null;
  payment_status?: string | null;
  seller?: LedgerFinanceParty | null;
  affiliate?: LedgerFinanceParty | null;
  influencer?: LedgerFinanceParty | null;
};

export type FinanceBucketKey = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';

export type FinanceBucketTotals = {
  orders: number;
  realSales: number;
  grossSales: number;
  sellerPayouts: number;
  affiliatePayouts: number;
  influencerPayouts: number;
  beezioProfit: number;
  paypalFees: number;
  beezioGrossRevenue: number;
  beezioNetRevenue: number;
  salesTax: number;
  shipping: number;
};

export type FinanceBuckets = Record<FinanceBucketKey, FinanceBucketTotals>;

type FinanceBucketOptions = {
  now?: Date;
  getDate?: (row: LedgerFinanceRow) => string | null | undefined;
  includeRow?: (row: LedgerFinanceRow) => boolean;
};

const round2 = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const emptyBucket = (): FinanceBucketTotals => ({
  orders: 0,
  realSales: 0,
  grossSales: 0,
  sellerPayouts: 0,
  affiliatePayouts: 0,
  influencerPayouts: 0,
  beezioProfit: 0,
  paypalFees: 0,
  beezioGrossRevenue: 0,
  beezioNetRevenue: 0,
  salesTax: 0,
  shipping: 0,
});

const isCountedSale = (row: LedgerFinanceRow) => {
  if (typeof row.is_counted_sale === 'boolean') return row.is_counted_sale;

  const orderStatus = String(row.order_status || '').trim().toLowerCase();
  const paymentStatus = String(row.payment_status || '').trim().toLowerCase();
  return orderStatus === 'completed' || paymentStatus === 'paid';
};

const addRowToBucket = (bucket: FinanceBucketTotals, row: LedgerFinanceRow) => {
  bucket.orders += 1;
  bucket.realSales += row.is_refunded ? 0 : 1;
  bucket.grossSales += Number(row.gross_sales || 0);
  bucket.sellerPayouts += Number(row.seller?.amount || 0);
  bucket.affiliatePayouts += Number(row.affiliate?.amount || 0);
  bucket.influencerPayouts += Number(row.influencer?.amount || 0);
  bucket.beezioProfit += Number(row.beezio_fee || 0);
  bucket.paypalFees += Number(row.paypal_fee || 0);
  bucket.beezioGrossRevenue += Number(row.beezio_gross_revenue || 0);
  bucket.beezioNetRevenue += Number(row.beezio_net_revenue || 0);
  bucket.salesTax += Number(row.sales_tax || 0);
  bucket.shipping += Number(row.shipping || 0);
};

const normalizeBucket = (bucket: FinanceBucketTotals): FinanceBucketTotals => ({
  orders: bucket.orders,
  realSales: bucket.realSales,
  grossSales: round2(bucket.grossSales),
  sellerPayouts: round2(bucket.sellerPayouts),
  affiliatePayouts: round2(bucket.affiliatePayouts),
  influencerPayouts: round2(bucket.influencerPayouts),
  beezioProfit: round2(bucket.beezioProfit),
  paypalFees: round2(bucket.paypalFees),
  beezioGrossRevenue: round2(bucket.beezioGrossRevenue),
  beezioNetRevenue: round2(bucket.beezioNetRevenue),
  salesTax: round2(bucket.salesTax),
  shipping: round2(bucket.shipping),
});

export const buildFinanceBuckets = (
  rows: LedgerFinanceRow[],
  optionsOrNow: Date | FinanceBucketOptions = new Date()
): FinanceBuckets => {
  const options =
    optionsOrNow instanceof Date
      ? { now: optionsOrNow }
      : optionsOrNow;
  const now = options.now || new Date();
  const oneHourAgo = now.getTime() - 60 * 60 * 1000;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

  const buckets: FinanceBuckets = {
    hourly: emptyBucket(),
    daily: emptyBucket(),
    weekly: emptyBucket(),
    monthly: emptyBucket(),
    yearly: emptyBucket(),
    lifetime: emptyBucket(),
  };

  rows.forEach((row) => {
    if (options.includeRow) {
      if (!options.includeRow(row)) return;
    } else if (!isCountedSale(row)) {
      return;
    }

    addRowToBucket(buckets.lifetime, row);

    const rawDate = options.getDate ? options.getDate(row) : row.created_at;
    const createdAt = new Date(String(rawDate || ''));
    const createdTime = createdAt.getTime();
    if (Number.isNaN(createdTime)) return;

    if (createdTime >= oneHourAgo) addRowToBucket(buckets.hourly, row);
    if (createdTime >= dayStart) addRowToBucket(buckets.daily, row);
    if (createdTime >= weekStart.getTime()) addRowToBucket(buckets.weekly, row);
    if (createdTime >= monthStart) addRowToBucket(buckets.monthly, row);
    if (createdTime >= yearStart) addRowToBucket(buckets.yearly, row);
  });

  return {
    hourly: normalizeBucket(buckets.hourly),
    daily: normalizeBucket(buckets.daily),
    weekly: normalizeBucket(buckets.weekly),
    monthly: normalizeBucket(buckets.monthly),
    yearly: normalizeBucket(buckets.yearly),
    lifetime: normalizeBucket(buckets.lifetime),
  };
};
