import { validateCjVariantForOrdering } from '../../../shared/cjIdentity';

type GuardResult = { ok: boolean; reason?: string; warning?: string };

export async function checkOrderItemReferences(params: {
  supabaseAdmin: any;
  productId?: string | null;
  variantId?: string | null;
}): Promise<GuardResult> {
  try {
    let query = params.supabaseAdmin.from('order_items').select('id').limit(1);
    if (params.productId) query = query.eq('product_id', params.productId);
    if (params.variantId) query = query.eq('variant_id', params.variantId);
    const { data, error } = await query;
    if (error) {
      const message = String(error.message || '');
      if (/relation .*order_items.* does not exist/i.test(message)) {
        return { ok: true, warning: 'order_items table missing; deletion guard skipped' };
      }
      return { ok: false, reason: message };
    }
    if (Array.isArray(data) && data.length > 0) {
      return { ok: false, reason: 'Order items exist for this entity' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function validateCjOrderVariant(params: {
  supabaseAdmin: any;
  productId?: string | null;
  variantId?: string | null;
}) {
  const variantId = String(params.variantId || '').trim();
  const productId = String(params.productId || '').trim();
  if (!variantId) {
    return { ok: false, reason: 'No Beezio variant was selected for this CJ order.' };
  }

  const { data: variant, error } = await params.supabaseAdmin
    .from('product_variants')
    .select('id,product_id,source,source_platform,cj_variant_id,cj_vid,variant_display_sku,searchable_codes,is_orderable,order_reference_type')
    .eq('id', variantId)
    .maybeSingle();

  if (error || !variant) {
    return { ok: false, reason: error?.message || 'Selected variant could not be loaded.' };
  }

  if (productId && String((variant as any).product_id || '').trim() !== productId) {
    return { ok: false, reason: 'Selected variant does not belong to the requested product.' };
  }

  const source = String((variant as any).source || (variant as any).source_platform || '').trim().toLowerCase();
  if (source && source !== 'cj') {
    return { ok: true, variant, orderReferenceType: 'none' as const };
  }

  if ((variant as any).is_orderable === false) {
    return { ok: false, reason: 'CJ variant is flagged as not orderable and requires manual review.' };
  }

  const validation = validateCjVariantForOrdering(variant as any);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason || 'CJ variant mapping is incomplete.' };
  }

  return {
    ok: true,
    variant,
    orderReferenceType: validation.orderReferenceType,
    orderReference: validation.orderReferenceType === 'cj_vid'
      ? String((variant as any).cj_vid || '').trim()
      : String((variant as any).cj_variant_id || '').trim(),
  };
}
