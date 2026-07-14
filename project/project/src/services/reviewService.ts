import { supabase } from '../lib/supabase';

export interface ProductReviewRecord {
  id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  review?: string | null;
  created_at?: string | null;
  verified_purchase?: boolean | null;
  reviewer_id?: string | null;
  buyer_id?: string | null;
  profiles?: {
    full_name?: string | null;
  } | null;
}

interface SubmitProductReviewInput {
  productId: string;
  userId: string;
  rating: number;
  content: string;
  title?: string;
  requireVerifiedPurchase?: boolean;
}

const PURCHASE_STATUS_ALLOWLIST = new Set([
  'paid',
  'completed',
  'fulfilled',
  'shipped',
  'delivered',
]);

const PAYMENT_STATUS_ALLOWLIST = new Set([
  'paid',
  'completed',
  'succeeded',
]);

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const missing = extractMissingColumnName(String(error?.message || ''));
  return String(missing || '').toLowerCase() === String(columnName || '').toLowerCase();
};

const shouldSilentlySkipOrdersCheck = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.status || 0);
  return (
    status >= 500 ||
    code === '42p01' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );
};

const fetchOrderRowsByColumn = async (
  userColumn: 'buyer_id' | 'user_id',
  userId: string
): Promise<Array<{ id: string; status?: string | null; payment_status?: string | null }>> => {
  let selectedColumns = ['id', 'status', 'payment_status'];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from('orders')
      .select(selectedColumns.join(','))
      .eq(userColumn, userId)
      .limit(300);

    if (!error) {
      return (data as any[]) || [];
    }

    lastError = error;
    const missing = extractMissingColumnName(String(error?.message || ''));
    if (missing && selectedColumns.includes(missing)) {
      selectedColumns = selectedColumns.filter((column) => column !== missing);
      continue;
    }

    throw error;
  }

  throw lastError;
};

const insertReviewWithFallback = async (payload: Record<string, any>) => {
  let working = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase.from('product_reviews').insert(working);
    if (!error) return;

    const code = String((error as any)?.code || '').trim();
    if (code === '23505') {
      throw new Error('You already reviewed this product.');
    }

    const missing = extractMissingColumnName(String((error as any)?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete (working as any)[missing];
      continue;
    }

    throw error;
  }
  throw new Error('Unable to submit review right now.');
};

const userOwnsReviewByColumn = async (productId: string, userId: string, userColumn: 'reviewer_id' | 'buyer_id') => {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', productId)
    .eq(userColumn, userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error, userColumn)) {
      return { exists: false, missingColumn: true };
    }
    throw error;
  }

  return { exists: Boolean(data), missingColumn: false };
};

const userOwnsReviewByAuthId = async (productId: string, userId: string) => {
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', productId)
    .eq('reviewer_user_id', userId)
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error, 'reviewer_user_id')) return { exists: false, missingColumn: true };
    throw error;
  }
  return { exists: Boolean(data), missingColumn: false };
};

export async function hasExistingProductReview(productId: string, userId: string): Promise<boolean> {
  try {
    const authUserCheck = await userOwnsReviewByAuthId(productId, userId);
    if (authUserCheck.exists) return true;
    if (!authUserCheck.missingColumn) return false;

    const reviewerCheck = await userOwnsReviewByColumn(productId, userId, 'reviewer_id');
    if (reviewerCheck.exists) return true;
    if (!reviewerCheck.missingColumn) return false;

    const buyerCheck = await userOwnsReviewByColumn(productId, userId, 'buyer_id');
    return buyerCheck.exists;
  } catch {
    return false;
  }
}

const fetchOrderRowsForUser = async (userId: string): Promise<Array<{ id: string; status?: string | null; payment_status?: string | null }>> => {
  try {
    return await fetchOrderRowsByColumn('buyer_id', userId);
  } catch (primaryError) {
    if (!isMissingColumnError(primaryError, 'buyer_id') && !shouldSilentlySkipOrdersCheck(primaryError)) {
      throw primaryError;
    }
  }

  try {
    return await fetchOrderRowsByColumn('user_id', userId);
  } catch (fallbackError) {
    if (shouldSilentlySkipOrdersCheck(fallbackError) || isMissingColumnError(fallbackError, 'user_id')) {
      return [];
    }
    throw fallbackError;
  }
};

