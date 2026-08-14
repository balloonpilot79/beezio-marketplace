import {
  configureCJWebhooks,
  normalizeCJProductSubscriptionIds,
  subscribeCJProducts,
} from './cj-api';

type CJMappingRow = {
  id: string;
  beezio_product_id: string | null;
  cj_product_id: string | null;
  price_breakdown: Record<string, any> | null;
};

type SyncCJWebhookSubscriptionsInput = {
  supabaseAdmin: any;
  onlyProductIds?: string[];
};

export type SyncCJWebhookSubscriptionsResult = {
  ok: boolean;
  callback_url: string;
  mappings_checked: number;
  products_requested: number;
  products_subscribed: number;
  products_already_current: number;
  failed_product_ids: string[];
  placed_in_supplyline_plus: number;
};

const text = (value: unknown): string => String(value ?? '').trim();

export function isCJProductSubscriptionCurrent(
  priceBreakdown: Record<string, any> | null | undefined,
  callbackUrl: string
): boolean {
  const subscription = priceBreakdown?.cj_webhook_subscription;
  return (
    text(subscription?.status).toLowerCase() === 'subscribed' &&
    text(subscription?.callback_url) === text(callbackUrl)
  );
}

async function loadMappings(supabaseAdmin: any, onlyProductIds: string[]): Promise<CJMappingRow[]> {
  const pageSize = 1000;
  const rows: CJMappingRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabaseAdmin
      .from('cj_product_mappings')
      .select('id,beezio_product_id,cj_product_id,price_breakdown')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (onlyProductIds.length) query = query.in('cj_product_id', onlyProductIds);
    const { data, error } = await query;
    if (error) throw new Error(`CJ mapping lookup failed: ${error.message}`);
    const page = (data as CJMappingRow[] | null) || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function placeMappedProductsInSupplyLinePlus(
  supabaseAdmin: any,
  mappings: CJMappingRow[]
): Promise<number> {
  const productIds = normalizeCJProductSubscriptionIds(
    mappings.map((row) => row.beezio_product_id)
  );
  if (!productIds.length) return 0;

  const { data: storefront, error: storefrontError } = await supabaseAdmin
    .from('storefronts')
    .select('id,owner_id')
    .eq('slug', 'supplyline-plus')
    .eq('is_active', true)
    .maybeSingle();
  if (storefrontError) throw new Error(`SupplyLine Plus lookup failed: ${storefrontError.message}`);
  if (!storefront?.id || !storefront?.owner_id) {
    throw new Error('SupplyLine Plus storefront is not configured.');
  }

  const placements = productIds.map((productId) => ({
    storefront_id: storefront.id,
    product_id: productId,
    placement_source: 'supplyline_plus',
    source_owner_id: storefront.owner_id,
  }));
  const { error: placementError } = await supabaseAdmin
    .from('storefront_products')
    .upsert(placements, { onConflict: 'storefront_id,product_id' });
  if (placementError) throw new Error(`SupplyLine Plus placement failed: ${placementError.message}`);

  return placements.length;
}

export async function syncCJWebhookSubscriptions(
  input: SyncCJWebhookSubscriptionsInput
): Promise<SyncCJWebhookSubscriptionsResult> {
  const onlyProductIds = normalizeCJProductSubscriptionIds(input.onlyProductIds || []);
  const { callbackUrl } = await configureCJWebhooks();
  const mappings = await loadMappings(input.supabaseAdmin, onlyProductIds);
  const placedInSupplyLinePlus = await placeMappedProductsInSupplyLinePlus(input.supabaseAdmin, mappings);

  const rowsByPid = new Map<string, CJMappingRow[]>();
  for (const row of mappings) {
    const pid = text(row.cj_product_id);
    if (!pid) continue;
    const existing = rowsByPid.get(pid) || [];
    existing.push(row);
    rowsByPid.set(pid, existing);
  }

  const allPids = Array.from(rowsByPid.keys());
  const alreadyCurrent = allPids.filter((pid) =>
    (rowsByPid.get(pid) || []).some((row) =>
      isCJProductSubscriptionCurrent(row.price_breakdown, callbackUrl)
    )
  );
  const currentSet = new Set(alreadyCurrent);
  const pendingPids = allPids.filter((pid) => !currentSet.has(pid));
  const subscription = await subscribeCJProducts(pendingPids);
  const successSet = new Set(subscription.successProductIds);
  const failSet = new Set(subscription.failProductIds);
  const attemptedAt = new Date().toISOString();

  for (const pid of pendingPids) {
    const status = successSet.has(pid) ? 'subscribed' : 'failed';
    if (!successSet.has(pid)) failSet.add(pid);
    for (const row of rowsByPid.get(pid) || []) {
      const priceBreakdown = row.price_breakdown && typeof row.price_breakdown === 'object'
        ? row.price_breakdown
        : {};
      const { error } = await input.supabaseAdmin
        .from('cj_product_mappings')
        .update({
          price_breakdown: {
            ...priceBreakdown,
            cj_webhook_subscription: {
              status,
              callback_url: callbackUrl,
              attempted_at: attemptedAt,
              subscribed_at: status === 'subscribed' ? attemptedAt : null,
            },
          },
          last_synced: attemptedAt,
        })
        .eq('id', row.id);
      if (error) throw new Error(`CJ subscription state update failed: ${error.message}`);
    }
  }

  return {
    ok: failSet.size === 0,
    callback_url: callbackUrl,
    mappings_checked: mappings.length,
    products_requested: pendingPids.length,
    products_subscribed: successSet.size,
    products_already_current: alreadyCurrent.length,
    failed_product_ids: Array.from(failSet),
    placed_in_supplyline_plus: placedInSupplyLinePlus,
  };
}
