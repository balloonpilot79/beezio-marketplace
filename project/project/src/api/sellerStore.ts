import { supabase } from '../lib/supabase';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';

export type AddSellerStoreProductResponse = {
  ok: boolean;
  seller_id?: string;
  product_id?: string;
  existing?: boolean;
};

export const addSellerStoreProduct = async (
  productId: string,
  options?: { isFeatured?: boolean }
): Promise<AddSellerStoreProductResponse> => {
  const trimmedId = String(productId || '').trim();
  if (!trimmedId) throw new Error('Missing product id');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || '';
  const emitChange = (sellerId?: string | null) => {
    try {
      window.dispatchEvent(
        new CustomEvent('seller-products-changed', {
          detail: { productId: trimmedId, sellerId: sellerId || null },
        })
      );
    } catch {
      // ignore
    }
  };

  const tryClientSideInsert = async (): Promise<AddSellerStoreProductResponse> => {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;
    if (!user) {
      throw new Error('API routing error: seller endpoint failed and no active session found.');
    }
    const sellerId = await ensureProfileIdForUser(user);
    if (!sellerId) {
      throw new Error('API routing error: missing seller profile id.');
    }

    const sellerIds = Array.from(new Set([sellerId, user.id].map((value) => String(value || '').trim()).filter(Boolean)));
    const { data: existingRows } = await supabase
      .from('seller_product_order')
      .select('id,seller_id')
      .in('seller_id', sellerIds)
      .eq('product_id', trimmedId);
    if (Array.isArray(existingRows) && existingRows.length >= sellerIds.length) {
      emitChange(sellerId);
      return { ok: true, seller_id: sellerId, product_id: trimmedId, existing: true };
    }

    const { count } = await supabase
      .from('seller_product_order')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId);
    const displayOrder = typeof count === 'number' ? count : 0;

    const existingIds = new Set(((existingRows as any[]) || []).map((row) => String(row?.seller_id || '').trim()));
    const insertIds = sellerIds.filter((id) => !existingIds.has(id));
    let insertedCount = 0;
    let lastInsertError: any = null;
    for (const id of insertIds) {
      const { error: insertError } = await supabase
        .from('seller_product_order')
        .insert({
          seller_id: id,
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
    if (insertIds.length > 0 && insertedCount === 0) {
      throw new Error(lastInsertError?.message || 'Failed to add product');
    }

    emitChange(sellerId);
    return { ok: true, seller_id: sellerId, product_id: trimmedId, existing: false };
  };

  const callEndpoint = async (url: string) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ product_id: trimmedId, is_featured: Boolean(options?.isFeatured) }),
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

  const primaryResult = await callEndpoint('/.netlify/functions/seller-add-product');
  let response = primaryResult.res;
  let raw = primaryResult.text;
  let payload: any = primaryResult.data;

  if (!response.ok || payload?.ok === false) {
    const primary = String(payload?.error || payload?.message || '').trim();
    const details = String(payload?.details || '').trim();
    const message = [primary, details].filter(Boolean).join(' - ');
    const shouldFallback =
      /no unique or exclusion constraint matching the on conflict specification/i.test(message);

    const looksLikeSpa = raw && /<html/i.test(raw);
    const shouldTryRedirect = looksLikeSpa || response.status === 404 || response.status === 405;
    if (shouldTryRedirect) {
      const redirectResult = await callEndpoint('/api/seller/products/add');
      if (redirectResult.res.ok) {
        payload = redirectResult.data || {};
        emitChange(payload?.seller_id || null);
        return payload as AddSellerStoreProductResponse;
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

  emitChange(payload?.seller_id || null);
  return (payload || {}) as AddSellerStoreProductResponse;
};