const isPaidLikeOrder = (row: { status?: string | null; payment_status?: string | null }) => {
  const status = String(row?.status || '').trim().toLowerCase();
  const paymentStatus = String(row?.payment_status || '').trim().toLowerCase();
  if (status && PURCHASE_STATUS_ALLOWLIST.has(status)) return true;
  if (paymentStatus && PAYMENT_STATUS_ALLOWLIST.has(paymentStatus)) return true;
  if (!status && !paymentStatus) return true;
  return false;
};

export async function hasVerifiedPurchase(productId: string, userId: string): Promise<boolean> {
  try {
    const orderRows = await fetchOrderRowsForUser(userId);
    const eligibleOrderIds = orderRows.filter(isPaidLikeOrder).map((row) => row.id).filter(Boolean);
    if (!eligibleOrderIds.length) return false;

    const { data, error } = await supabase
      .from('order_items')
      .select('id')
      .eq('product_id', productId)
      .in('order_id', eligibleOrderIds)
      .limit(1);

    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function submitProductReview(input: SubmitProductReviewInput): Promise<{ verifiedPurchase: boolean }> {
  const productId = String(input.productId || '').trim();
  const userId = String(input.userId || '').trim();
  const content = String(input.content || '').trim();
  const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5)));
  const title = String(input.title || content.slice(0, 100)).trim();
  const requireVerifiedPurchase = input.requireVerifiedPurchase !== false;

  if (!productId || !userId) {
    throw new Error('Missing product or user information.');
  }
  if (content.length < 5) {
    throw new Error('Please write a short review before submitting.');
  }

  const alreadyReviewed = await hasExistingProductReview(productId, userId);
  if (alreadyReviewed) {
    throw new Error('You already reviewed this product.');
  }

  const verifiedPurchase = await hasVerifiedPurchase(productId, userId);
  if (requireVerifiedPurchase && !verifiedPurchase) {
    throw new Error('Only customers who purchased this product can leave a review.');
  }

  await insertReviewWithFallback({
    product_id: productId,
    reviewer_user_id: userId,
    rating,
    title,
    content,
    review: content,
    verified_purchase: verifiedPurchase,
  });

  return { verifiedPurchase };
}

export async function getUserProductReviewStatus(productId: string, userId: string): Promise<{ hasReviewed: boolean; verifiedPurchase: boolean }> {
  const [hasReviewed, verifiedPurchase] = await Promise.all([
    hasExistingProductReview(productId, userId),
    hasVerifiedPurchase(productId, userId),
  ]);

  return { hasReviewed, verifiedPurchase };
}

export async function fetchProductReviews(productId: string, limit: number = 20): Promise<ProductReviewRecord[]> {
  const buildRows = async (selectedColumns: string[]) => {
    return await supabase
      .from('product_reviews')
      .select(selectedColumns.join(','))
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
  };

  let selectedColumns = [
    'id',
    'rating',
    'title',
    'content',
    'review',
    'created_at',
    'verified_purchase',
    'reviewer_id',
    'buyer_id',
    'profiles:reviewer_id(full_name)',
  ];
  let lastError: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await buildRows(selectedColumns);

    if (!error) {
      return ((data as ProductReviewRecord[]) || []).map((row) => ({
        ...row,
        title: row.title ?? null,
        content: row.content ?? row.review ?? null,
        review: row.review ?? row.content ?? null,
        profiles: row.profiles || { full_name: null },
      }));
    }

    lastError = error;
    const missing = extractMissingColumnName(String(error?.message || ''));
    if (missing && selectedColumns.includes(missing)) {
      selectedColumns = selectedColumns.filter((column) => column !== missing);
      continue;
    }

    const message = String(error?.message || '').toLowerCase();
    if (
      selectedColumns.includes('profiles:reviewer_id(full_name)') &&
      (message.includes('relationship') || message.includes('embed') || message.includes('reviewer_id'))
    ) {
      selectedColumns = selectedColumns.filter((column) => column !== 'profiles:reviewer_id(full_name)');
      continue;
    }

    throw new Error(`Failed to fetch product reviews: ${error.message}`);
  }

  throw new Error(`Failed to fetch product reviews: ${lastError?.message || 'Unknown error'}`);
}
