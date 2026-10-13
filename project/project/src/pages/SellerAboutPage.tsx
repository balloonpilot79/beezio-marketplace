import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ExternalLink, Store } from 'lucide-react';
import { resolveHouseBrandIdentity } from '../../shared/houseBrandIdentity';

interface SellerAboutPageProps {
  sellerId?: string;
  isCustomDomain?: boolean;
  storeSlug?: string;
}

const SellerAboutPage: React.FC<SellerAboutPageProps> = ({ sellerId: propSellerId, isCustomDomain = false, storeSlug }) => {
  const { sellerId: paramSellerId } = useParams<{ sellerId: string }>();
  const sellerId = propSellerId || paramSellerId;
  const [seller, setSeller] = useState<any>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedSellerId, setResolvedSellerId] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        let lookupId = sellerId;
        let storeSettingsData: any | null = null;

        const { data: slugMatch } = await supabase
          .from('store_settings')
          .select('*')
          .eq('subdomain', lookupId)
          .maybeSingle();
        if (slugMatch?.seller_id) {
          lookupId = slugMatch.seller_id;
          storeSettingsData = slugMatch;
        }

        const { data: sellerData } = await supabase
          .from('profile_directory')
          .select('*')
          .or(`id.eq.${lookupId},user_id.eq.${lookupId}`)
          .maybeSingle();

        if (!storeSettingsData && lookupId) {
          const { data: settingsBySeller } = await supabase
            .from('store_settings')
            .select('*')
            .eq('seller_id', lookupId)
            .maybeSingle();
          if (settingsBySeller) {
            storeSettingsData = settingsBySeller;
          }
        }

        const canonicalId = sellerData?.id || storeSettingsData?.seller_id || lookupId;
        setResolvedSellerId(canonicalId || null);

        if (sellerData) {
          setSeller(sellerData);
        } else if (storeSettingsData) {
          setSeller({
            id: canonicalId,
            full_name: storeSettingsData.store_name || 'Store',
            bio: storeSettingsData.store_description || '',
            store_logo: storeSettingsData.store_logo,
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain
          });
        } else {
          setSeller(null);
        }

        setStoreSettings(storeSettingsData || null);
      } catch (error) {
        console.error('[SellerAboutPage] Error loading store:', error);
        setSeller(null);
        setStoreSettings(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sellerId]);

  const normalizedSlug = storeSlug?.trim() ? storeSlug.trim() : '';
  const storeRouteId = normalizedSlug || storeSettings?.subdomain || resolvedSellerId || sellerId || '';

  useEffect(() => {
    if (!storeRouteId) return;
    const scopeKey = `store:seller:${storeRouteId}`;
    localStorage.setItem('beezio-store-scope', scopeKey);
    window.dispatchEvent(new Event('beezio-store-scope-changed'));
  }, [storeRouteId]);

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

  if (!seller) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h2>
          <p className="text-gray-600">The store you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const storeName = storeSettings?.store_name || seller.full_name || 'Store';
  const brand = resolveHouseBrandIdentity(storeRouteId, storeSettings?.theme_settings?.brand_personality);
  const brandBackground = brand ? (brand.slug === 'marebelle' ? '#e8dfcd' : '#f8fafc') : (storeSettings?.color_scheme?.background || '#f8fafc');
  const accentColor = brand?.accentColor || storeSettings?.color_scheme?.accent || '#64748b';
  const headerColor = brand ? '#070707' : '#ffffff';
  const headerText = brand ? '#ffffff' : '#0f172a';
  const logoUrl = storeSettings?.store_logo || brand?.logoUrl;
  const aboutCopy = storeSettings?.store_description || seller.bio || 'This store is building its story.';
  const storeHomePath = isCustomDomain
    ? '/'
    : normalizedSlug
      ? `/store/${normalizedSlug}`
      : `/store/${encodeURIComponent(String(storeRouteId))}`;
  const aboutPath = isCustomDomain
    ? '/about'
    : normalizedSlug
      ? `/store/${normalizedSlug}/about`
      : `/store/${encodeURIComponent(String(storeRouteId))}/about`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: brandBackground }}>
      <header className="sticky top-0 z-40 backdrop-blur border-b" style={{ backgroundColor: headerColor, borderColor: accentColor }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <Link to={storeHomePath} className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${storeName} logo`}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
                {storeName.charAt(0)}
              </div>
            )}
            <div>
              {brand?.headerLabel && <div className="text-xs uppercase tracking-wide" style={{ color: accentColor }}>{brand.headerLabel}</div>}
              <div className="text-lg font-semibold" style={{ color: headerText }}>{storeName}</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold" style={{ color: headerText }}>
            <Link to={storeHomePath} className="transition-opacity hover:opacity-80" style={{ color: headerText }}>
              Products
            </Link>
            <Link to={aboutPath} className="transition-opacity hover:opacity-80" style={{ color: headerText }}>
              About
            </Link>
          </nav>

          {!isCustomDomain && (
            <Link
              to={storeHomePath}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-semibold"
              style={{ color: headerText, borderColor: accentColor }}
            >
              <Store className="w-4 h-4" />
              Back to Store
            </Link>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-2xl border shadow-sm p-8" style={{ backgroundColor: brand ? '#faf7f1' : '#ffffff', borderColor: accentColor }}>
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: accentColor }}>
            About the store
          </div>
          <h1 className={`text-3xl font-bold text-slate-900 mb-4 ${brand ? 'font-serif' : ''}`}>{storeName}</h1>
          <p className="text-slate-600 text-lg leading-relaxed">{aboutCopy}</p>

          {storeSettings?.custom_domain && (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <ExternalLink className="w-4 h-4" />
              <span>{storeSettings.custom_domain}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SellerAboutPage;
