import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import EnhancedBuyerDashboard, { type BuyerDashboardTab } from '../components/EnhancedBuyerDashboard';
import StorefrontBuyerShell from '../components/storefront/StorefrontBuyerShell';
import { loadStorefrontBranding, readStoredStorefrontScope, setPostAuthPath, type StorefrontBranding } from '../utils/storefrontScope';

const fallbackBranding: StorefrontBranding = {
  kind: 'generic',
  name: 'Your Account',
  tagline: 'Orders, receipts, and support in one place.',
  logoUrl: null,
  backgroundImageUrl: null,
  homePath: '/',
};

const allowedTabs = new Set<BuyerDashboardTab>(['overview', 'orders', 'purchases', 'wishlist', 'recommendations', 'affiliates', 'watchlist', 'community', 'support']);

const StorefrontBuyerAccountPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [branding, setBranding] = useState<StorefrontBranding>(fallbackBranding);

  useEffect(() => {
    const scope = readStoredStorefrontScope();
    loadStorefrontBranding(scope).then((next) => setBranding(next));
  }, []);

  const activeTab = useMemo<BuyerDashboardTab>(() => {
    const raw = String(new URLSearchParams(location.search).get('tab') || 'overview').toLowerCase() as BuyerDashboardTab;
    return allowedTabs.has(raw) ? raw : 'overview';
  }, [location.search]);

  if (!user) {
    return (
      <StorefrontBuyerShell branding={branding}>
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Customer Account</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Sign in to view your orders</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Your customer account works across every storefront. Sign in once to review receipts, track orders, and contact sellers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/account/login"
              onClick={() => setPostAuthPath('/account')}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Customer Login
            </Link>
            <Link
              to="/account/signup"
              onClick={() => setPostAuthPath('/account')}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Create Account
            </Link>
            <Link
              to={branding.homePath}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </StorefrontBuyerShell>
    );
  }

  return (
    <StorefrontBuyerShell branding={branding}>
      <EnhancedBuyerDashboard
        activeTabOverride={activeTab}
        title="Customer Account"
        subtitle="Review orders, receipts, and seller messages."
      />
    </StorefrontBuyerShell>
  );
};

export default StorefrontBuyerAccountPage;
