import { supabase } from '../lib/supabase';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';

type AddAffiliateProductResponse = {
  ok: boolean;
  affiliate_id?: string;
  product_id?: string;
  existing?: boolean;
};

export const addAffiliateProduct = async (
  productId: string,
  options?: { isFeatured?: boolean; affiliateId?: string }
): Promise<AddAffiliateProductResponse> => {
  const trimmedId = String(productId || '').trim();
  if (!trimmedId) {
    throw new Error('Missing product id');
  }
  const emitChange = (affiliateId?: string | null) => {
    try {
      window.dispatchEvent(
        new CustomEvent('affiliate-products-changed', {
          detail: { productId: trimmedId, affiliateId: affiliateId || null },
        })
      );
    } catch {
      // ignore
    }
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || '';

  const tryClientSideInsert = async (): Promise<AddAffiliateProductResponse> => {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;
    if (!user) {
      throw new Error('API routing error: affiliate endpoint failed and no active session found.');
    }
    const candidateAffiliateId = String(options?.affiliateId || '').trim();
    const affiliateId = candidateAffiliateId || (await ensureProfileIdForUser(user));
    if (!affiliateId) {
      throw new Error('API routing error: missing affiliate profile id.');
    }

    const affiliateIds = Array.from(new Set([affiliateId, user.id].map((value) => String(value || '').trim()).filter(Boolean)));
    const { data: existingRows } = await supabase
      .from('affiliate_products')
      .select('id, affiliate_id')
      .in('affiliate_id', affiliateIds)
      .eq('product_id', trimmedId);
    if (Array.isArray(existingRows) && existingRows.length >= affiliateIds.length) {
      emitChange(affiliateId);
      return { ok: true, affiliate_id: affiliateId, product_id: trimmedId, existing: true };
    }

    const { count } = await supabase
      .from('affiliate_products')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId);
    const displayOrder = typeof count === 'number' ? count : 0;

    const existingIds = new Set(((existingRows as any[]) || []).map((row) => String(row?.affiliate_id || '').trim()));
    const insertIds = affiliateIds.filter((candidate) => !existingIds.has(candidate));
    const orderedInsertIds = Array.from(new Set([user.id, ...insertIds].map((value) => String(value || '').trim()).filter((value) => insertIds.includes(value))));
    let insertedCount = 0;
    let lastInsertError: any = null;
    for (const id of orderedInsertIds) {
      const { error: insertError } = await supabase
        .from('affiliate_products')
        .insert({
          affiliate_id: id,
          product_id: trimmedId,
          display_order: displayOrder,
          is_featured: Boolean(options?.isFeatured),
        });
      if (insertError) {
        lastInsertError = insertError;
        continue;
      }
      insertedCount += 1;
    }
    if (orderedInsertIds.length > 0 && insertedCount === 0) {
      throw new Error(lastInsertError?.message || 'Failed to add product');
    }

    emitChange(affiliateId);
    return { ok: true, affiliate_id: affiliateId, product_id: trimmedId, existing: false };
  };

  const callEndpoint = async (url: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        product_id: trimmedId,
        is_featured: Boolean(options?.isFeatured),
        affiliate_id: String(options?.affiliateId || '').trim() || null,
      }),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { res, text, data };
  };

  // Prefer calling the function directly so redirects/edge routing don't break adds.
  const primaryResult = await callEndpoint('/.netlify/functions/affiliate-add-product');
  let response = primaryResult.res;
  let raw = primaryResult.text;
  let payload: any = primaryResult.data;

  if (!response.ok || payload?.ok === false) {
    const primary = String(payload?.error || payload?.message || '').trim();
    const details = String(payload?.details || '').trim();
    const message = [primary, details].filter(Boolean).join(' - ');
    const shouldFallback =
      /no unique or exclusion constraint matching the on conflict specification/i.test(message);

    // If function call failed (network/cache), try the Netlify redirect path.
    const looksLikeSpa = raw && /<html/i.test(raw);
    const shouldTryRedirect = looksLikeSpa || response.status === 404 || response.status === 405;
    if (shouldTryRedirect) {
      const redirectResult = await callEndpoint('/api/affiliate/products/add');
      if (redirectResult.res.ok) {
        payload = redirectResult.data || {};
        emitChange(payload?.affiliate_id || null);
        return payload as AddAffiliateProductResponse;
      }
    }

    if (shouldFallback) {
      try {
        return await tryClientSideInsert();
      } catch (err) {
        const fallbackMsg = err instanceof Error ? err.message : String(err || '');
        if (fallbackMsg) throw new Error(fallbackMsg);
      }
    }
    if (message) throw new Error(message);

    if (raw && /<html/i.test(raw)) {
      return await tryClientSideInsert();
    }

    throw new Error(raw || 'Failed to add product');
  }

  // Let any open dashboards/lists refresh after add.
  emitChange(payload?.affiliate_id || null);

  return (payload || {}) as AddAffiliateProductResponse;
};
