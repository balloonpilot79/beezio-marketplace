export type NormalizedPayoutItemStatus = {
  status: 'CREATED' | 'SENT' | 'FAILED';
  errorMessage: string | null;
};

export const normalizePayoutItemStatus = (transactionStatus: string): NormalizedPayoutItemStatus => {
  const txStatus = String(transactionStatus || '').trim().toUpperCase();
  if (txStatus === 'SUCCESS') {
    return { status: 'SENT', errorMessage: null };
  }

  if (
    txStatus === 'FAILED' ||
    txStatus === 'BLOCKED' ||
    txStatus === 'DENIED' ||
    txStatus === 'RETURNED' ||
    txStatus === 'REFUNDED'
  ) {
    return { status: 'FAILED', errorMessage: txStatus || 'FAILED' };
  }

  // UNCLAIMED still represents money PayPal has made available to the recipient.
  // It can be claimed or canceled/returned later, so it must never be released
  // into a second payout batch while it remains outstanding.
  return { status: 'CREATED', errorMessage: null };
};

type FetchLike = typeof fetch;

export async function fetchPayPalPayoutBatchDetails(params: {
  baseUrl: string;
  providerBatchId: string;
  token: string;
  fetchImpl?: FetchLike;
}) {
  const fetchImpl = params.fetchImpl || fetch;
  const items: any[] = [];
  let firstPage: any = null;
  let totalPages = 1;

  for (let page = 1; page <= totalPages && page <= 1000; page += 1) {
    const url = new URL(
      `${params.baseUrl}/v1/payments/payouts/${encodeURIComponent(params.providerBatchId)}`
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', '1000');
    url.searchParams.set('total_required', 'true');

    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false as const, status: response.status, data };
    }

    if (!firstPage) firstPage = data;
    items.push(...(Array.isArray((data as any)?.items) ? (data as any).items : []));

    const reportedPages = Number((data as any)?.total_pages || 1);
    totalPages = Number.isFinite(reportedPages)
      ? Math.max(1, Math.min(1000, Math.trunc(reportedPages)))
      : 1;
  }

  return {
    ok: true as const,
    status: 200,
    data: {
      ...(firstPage || {}),
      items,
      total_items: items.length,
      total_pages: totalPages,
    },
  };
}
