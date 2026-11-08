import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { loadStorefrontBranding, readStoredStorefrontScope, type StorefrontBranding } from '../../utils/storefrontScope';
import CompactStoreHeader from './CompactStoreHeader';
import StorefrontShoppingLinks from './StorefrontShoppingLinks';
import { StorefrontSignature } from '../brand/BeezioBrand';

const ShoppingBrandContext = createContext<StorefrontBranding | null>(null);
export const useShoppingBrand = () => useContext(ShoppingBrandContext);
export default function StorefrontShoppingPage({ children }: { children: ReactNode }) {
  const [scope] = useState(readStoredStorefrontScope);
  const { items } = useCart();
  const [storeBrand, setStoreBrand] = useState<StorefrontBranding | null>(null);
  const [platformBrand, setPlatformBrand] = useState<StorefrontBranding | null>(null);
  useEffect(() => {
    let active = true;
    if (scope) {
      void loadStorefrontBranding(scope).then(value => { if (active) setStoreBrand(value); });
      void loadStorefrontBranding(null).then(value => { if (active) setPlatformBrand(value); });
    }
    return () => { active = false; };
  }, [scope]);
  if (!scope) return <>{children}</>;
  // A previously visited storefront can outlive its cart. Only use its
  // branding when every line can be tied to that storefront.
  const matchesStore = items.length > 0 && items.every(item => (
    storeBrand?.kind === 'seller'
      ? storeBrand.productIds?.has(item.productId)
      : item.storefrontScope === scope.raw && Boolean(item.affiliateId && storeBrand?.affiliateIds?.has(item.affiliateId))
  ));
  const branding = matchesStore ? storeBrand : platformBrand;
  if (!branding) return <div className="min-h-screen bg-[#faf9f5] p-8" role="status">Loading your store…</div>;
  return <ShoppingBrandContext.Provider value={branding}>
    <div className="min-h-screen" style={{ backgroundColor: branding.backgroundColor || '#faf9f5' }}>
      <CompactStoreHeader name={branding.name} logoUrl={branding.logoUrl} homePath={branding.homePath} inverse={branding.inverseHeader} accentColor={branding.accentColor} label="Shop & checkout" productHref={branding.homePath} />
      <header className="hidden lg:block border-b px-6 py-4" style={{ backgroundColor: branding.inverseHeader ? '#070707' : '#fff', borderColor: branding.accentColor }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to={branding.homePath} className="flex items-center gap-3" style={{ color: branding.inverseHeader ? '#fff' : '#101820' }}>
            {branding.logoUrl && <img src={branding.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain" />}
            <span className="font-serif text-2xl font-semibold">{branding.name}</span>
          </Link>
          <StorefrontShoppingLinks inverse={branding.inverseHeader} />
        </div>
      </header>
      {children}
      <StorefrontSignature />
    </div>
  </ShoppingBrandContext.Provider>;
}
