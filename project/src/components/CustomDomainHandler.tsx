import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { checkCustomDomain, DomainRouteResult } from '../utils/customDomainRouter';
import SellerStorePage from '../pages/SellerStorePage';
import AffiliateStorePage from '../pages/AffiliateStorePage';

/**
 * Custom Domain Handler Component
 * Detects if visitor is arriving via custom domain and routes to correct store
 */
const CustomDomainHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [domainResult, setDomainResult] = useState<DomainRouteResult | null>(null);

  useEffect(() => {
    const checkDomain = async () => {
      const result = await checkCustomDomain();
      setDomainResult(result);
      setChecking(false);
    };

    checkDomain();
  }, []);

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

  // If custom domain detected, show the store directly
  if (domainResult?.isCustomDomain && domainResult.userId) {
    console.log('[CustomDomain] Rendering store for custom domain');
    
    if (domainResult.storeType === 'seller') {
      return <SellerStorePage sellerId={domainResult.userId} isCustomDomain={true} />;
    } else if (domainResult.storeType === 'affiliate') {
      return <AffiliateStorePage affiliateId={domainResult.userId} isCustomDomain={true} />;
    }
  }

  // Normal routing for beezio.co and localhost
  return <>{children}</>;
};

export default CustomDomainHandler;
