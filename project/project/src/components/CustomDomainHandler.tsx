import React, { Suspense, useEffect, useState } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { checkCustomDomain, DomainRouteResult } from '../utils/customDomainRouter';

const SellerStorePage = React.lazy(() => import('../pages/SellerStorePage'));
const AffiliateStorePage = React.lazy(() => import('../pages/AffiliateStorePage'));
const SellerAboutPage = React.lazy(() => import('../pages/SellerAboutPage'));
const AffiliateAboutPage = React.lazy(() => import('../pages/AffiliateAboutPage'));
const CartPage = React.lazy(() => import('../pages/CartPage'));
const CheckoutPage = React.lazy(() => import('../pages/CheckoutPage'));
const CheckoutSuccessPage = React.lazy(() => import('../pages/CheckoutSuccessPage'));
const CheckoutCancelPage = React.lazy(() => import('../pages/CheckoutCancelPage'));
const ProductDetailPage = React.lazy(() => import('../pages/ProductDetailPage'));
const StoreCustomPageView = React.lazy(() => import('../pages/StoreCustomPageView'));

/**
 * Custom Domain Handler Component
 * Detects if visitor is arriving via custom domain and routes to correct store
 */
const CustomDomainHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [domainResult, setDomainResult] = useState<DomainRouteResult | null>(null);

  const CustomDomainPageRoute: React.FC<{ ownerId: string; ownerType: 'seller' | 'affiliate' }> = ({ ownerId, ownerType }) => {
    const { pageSlug } = useParams<{ pageSlug: string }>();
    if (!pageSlug) return null;
    return (
      <Suspense fallback={<div className="min-h-screen" />}>
        <StoreCustomPageView
          ownerId={ownerId}
          ownerType={ownerType}
          pageSlug={pageSlug}
          backPath="/"
        />
      </Suspense>
    );
  };

  useEffect(() => {
    const checkDomain = async () => {
      const result = await checkCustomDomain();
      setDomainResult(result);
      setChecking(false);
    };

    checkDomain();
  }, []);

  useEffect(() => {
    if (domainResult?.isCustomDomain && domainResult.userId && domainResult.storeType) {
      const scopeId = domainResult.storeSettings?.subdomain || domainResult.userId;
      const scopeKey = `store:${domainResult.storeType}:${scopeId}`;
      localStorage.setItem('beezio-store-scope', scopeKey);
      window.dispatchEvent(new Event('beezio-store-scope-changed'));
    }
  }, [domainResult]);

  // Show loading while checking
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  // If custom domain detected, show the store directly (NO header/footer)
  if (domainResult?.isCustomDomain && domainResult.userId) {
    console.log('[CustomDomain] Rendering standalone store for custom domain');

    const storeType = domainResult.storeType;
    const storePage =
      storeType === 'seller'
        ? <SellerStorePage sellerId={domainResult.userId} isCustomDomain={true} />
        : <AffiliateStorePage affiliateId={domainResult.userId} isCustomDomain={true} />;
    const aboutPage =
      storeType === 'seller'
        ? <SellerAboutPage sellerId={domainResult.userId} isCustomDomain={true} />
        : <AffiliateAboutPage affiliateId={domainResult.userId} isCustomDomain={true} />;

    return (
      <div className="min-h-screen">
        <Suspense fallback={<div className="min-h-screen" />}>
          <Routes>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
            <Route path="/about" element={aboutPage} />
            <Route path="/product/:productId" element={<ProductDetailPage />} />
            {storeType && (
              <Route
                path="/:pageSlug"
                element={<CustomDomainPageRoute ownerId={domainResult.userId} ownerType={storeType} />}
              />
            )}
            <Route path="*" element={storePage} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  // Normal routing for beezio.co and localhost
  return <>{children}</>;
};

export default CustomDomainHandler;
