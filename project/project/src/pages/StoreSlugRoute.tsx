import React, { Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getStoreSlugLookupCandidates, normalizeStoreSlug } from '../utils/normalizeStoreSlug';

const SellerStorePage = React.lazy(() => import('./SellerStorePage'));
const AffiliateStorePage = React.lazy(() => import('./AffiliateStorePage'));
const SellerAboutPage = React.lazy(() => import('./SellerAboutPage'));
const AffiliateAboutPage = React.lazy(() => import('./AffiliateAboutPage'));

type StoreSlugRouteMode = 'store' | 'about';

interface StoreSlugRouteProps {
  mode?: StoreSlugRouteMode;
}

const StoreSlugRoute: React.FC<StoreSlugRouteProps> = ({ mode = 'store' }) => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [storeType, setStoreType] = useState<'seller' | 'affiliate' | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeoutRetryCount, setTimeoutRetryCount] = useState(0);

  const isUuid = (value: string | undefined | null) =>
    Boolean(String(value || '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

  const normalizedSlug = normalizeStoreSlug(storeSlug);

  const isTimeoutError = (error: unknown) => String((error as any)?.message || '').toLowerCase().includes('timed out');

  const isIgnorableLookupError = (error: unknown) => {
    if (!error) return true;
    const code = String((error as any)?.code || '').trim().toUpperCase();
    if (code === 'PGRST116') return true;
    const message = String((error as any)?.message || '').toLowerCase();
    return (
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      message.includes('could not find the')
    );
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const resolveViaPublicApi = async (cleanSlug: string): Promise<'resolved' | 'not-found' | 'unavailable'> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(`/api/public/store/resolve?slug=${encodeURIComponent(cleanSlug)}&_ts=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (resp.status === 404) return 'not-found';
      if (!resp.ok) return 'unavailable';
      const payload: any = await resp.json().catch(() => ({}));
      const resolvedType = String(payload?.store_type || '').trim();
      const resolvedId = String(payload?.store_id || '').trim();
      if ((resolvedType === 'seller' || resolvedType === 'affiliate') && resolvedId) {
        setStoreType(resolvedType);
        setStoreId(resolvedId);
        setLoadError(null);
        setLoading(false);
        return 'resolved';
      }
    } catch (error) {
      console.warn('[StoreSlugRoute] Public resolver unavailable, falling back:', error);
    } finally {
      window.clearTimeout(timeout);
    }
    return 'unavailable';
  };

  const chooseStoreForSharedSlug = async (sellerId?: string | null, affiliateId?: string | null) => {
    const cleanSellerId = String(sellerId || '').trim();
    const cleanAffiliateId = String(affiliateId || '').trim();

    if (cleanSellerId) return { type: 'seller' as const, id: cleanSellerId };
    if (cleanAffiliateId) return { type: 'affiliate' as const, id: cleanAffiliateId };
    return null;
  };

  const loadSlugMatches = async (cleanSlug: string, useTimeout: boolean) => {
    const slugCandidates = getStoreSlugLookupCandidates(cleanSlug);
    const sellerQuery = supabase
      .from('store_settings')
      .select('seller_id')
      .in('subdomain', slugCandidates)
      .maybeSingle();
    const affiliateQuery = supabase
      .from('affiliate_store_settings')
      .select('affiliate_id')
      .in('subdomain', slugCandidates)
      .maybeSingle();

    const [sellerLookup, affiliateLookup] = await Promise.allSettled([
      useTimeout ? withTimeout(sellerQuery, 8000, 'Seller slug lookup') : sellerQuery,
      useTimeout ? withTimeout(affiliateQuery, 8000, 'Affiliate slug lookup') : affiliateQuery,
    ]);

    const sellerResult = sellerLookup.status === 'fulfilled' ? sellerLookup.value : { data: null, error: sellerLookup.reason };
    const affiliateResult = affiliateLookup.status === 'fulfilled' ? affiliateLookup.value : { data: null, error: affiliateLookup.reason };

    return {
      sellerMatch: sellerResult.data,
      affiliateMatch: affiliateResult.data,
      sellerError: sellerResult.error,
      affiliateError: affiliateResult.error,
    };
  };

  useEffect(() => {
    if (!storeSlug) {
      setLoading(false);
      setStoreType(null);
      setStoreId(null);
      setTimeoutRetryCount(0);
      return;
    }

    const loadStore = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const cleanSlug = normalizeStoreSlug(storeSlug);

        const publicResolution = await resolveViaPublicApi(cleanSlug);
        if (publicResolution === 'resolved') {
          return;
        }
        if (publicResolution === 'not-found') {
          setStoreType(null);
          setStoreId(null);
          setLoading(false);
          return;
        }

        if (isUuid(cleanSlug)) {
          const [{ data: sellerProfile }, { data: affiliateSettings }, { data: affiliateProfile }] = await Promise.all([
            supabase
              .from('profiles')
              .select('id, role, primary_role')
              .or(`id.eq.${cleanSlug},user_id.eq.${cleanSlug}`)
              .maybeSingle(),
            supabase
              .from('affiliate_store_settings')
              .select('affiliate_id')
              .eq('affiliate_id', cleanSlug)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('id, role, primary_role')
              .or(`id.eq.${cleanSlug},user_id.eq.${cleanSlug}`)
              .maybeSingle(),
          ]);

          const sellerRole = String((sellerProfile as any)?.primary_role || (sellerProfile as any)?.role || '').trim().toLowerCase();
          const affiliateRole = String((affiliateProfile as any)?.primary_role || (affiliateProfile as any)?.role || '').trim().toLowerCase();

          if (affiliateSettings?.affiliate_id || affiliateRole === 'affiliate') {
            setStoreType('affiliate');
            setStoreId(cleanSlug);
            setLoadError(null);
            setLoading(false);
            return;
          }

          if ((sellerProfile as any)?.id) {
            setStoreType('seller');
            setStoreId(cleanSlug);
            setLoadError(null);
            setLoading(false);
            return;
          }
        }

        // Multi-brand storefronts (for example RedTail) live in the storefronts
        // table instead of the legacy seller/affiliate settings tables.
        try {
          const { data: brandStorefront, error: brandStorefrontError } = await withTimeout(
            supabase
              .from('storefronts')
              .select('owner_id')
              .eq('slug', cleanSlug)
              .eq('is_active', true)
              .maybeSingle(),
            5000,
            'Brand storefront slug lookup'
          );
          if (!isIgnorableLookupError(brandStorefrontError)) {
            console.warn('[StoreSlugRoute] Brand storefront slug lookup error (non-fatal):', brandStorefrontError);
          }
          if (brandStorefront?.owner_id) {
            setStoreType('seller');
            setStoreId(String(brandStorefront.owner_id));
            setLoadError(null);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.warn('[StoreSlugRoute] Brand storefront lookup unavailable, using legacy fallbacks:', error);
        }

        let { sellerMatch, affiliateMatch, sellerError, affiliateError } = await loadSlugMatches(cleanSlug, true);

        if ((!sellerMatch && isTimeoutError(sellerError)) || (!affiliateMatch && isTimeoutError(affiliateError))) {
          const retried = await loadSlugMatches(cleanSlug, false);
          sellerMatch = retried.sellerMatch || sellerMatch;
          affiliateMatch = retried.affiliateMatch || affiliateMatch;
          sellerError = retried.sellerError;
          affiliateError = retried.affiliateError;
        }

        if (!isIgnorableLookupError(sellerError)) {
          console.warn('[StoreSlugRoute] Seller slug lookup error:', sellerError);
        }
        if (!isIgnorableLookupError(affiliateError)) {
          console.warn('[StoreSlugRoute] Affiliate slug lookup error:', affiliateError);
        }

        const matchedStore = await chooseStoreForSharedSlug(sellerMatch?.seller_id, affiliateMatch?.affiliate_id);
        if (matchedStore) {
          setStoreType(matchedStore.type);
          setStoreId(matchedStore.id);
          setLoadError(null);
          setLoading(false);
          return;
        }

        // Fallback: some deployments store the slug directly on profiles.
        try {
          const { data: profileSlugMatch, error: profileSlugError } = await withTimeout(
            supabase
              .from('profiles')
              .select('id')
              .eq('subdomain', cleanSlug)
              .maybeSingle(),
            5000,
            'Profile slug lookup'
          );
          if (!isIgnorableLookupError(profileSlugError)) {
            console.warn('[StoreSlugRoute] Profile slug lookup error (non-fatal):', profileSlugError);
          }
          if (profileSlugMatch?.id) {
            setStoreType('seller');
            setStoreId(profileSlugMatch.id);
            setLoadError(null);
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
        console.error('[StoreSlugRoute] Unexpected error:', error);
        setLoadError('We could not load this store yet. Please try again.');
        setStoreType(null);
        setStoreId(null);
        setLoading(false);
      }
    };

    void loadStore();
  }, [storeSlug, timeoutRetryCount]);

  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (timeoutRetryCount < 1) {
        setTimeoutRetryCount((prev) => prev + 1);
        setLoadError(null);
        return;
      }
      setLoadError('This store is taking too long to load. Please refresh or try again.');
      setStoreType(null);
      setStoreId(null);
      setLoading(false);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [loading, timeoutRetryCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store unavailable</h2>
          <p className="text-gray-600">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              setLoading(true);
              setTimeoutRetryCount(0);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!storeType || !storeId || !storeSlug) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h2>
          <p className="text-gray-600">The store you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const displaySlug = normalizedSlug;

  if (storeType === 'seller') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        {mode === 'about'
          ? <SellerAboutPage sellerId={storeId} storeSlug={displaySlug} />
          : <SellerStorePage sellerId={storeId} storeSlug={displaySlug} />}
      </Suspense>
    );
  }

  if (storeType === 'affiliate') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        {mode === 'about'
          ? <AffiliateAboutPage affiliateId={storeId} storeSlug={displaySlug} />
          : <AffiliateStorePage affiliateId={storeId} storeSlug={displaySlug} />}
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h2>
        <p className="text-gray-600">The store you're looking for doesn't exist.</p>
      </div>
    </div>
  );
};

export default StoreSlugRoute;
