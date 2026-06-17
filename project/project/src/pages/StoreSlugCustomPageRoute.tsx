import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StoreCustomPageView from './StoreCustomPageView';
import { getStoreSlugLookupCandidates, normalizeStoreSlug } from '../utils/normalizeStoreSlug';

const StoreSlugCustomPageRoute: React.FC = () => {
  const { storeSlug, pageSlug } = useParams<{ storeSlug: string; pageSlug: string }>();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [storeType, setStoreType] = useState<'seller' | 'affiliate' | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const normalizedSlug = normalizeStoreSlug(storeSlug);

  useEffect(() => {
    if (!storeSlug || !pageSlug) {
      setLoading(false);
      setStoreType(null);
      setStoreId(null);
      return;
    }

    const loadStore = async () => {
      try {
        setLoading(true);
        const cleanSlug = normalizeStoreSlug(storeSlug);

        // Prefer the public resolver so slug routing uses one authoritative source.
        try {
          const resp = await fetch(`/api/public/store/resolve?slug=${encodeURIComponent(cleanSlug)}`);
          if (resp.ok) {
            const payload: any = await resp.json().catch(() => ({}));
            const resolvedType = String(payload?.store_type || '').trim();
            const resolvedId = String(payload?.store_id || '').trim();
            if ((resolvedType === 'seller' || resolvedType === 'affiliate') && resolvedId) {
              setStoreType(resolvedType);
              setStoreId(resolvedId);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Fall back to direct client lookups if the public resolver is unavailable.
        }

        const [
          { data: sellerMatch, error: sellerError },
          { data: affiliateMatch, error: affiliateError },
        ] = await Promise.all([
          supabase
            .from('store_settings')
            .select('seller_id')
            .in('subdomain', getStoreSlugLookupCandidates(cleanSlug))
            .maybeSingle(),
          supabase
            .from('affiliate_store_settings')
            .select('affiliate_id')
            .in('subdomain', getStoreSlugLookupCandidates(cleanSlug))
            .maybeSingle(),
        ]);
        if (sellerError && sellerError.code !== 'PGRST116') {
          console.warn('[StoreSlugCustomPageRoute] Seller slug lookup error:', sellerError);
        }
        if (affiliateError && affiliateError.code !== 'PGRST116') {
          console.warn('[StoreSlugCustomPageRoute] Affiliate slug lookup error:', affiliateError);
        }

        if (sellerMatch?.seller_id && affiliateMatch?.affiliate_id) {
          try {
            const [sellerProductsRes, sellerOrderRes, affiliateProductsRes] = await Promise.all([
              supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('seller_id', sellerMatch.seller_id)
                .eq('is_active', true),
              supabase
                .from('seller_product_order')
                .select('product_id', { count: 'exact', head: true })
                .eq('seller_id', sellerMatch.seller_id),
              supabase
                .from('affiliate_products')
                .select('product_id', { count: 'exact', head: true })
                .eq('affiliate_id', affiliateMatch.affiliate_id),
            ]);
            const sellerCount = Number(sellerProductsRes.count || 0) + Number(sellerOrderRes.count || 0);
            const affiliateCount = Number(affiliateProductsRes.count || 0);
            if (affiliateCount > 0 && sellerCount === 0) {
              setStoreType('affiliate');
              setStoreId(affiliateMatch.affiliate_id);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.warn('[StoreSlugCustomPageRoute] Shared slug product-count lookup failed, using seller fallback:', error);
          }
        }

        if (sellerMatch?.seller_id) {
          setStoreType('seller');
          setStoreId(sellerMatch.seller_id);
          setLoading(false);
          return;
        }

        if (affiliateMatch?.affiliate_id) {
          setStoreType('affiliate');
          setStoreId(affiliateMatch.affiliate_id);
          setLoading(false);
          return;
        }

        // Fallback: some deployments store the slug on profiles.
        try {
          const { data: profileSlugMatch, error: profileSlugError } = await supabase
            .from('profiles')
            .select('id')
            .eq('subdomain', cleanSlug)
            .maybeSingle();
          if (profileSlugError && profileSlugError.code !== 'PGRST116') {
            console.warn('[StoreSlugCustomPageRoute] Profile slug lookup error (non-fatal):', profileSlugError);
          }
          if (profileSlugMatch?.id) {
            setStoreType('seller');
            setStoreId(profileSlugMatch.id);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }

        setStoreType(null);
        setStoreId(null);
        setLoading(false);
      } catch (error) {
        console.error('[StoreSlugCustomPageRoute] Unexpected error:', error);
        setStoreType(null);
        setStoreId(null);
        setLoading(false);
      }
    };

    void loadStore();
  }, [storeSlug, pageSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-600">Loading page...</p>
        </div>
      </div>
    );
  }

  if (!storeSlug || !pageSlug || !storeType || !storeId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const backPath = (() => {
    if (!normalizedSlug) return '/';
    if (location.pathname.startsWith('/store/')) return `/store/${normalizedSlug}`;
    if (location.pathname.startsWith('/partner/')) return `/store/${normalizedSlug}`;
    return `/${normalizedSlug}`;
  })();

  return (
    <StoreCustomPageView
      ownerId={storeId}
      ownerType={storeType}
      pageSlug={pageSlug}
      backPath={backPath}
    />
  );
};

export default StoreSlugCustomPageRoute;
