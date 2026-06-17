import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { canAccessCJImport } from '../utils/cjImportAccess';
import { copyTextToClipboard } from '../utils/clipboard';
import { getInfluencerPublicCode } from '../utils/promoLinks';
import { supabase } from '../lib/supabase';
import {
  AlertTriangle,
  Copy,
  Link as LinkIcon,
  Truck,
} from 'lucide-react';
import EnhancedSellerDashboard, { type SellerDashboardTab } from './EnhancedSellerDashboard';
import EnhancedBuyerDashboard, { type BuyerDashboardTab } from './EnhancedBuyerDashboard';
import PlatformAdminDashboard from './PlatformAdminDashboard';

interface UnifiedDashboardProps {
  initialSellerTab?: SellerDashboardTab;
  initialSection?: 'buyer' | 'seller' | 'affiliate' | 'influencer' | 'admin';
}

type DashboardSection = 'buyer' | 'seller' | 'affiliate' | 'influencer' | 'admin';
type BusinessDashboardSection = Extract<DashboardSection, 'seller' | 'affiliate' | 'influencer'>;

type SellerFulfillmentAlert = {
  needsOrdering: number;
  total: number;
};

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ initialSellerTab, initialSection }) => {
  const { user, profile, userRoles, currentRole, addRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const normalizedProfileRole = String(profile?.primary_role || profile?.role || '').toLowerCase();
  const normalizedUserRoles = (userRoles || []).map((role) => String(role || '').toLowerCase());
  const isAdminUser = Boolean(
    normalizedUserRoles.includes('admin') ||
    normalizedProfileRole === 'admin' ||
    canAccessCJImport(user?.email)
  );

  const effectiveRoles = useMemo(() => {
    const activeRoles = new Set<string>();
    const normalizedCurrentRole = String(currentRole || '').toLowerCase();
    if (normalizedCurrentRole) activeRoles.add(normalizedCurrentRole);
    if (normalizedProfileRole) activeRoles.add(normalizedProfileRole);
    normalizedUserRoles.forEach((role) => activeRoles.add(role));
    if (activeRoles.has('partner')) {
      activeRoles.delete('partner');
      activeRoles.add('affiliate');
    }
    if (isAdminUser) activeRoles.add('admin');
    return Array.from(activeRoles);
  }, [currentRole, isAdminUser, normalizedProfileRole, normalizedUserRoles]);

  const visibleRoles = useMemo<DashboardSection[]>(() => {
    const roles = new Set<DashboardSection>(['buyer']);
    if (effectiveRoles.includes('seller')) roles.add('seller');
    if (effectiveRoles.includes('affiliate')) roles.add('affiliate');
    if (effectiveRoles.includes('influencer')) roles.add('influencer');
    if (isAdminUser) {
      roles.add('seller');
      roles.add('affiliate');
      roles.add('influencer');
      roles.add('admin');
    }
    return Array.from(roles);
  }, [effectiveRoles, isAdminUser]);

  const hasBusinessSectionAccess = (section: string): section is BusinessDashboardSection => {
    if (section !== 'seller' && section !== 'affiliate' && section !== 'influencer') return false;
    return isAdminUser || effectiveRoles.includes(section);
  };

  const firstBusinessSection = useMemo<BusinessDashboardSection | null>(() => {
    if (visibleRoles.includes('seller')) return 'seller';
    if (visibleRoles.includes('affiliate')) return 'affiliate';
    if (visibleRoles.includes('influencer')) return 'influencer';
    return null;
  }, [visibleRoles]);

  const defaultSection = useMemo<DashboardSection>(() => {
    if (initialSection === 'buyer') return 'buyer';
    if (initialSection === 'admin' && visibleRoles.includes('admin')) return 'admin';
    if (initialSection && hasBusinessSectionAccess(initialSection)) return 'seller';
    if (firstBusinessSection) return 'seller';
    return 'buyer';
  }, [firstBusinessSection, initialSection, visibleRoles]);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedSection = String(searchParams.get('section') || '').toLowerCase();
  const requestedBusinessSection = hasBusinessSectionAccess(requestedSection) ? requestedSection : null;
  const isUnauthorizedBusinessSectionRequest =
    requestedSection === 'seller' || requestedSection === 'affiliate' || requestedSection === 'influencer';
  const isFallbackBusinessHydration =
    Boolean(user) &&
    Boolean((profile as any)?.__is_fallback) &&
    isUnauthorizedBusinessSectionRequest;
  const businessSectionForShell = requestedBusinessSection || firstBusinessSection;
  const activeSection: DashboardSection =
    requestedSection === 'buyer'
      ? 'buyer'
      : requestedSection === 'admin' && visibleRoles.includes('admin')
      ? 'admin'
      : isFallbackBusinessHydration
      ? 'seller'
      : isUnauthorizedBusinessSectionRequest && !requestedBusinessSection
      ? 'buyer'
      : requestedBusinessSection
      ? 'seller'
      : defaultSection;

  const requestedTab = String(searchParams.get('tab') || '').toLowerCase();

  const [sellerTab, setSellerTab] = useState<SellerDashboardTab>(initialSellerTab || 'products');
  const [buyerTab, setBuyerTab] = useState<BuyerDashboardTab>('overview');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [sellerFulfillmentAlert, setSellerFulfillmentAlert] = useState<SellerFulfillmentAlert | null>(null);
  const [sellerFulfillmentAlertDismissed, setSellerFulfillmentAlertDismissed] = useState(false);
  const [recruiterStoreSlug, setRecruiterStoreSlug] = useState('');
  const [recruiterStoreName, setRecruiterStoreName] = useState('');

  const sellerTabList: SellerDashboardTab[] = [
    'products',
    'orders',
    'financials',
    'links',
    'single-product',
    'influencer-promo',
    'bulk-upload',
    'customers',
    'analytics',
    'integrations',
    'store-customization',
    'messages',
    'support'
  ];
  const buyerTabList: BuyerDashboardTab[] = [
    'overview',
    'orders',
    'purchases',
    'wishlist',
    'recommendations',
    'affiliates',
    'watchlist',
    'community',
    'support',
  ];
  useEffect(() => {
    if (activeSection === 'buyer') {
      if (!buyerTabList.includes(requestedTab as BuyerDashboardTab)) {
        setBuyerTab('overview');
        return;
      }
      setBuyerTab(requestedTab as BuyerDashboardTab);
      return;
    }
    if (initialSellerTab && !requestedTab) {
      setSellerTab(initialSellerTab);
      return;
    }
    if (activeSection !== 'seller') return;
    if (requestedTab === 'fulfillment' || requestedTab === 'orders') {
      setSellerTab('orders');
      return;
    }
    if (requestedTab === 'overview') {
      setSellerTab('products');
      return;
    }
    if (requestedTab === 'earnings' || requestedTab === 'payouts') {
      setSellerTab('financials');
      return;
    }
    if (!sellerTabList.includes(requestedTab as SellerDashboardTab)) return;
    setSellerTab(requestedTab as SellerDashboardTab);
  }, [activeSection, initialSellerTab, requestedTab]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (activeSection === 'admin') return;
    if (activeSection !== 'buyer' && !effectiveRoles.includes(activeSection)) {
      return;
    }
    if (activeSection === 'buyer' && !effectiveRoles.includes('buyer')) {
      void addRole('buyer');
    }
  }, [activeSection, addRole, authLoading, effectiveRoles, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (visibleRoles.length > 0) return;
    navigate('/marketplace', { replace: true });
  }, [authLoading, navigate, user, visibleRoles.length]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (authLoading || isFallbackBusinessHydration) return;
    if (!requestedSection || activeSection === requestedSection) return;
    const requestedBusiness =
      requestedSection === 'seller' || requestedSection === 'affiliate' || requestedSection === 'influencer';
    if (requestedBusiness && !requestedBusinessSection) {
      navigate('/dashboard?section=buyer&tab=orders', { replace: true });
      return;
    }
    if (activeSection === 'buyer') {
      navigate(`/dashboard?section=buyer${requestedTab ? `&tab=${encodeURIComponent(requestedTab)}` : ''}`, { replace: true });
      return;
    }
    if (activeSection === 'seller' && businessSectionForShell) {
      navigate(`/dashboard?section=${businessSectionForShell}${requestedTab ? `&tab=${encodeURIComponent(requestedTab)}` : ''}`, { replace: true });
    }
  }, [activeSection, authLoading, businessSectionForShell, isFallbackBusinessHydration, navigate, requestedBusinessSection, requestedSection, requestedTab]);

  useEffect(() => {
    if (!user || !visibleRoles.includes('seller')) {
      setSellerFulfillmentAlert(null);
      setSellerFulfillmentAlertDismissed(false);
      return;
    }

    let cancelled = false;

    const loadSellerFulfillmentAlert = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const response = await fetch('/.netlify/functions/manual-fulfillment-queue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'list', scope: 'seller' }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;

        const needsOrdering = Number((payload as any)?.summary?.needsOrdering || 0);
        const total = Number((payload as any)?.summary?.total || 0);
        if (cancelled) return;

        if (needsOrdering > 0) {
          setSellerFulfillmentAlert({ needsOrdering, total });
          try {
            const dismissalKey = `beezio_seller_fulfillment_alert_${user.id}_${needsOrdering}`;
            setSellerFulfillmentAlertDismissed(sessionStorage.getItem(dismissalKey) === 'dismissed');
          } catch {
            setSellerFulfillmentAlertDismissed(false);
          }
          return;
        }

        setSellerFulfillmentAlert(null);
        setSellerFulfillmentAlertDismissed(false);
      } catch {
        if (!cancelled) {
          setSellerFulfillmentAlert(null);
        }
      }
    };

    void loadSellerFulfillmentAlert();

    return () => {
      cancelled = true;
    };
  }, [user, visibleRoles]);

  useEffect(() => {
    let cancelled = false;

    const loadRecruiterStoreIdentity = async () => {
      const profileId = String((profile as any)?.id || '').trim();
      if (!profileId) {
        if (!cancelled) {
          setRecruiterStoreSlug('');
          setRecruiterStoreName('');
        }
        return;
      }

      try {
        const [affiliateStoreRes, affiliateSettingsRes] = await Promise.all([
          supabase
            .from('affiliate_stores')
            .select('store_slug, store_name')
            .eq('profile_id', profileId)
            .maybeSingle(),
          supabase
            .from('affiliate_store_settings')
            .select('subdomain, store_name')
            .eq('affiliate_id', profileId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const resolvedSlug = String(
          (affiliateStoreRes.data as any)?.store_slug ||
          (affiliateSettingsRes.data as any)?.subdomain ||
          (profile as any)?.store_slug ||
          (profile as any)?.subdomain ||
          ''
        ).trim();
        const resolvedName = String(
          (affiliateStoreRes.data as any)?.store_name ||
          (affiliateSettingsRes.data as any)?.store_name ||
          ''
        ).trim();

        setRecruiterStoreSlug(resolvedSlug);
        setRecruiterStoreName(resolvedName);
      } catch {
        if (!cancelled) {
          setRecruiterStoreSlug(String((profile as any)?.store_slug || (profile as any)?.subdomain || '').trim());
          setRecruiterStoreName('');
        }
      }
    };

    void loadRecruiterStoreIdentity();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const recruiterCode = useMemo(() => {
    return getInfluencerPublicCode({
      username: (profile as any)?.username,
      storeSlug: recruiterStoreSlug || (profile as any)?.store_slug || (profile as any)?.subdomain || (profile as any)?.slug,
      storeName: recruiterStoreName,
      referralCode: (profile as any)?.referral_code,
      profileId: (profile as any)?.id,
    });
  }, [profile, recruiterStoreName, recruiterStoreSlug]);

  const recruiterInviteLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (!recruiterCode) return '';
    return `${window.location.origin}/i/${encodeURIComponent(recruiterCode)}`;
  }, [recruiterCode]);

  const sellerDashboardCopy = useMemo(() => {
    if (sellerTab === 'single-product') {
      return {
        title: 'Single Product Promo Studio',
        description: 'Pick one seller or affiliate product and promote it with direct links, landing pages, QR codes, social copy, email, SMS, posters, scripts, and embeds.',
      };
    }
    if (sellerTab === 'influencer-promo') {
      return {
        title: 'Recruit Sellers and Affiliates',
        description: 'Use your direct seller and affiliate signup links to recruit under your influencer code. Financial totals are kept in the Financials tab.',
      };
    }
    if (sellerTab === 'financials') {
      return {
        title: 'Financials',
        description: 'Track seller sales, affiliate sales, influencer payments, held funds, available payout amounts, and the next Beezio payday.',
      };
    }
    if (businessSectionForShell === 'affiliate') {
      return {
        title: 'Affiliate Account',
        description: 'See the sales you drove, what you earned, and what to promote next.',
      };
    }
    if (businessSectionForShell === 'influencer') {
      return {
        title: 'Influencer Account',
        description: 'Track recruited sales activity, progress over time, and the links driving your network.',
      };
    }
    return {
      title: 'Seller Account',
      description: 'See your business account summary, seller activity, payouts, and next actions in one place.',
    };
  }, [businessSectionForShell, sellerTab]);

  const showRecruiterInviteBar = Boolean(
    recruiterInviteLink &&
      activeSection === 'seller' &&
      sellerTab !== 'influencer-promo' &&
      sellerTab !== 'single-product'
  );

  const handleCopyInviteLink = async () => {
    if (!recruiterInviteLink) return;
    const copied = await copyTextToClipboard(recruiterInviteLink);
    if (copied) {
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1500);
    }
  };

  const dismissSellerFulfillmentAlert = () => {
    if (!user || !sellerFulfillmentAlert) {
      setSellerFulfillmentAlertDismissed(true);
      return;
    }
    setSellerFulfillmentAlertDismissed(true);
    try {
      const dismissalKey = `beezio_seller_fulfillment_alert_${user.id}_${sellerFulfillmentAlert.needsOrdering}`;
      sessionStorage.setItem(dismissalKey, 'dismissed');
    } catch {
      // ignore storage failures
    }
  };

  const handleSectionTabSelect = (tab: string) => {
    if (activeSection === 'seller') {
      const next = tab as SellerDashboardTab;
      setSellerTab(next);
      navigate(`/dashboard?section=${businessSectionForShell || 'seller'}&tab=${encodeURIComponent(next)}`);
      return;
    }
    if (activeSection === 'buyer') {
      const next = tab as BuyerDashboardTab;
      setBuyerTab(next);
      navigate(`/dashboard?section=buyer&tab=${encodeURIComponent(next)}`);
      return;
    }
  };

  const sellerOrdersRoute = '/dashboard?section=seller&tab=orders';

  const openSellerOrders = () => {
    setSellerTab('orders');
    navigate(sellerOrdersRoute);
  };

  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboard-theme min-h-screen bg-gray-50">
      <main>
        {sellerFulfillmentAlert && !sellerFulfillmentAlertDismissed && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="w-4 h-4" />
                    <p className="text-sm font-semibold">Seller fulfillment alert</p>
                  </div>
                  <p className="mt-1 text-sm text-amber-900">
                    You have {sellerFulfillmentAlert.needsOrdering} order{sellerFulfillmentAlert.needsOrdering === 1 ? '' : 's'} ready to fulfill.
                    {' '}
                    <button
                      type="button"
                      onClick={openSellerOrders}
                      className="font-semibold underline underline-offset-2"
                    >
                      Open the fulfillment queue
                    </button>
                    {' '}
                    to review order details and shipping information.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openSellerOrders}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    <Truck className="w-4 h-4" />
                    View orders
                  </button>
                  <button
                    type="button"
                    onClick={dismissSellerFulfillmentAlert}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showRecruiterInviteBar && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <LinkIcon className="w-4 h-4" />
                    <p className="text-sm font-semibold">Your invite link</p>
                  </div>
                  <p className="mt-1 text-xs text-emerald-800">Share this link to recruit partners. You earn recurring influencer commission on their sales.</p>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                  <input
                    readOnly
                    value={recruiterInviteLink}
                    className="w-full sm:w-[420px] rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedInvite ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeSection === 'buyer' && (
          <EnhancedBuyerDashboard
            key={`buyer-${buyerTab}`}
            activeTabOverride={buyerTab}
            onTabChange={(tab) => handleSectionTabSelect(tab)}
            hideInternalTabs
            title="Buyer Dashboard"
            subtitle="Review orders, receipts, saved products, and support"
          />
        )}
        {activeSection === 'seller' && (
          <EnhancedSellerDashboard
            key={`seller-${sellerTab}`}
            initialTab={initialSellerTab}
            activeTabOverride={sellerTab}
            onTabChange={(tab) => handleSectionTabSelect(tab)}
            hideInternalTabs
            title={sellerDashboardCopy.title}
            description={sellerDashboardCopy.description}
            mode={businessSectionForShell || 'seller'}
          />
        )}
        {activeSection === 'admin' && <PlatformAdminDashboard key="admin" />}
      </main>
    </div>
  );
};

export default UnifiedDashboard;
