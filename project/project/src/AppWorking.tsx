import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, CreditCard, ExternalLink, HelpCircle, Package, Settings, ShoppingCart, Store, UserPlus, Users, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GlobalProvider } from './contexts/GlobalContext';
import AuthModal from './components/AuthModal';
import SimpleSignupModal from './components/SimpleSignupModal';
import PaymentForm from './components/PaymentForm';
import Footer from './components/Footer';
import GlobalHeaderBar from './components/GlobalHeaderBar';
import ScrollToTop from './components/ScrollToTop';
import CustomDomainHandler from './components/CustomDomainHandler';
import { initializeReferralTracking } from './utils/referralTracking';
import { canAccessCJImport } from './utils/cjImportAccess';
import { getNormalizedAccountRoles, isBuyerOnlyAccount } from './utils/accountRoles';

const ContactSupport = lazy(() => import('./pages/ContactSupport'));
const UniversalInbox = lazy(() => import('./components/UniversalInbox'));
const HomePageBZO = lazy(() => import('./pages/HomePageBZO'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ProductForm = lazy(() => import('./components/ProductForm'));
const AddProductPage = lazy(() => import('./pages/AddProductPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const SellersPage = lazy(() => import('./pages/SellersPage'));
const AffiliatePageNew = lazy(() => import('./pages/AffiliatePageNew'));
const AffiliateProductsPage = lazy(() => import('./pages/AffiliateProductsPage'));
const AffiliateDashboardPage = lazy(() => import('./pages/AffiliateDashboardPage'));
const StartEarningPage = lazy(() => import('./pages/StartEarningPageNew'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CheckoutSuccessPage = lazy(() => import('./pages/CheckoutSuccessPage'));
const CheckoutCancelPage = lazy(() => import('./pages/CheckoutCancelPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const AffiliateRedirectPage = lazy(() => import('./pages/AffiliateRedirectPage'));
const InfluencerRedirectPage = lazy(() => import('./pages/InfluencerRedirectPage'));
const InfluencerRecruitPromoPage = lazy(() => import('./pages/InfluencerRecruitPromoPage'));
const AffiliateShareHubPage = lazy(() => import('./pages/AffiliateShareHubPage'));
const AffiliateSingleProductPromoPage = lazy(() => import('./pages/AffiliateSingleProductPromoPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePageDual'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DashboardPreview = lazy(() => import('./pages/DashboardPreview'));
const AffiliateDashboardPreview = lazy(() => import('./pages/AffiliateDashboardPreview'));
const BuyerDashboardPreview = lazy(() => import('./pages/BuyerDashboardPreview'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const SellerStorePage = lazy(() => import('./pages/SellerStorePage'));
const AffiliateStorePage = lazy(() => import('./pages/AffiliateStorePage'));
const CustomPageView = lazy(() => import('./pages/CustomPageView'));
const SellerAboutPage = lazy(() => import('./pages/SellerAboutPage'));
const AffiliateAboutPage = lazy(() => import('./pages/AffiliateAboutPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const WriteReview = lazy(() => import('./pages/WriteReview'));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage'));
const EarningsDashboard = lazy(() => import('./components/EarningsDashboard'));
const PlatformAdminDashboard = lazy(() => import('./components/PlatformAdminDashboard'));
const PlatformSettings = lazy(() => import('./components/PlatformSettings'));
const OrderManagement = lazy(() => import('./components/OrderManagement'));
const RevolutionaryShowcaseSimple = lazy(() => import('./components/RevolutionaryShowcaseSimple'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const DebugServiceWorkerPage = lazy(() => import('./pages/DebugServiceWorkerPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const SellerTerms = lazy(() => import('./pages/legal/SellerTerms'));
const PartnerTerms = lazy(() => import('./pages/legal/PartnerTerms'));
const InfluencerTerms = lazy(() => import('./pages/legal/InfluencerTerms'));
const PaymentsRolesPayouts = lazy(() => import('./pages/legal/PaymentsRolesPayouts'));
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'));
const DisputePolicy = lazy(() => import('./pages/legal/DisputePolicy'));
const PayoutPolicy = lazy(() => import('./pages/legal/PayoutPolicy'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const CustomDomainFAQPage = lazy(() => import('./pages/CustomDomainFAQPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const ShippingPage = lazy(() => import('./pages/ShippingPage'));
const SellerProductFormPage = lazy(() => import('./pages/SellerProductFormPage'));
const ProfileCompletion = lazy(() => import('./components/ProfileCompletion'));
const AffiliateGuide = lazy(() => import('./pages/AffiliateGuide'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AuthConfirmPage = lazy(() => import('./pages/AuthConfirmPage'));
const StorefrontAuthPage = lazy(() => import('./pages/StorefrontAuthPage'));
const StorefrontBuyerAccountPage = lazy(() => import('./pages/StorefrontBuyerAccountPage'));
const EggRacksImportPage = lazy(() => import('./pages/EggRacksImportPage'));
const BulkProductUploadPage = lazy(() => import('./pages/BulkProductUploadPage'));
const AdminProductHubPage = lazy(() => import('./pages/AdminProductHubPage'));
const AdminPayoutsQueuePage = lazy(() => import('./pages/AdminPayoutsQueuePage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPrintfulImportPage = lazy(() => import('./pages/AdminPrintfulImportPage'));
const SupportOperationsPage = lazy(() => import('./pages/SupportOperationsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const PayPalConnectCallbackPage = lazy(() => import('./pages/PayPalConnectCallbackPage'));
const MessagingSmokeTestPage = lazy(() => import('./pages/MessagingSmokeTestPage'));
const StoreSlugRoute = lazy(() => import('./pages/StoreSlugRoute'));
const StoreSlugCustomPageRoute = lazy(() => import('./pages/StoreSlugCustomPageRoute'));
const InsuranceMarketplacePage = lazy(() => import('./pages/InsuranceMarketplacePage'));
const InsuranceListingPage = lazy(() => import('./pages/InsuranceListingPage'));
const InsuranceAgentSetupPage = lazy(() => import('./pages/InsuranceAgentSetupPage'));


// Protect admin route
const ADMIN_EMAIL = "jason@beezio.co";
const SUPPORT_EMAIL = 'support@beezio.co';
const isSupportOperatorEmail = (value: string | null | undefined) => {
  const email = String(value || '').trim().toLowerCase();
  return email === SUPPORT_EMAIL || email.endsWith('.support@beezio.co');
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, hasRole, user, loading } = useAuth();
  const isAdminByRole = profile?.role === 'admin' || profile?.primary_role === 'admin' || hasRole('admin');
  const isAdminByEmailFallback = profile?.email === ADMIN_EMAIL || user?.email === ADMIN_EMAIL;
  const isAdminByAllowlist = canAccessCJImport(user?.email || profile?.email || '');
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 mx-auto"></div>
          <p className="text-gray-600 mt-3">Loading admin access…</p>
        </div>
      </div>
    );
  }
  if (!isAdminByRole && !isAdminByEmailFallback && !isAdminByAllowlist) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied. Admin only.</div>;
  }
  return <>{children}</>;
};

const SupportRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, hasRole, user, loading } = useAuth();
  const profileEmail = String(profile?.email || '').trim().toLowerCase();
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const normalizedRole = String(profile?.primary_role || profile?.role || '').trim().toLowerCase();
  const isAdminUser =
    normalizedRole === 'admin' ||
    hasRole('admin') ||
    profileEmail === ADMIN_EMAIL ||
    userEmail === ADMIN_EMAIL ||
    canAccessCJImport(userEmail || profileEmail);
  const isSupportUser = isSupportOperatorEmail(profileEmail) || isSupportOperatorEmail(userEmail);

  if (loading) {
    return <RouteFallback />;
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  if (!isAdminUser && !isSupportUser) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied. Support operations only.</div>;
  }

  return <>{children}</>;
};

const InsuranceAgentRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, hasRole, user, loading } = useAuth();
  const normalizedRole = String(profile?.primary_role || profile?.role || '').toLowerCase();
  const isAdminUser =
    normalizedRole === 'admin' ||
    hasRole('admin') ||
    profile?.email === ADMIN_EMAIL ||
    user?.email === ADMIN_EMAIL ||
    canAccessCJImport(user?.email || profile?.email || '');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 mx-auto"></div>
          <p className="text-gray-600 mt-3">Loading insurance workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  if (!isAdminUser) {
    return <InsuranceComingSoon />;
  }

  return <>{children}</>;
};

const InsuranceComingSoon = () => (
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
        Coming Soon
      </div>
      <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900">Insurance affiliate marketing is coming soon</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Beezio is launching with product selling, partner storefronts, influencer earnings, PayPal checkout, sales tax collection, and manual fulfillment first.
      </p>
      <p className="mt-3 max-w-2xl text-base text-slate-500">
        Insurance affiliate marketing is coming soon, plus a lot more ways to earn.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/marketplace" className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Browse marketplace
        </Link>
        <Link to="/affiliates" className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-white">
          Become an affiliate
        </Link>
      </div>
    </div>
  </div>
);

const InsurancePublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, hasRole, user, loading } = useAuth();
  const normalizedRole = String(profile?.primary_role || profile?.role || '').toLowerCase();
  const isAdminUser =
    normalizedRole === 'admin' ||
    hasRole('admin') ||
    profile?.email === ADMIN_EMAIL ||
    user?.email === ADMIN_EMAIL ||
    canAccessCJImport(user?.email || profile?.email || '');

  if (loading) return <RouteFallback />;
  if (!isAdminUser) return <InsuranceComingSoon />;
  return <>{children}</>;
};

const LegacyAffiliateStoreRedirect = () => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  return <Navigate to={`/partner/${affiliateId || ''}`} replace />;
};

const LegacyAffiliateAboutRedirect = () => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  return <Navigate to={`/partner/${affiliateId || ''}/about`} replace />;
};

const LegacyAffiliateProductRedirect = () => {
  const { affiliateId, productId } = useParams<{ affiliateId: string; productId: string }>();
  return <Navigate to={`/partner/${affiliateId || ''}/product/${productId || ''}`} replace />;
};

const RouteFallback = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 mx-auto"></div>
      <p className="mt-3 text-sm font-medium text-gray-600">Loading...</p>
    </div>
  </div>
);

// Store settings now live inside the unified dashboard.
const StoreSettingsRoute = () => <Navigate to="/dashboard/store" replace />;

// Beautiful Home Page Component (DEPRECATED - using HomePageBZO)
// Removed to avoid build errors - see HomePageBZO.tsx for active homepage

const AppWorking: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register'; audience: 'buyer' | 'business' }>({ isOpen: false, mode: 'login', audience: 'business' });
  const [showSimpleSignup, setShowSimpleSignup] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; product: any }>({ isOpen: false, product: null });

  // Initialize referral tracking on app load
  useEffect(() => {
    initializeReferralTracking();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('affiliate_ref', ref);
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      setAuthModal({
        isOpen: true,
        mode: e.detail?.mode === 'register' ? 'register' : 'login',
        audience: e.detail?.audience === 'buyer' ? 'buyer' : 'business',
      });
    };
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') return;

    const clipboardAny = (navigator as any).clipboard;
    if (!clipboardAny || typeof clipboardAny.writeText !== 'function') return;
    if (clipboardAny.__beezioPatchedWriteText) return;

    const originalWriteText = clipboardAny.writeText.bind(clipboardAny);

    clipboardAny.writeText = async (value: string) => {
      const text = String(value ?? '');
      try {
        return await originalWriteText(text);
      } catch (firstError) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', 'true');
          textarea.style.position = 'fixed';
          textarea.style.top = '-1000px';
          textarea.style.left = '-1000px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const copied = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (copied) return;
        } catch {
          // ignore and rethrow original
        }
        throw firstError;
      }
    };

    clipboardAny.__beezioPatchedWriteText = true;
  }, []);

  const handlePaymentSuccess = (paymentIntent: any) => {
    console.log('Payment successful:', paymentIntent);
    setPaymentModal({ isOpen: false, product: null });
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const HomeOrDashboard = () => {
    const { user } = useAuth();
    // IMPORTANT: logged-in users should still be able to view the homepage.
    // The dashboard is always available at /dashboard.
    return <HomePageBZO onOpenSimpleSignup={() => setShowSimpleSignup(true)} />;
  };

  const isStorefrontPath = (pathname: string) => {
    const clean = String(pathname || '/');
    if (clean === '/' || clean === '') return false;
    if (clean.startsWith('/account')) return true;

    // Explicit storefront namespaces
    if (clean.startsWith('/store/')) return true;
    if (clean.startsWith('/partner/')) return true;

    // Slug-based storefront routes live at the root (/:storeSlug, /:storeSlug/product/:id, /:storeSlug/:pageSlug)
    const firstSeg = clean.split('?')[0].split('#')[0].split('/').filter(Boolean)[0] || '';
    if (!firstSeg) return false;

    const reserved = new Set([
      'home',
      'revolutionary',
      'marketplace',
      'products',
      'stores',
      'about',
      'search',
      'product',
      'affiliate',
      'af',
      'i',
      'how-it-works',
      'auth',
      'onboarding',
      'start-earning',
      'sellers',
      'seller',
      'dashboard',
      'add-product',
      'admin',
      'signup',
      'get-started',
      'cart',
      'checkout',
      'reset-password',
      'change-password',
      'orders',
      'order-confirmation',
      'contact-support',
      'inbox',
      'messages',
      'messaging-smoke',
      'write-review',
      'contact',
      'privacy',
      'terms',
      'debug-sw',
      'legal',
      'returns',
      'shipping',
      'faq',
      'affiliate-guide',
      'store',
      'partner',
      'paypal',
      'insurance',
    ]);

    return !reserved.has(firstSeg);
  };

  const StorefrontChromeGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, currentRole, userRoles, hasRole, loading: authLoading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileDashboardSubNavOpen, setIsMobileDashboardSubNavOpen] = useState(false);
    const hidePlatformChrome = isStorefrontPath(location.pathname);
    const hideGlobalAuthModal =
      location.pathname === '/auth/login' ||
      location.pathname === '/auth/signup' ||
      location.pathname === '/account/login' ||
      location.pathname === '/account/signup';
    const params = new URLSearchParams(location.search);
    const sectionParam = String(params.get('section') || '').toLowerCase();
    const tabParam = String(params.get('tab') || '').toLowerCase();
    const dashboardPathSection = location.pathname.startsWith('/dashboard/')
      ? String(location.pathname.split('/')[2] || '').toLowerCase()
      : '';
    const requestedDashboardSection = sectionParam || dashboardPathSection;
    const isAdminDashboardUser = Boolean(
      user &&
        (String(profile?.primary_role || profile?.role || '').toLowerCase() === 'admin' ||
          userRoles.map((role) => String(role || '').toLowerCase()).includes('admin') ||
          hasRole?.('admin') ||
          canAccessCJImport(user.email || profile?.email || ''))
    );
    const activeDashboardSection =
      requestedDashboardSection === 'buyer'
        ? 'buyer'
        : requestedDashboardSection === 'admin' && isAdminDashboardUser
        ? 'admin'
        : 'seller';
    const customerAccountPath = `/account${tabParam ? `?tab=${encodeURIComponent(tabParam)}` : ''}`;
    const normalizedAccountRoles = getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role, currentRole);
    const buyerOnlyDashboard = Boolean(user && isBuyerOnlyAccount(normalizedAccountRoles));
    const isDashboardPath = location.pathname.startsWith('/dashboard');
    const isProductEditorRoute =
      location.pathname === '/dashboard/products/add' ||
      location.pathname === '/seller/products/new' ||
      location.pathname.startsWith('/dashboard/products/edit/');
    const isFallbackBusinessHydration =
      Boolean(user) &&
      Boolean((profile as any)?.__is_fallback) &&
      requestedDashboardSection !== 'buyer';

    const shouldRedirectBuyerDashboard =
      isDashboardPath &&
      !authLoading &&
      !isFallbackBusinessHydration &&
      (activeDashboardSection === 'buyer' || buyerOnlyDashboard);

    const businessDashboardSubNav = [
      { id: 'products', label: 'Products', icon: Package, description: 'Add your products and manage promoted marketplace items' },
      { id: 'orders', label: 'Orders', icon: ShoppingCart, description: 'Review sales, shipping, and fulfillment status' },
      { id: 'store-customization', label: 'Custom Store', icon: Store, description: 'Edit your storefront and branding' },
      { id: 'single-product', label: 'Single Product', icon: ExternalLink, description: 'Create focused single-item promotions' },
      { id: 'influencer-promo', label: 'Influencer Promo', icon: Users, description: 'Create influencer recruiting promotional pages' },
      { id: 'financials', label: 'Financials', icon: CreditCard, description: 'Seller, affiliate, and influencer sales data and payout visibility' },
      { id: 'analytics', label: 'Analytics', icon: Zap, description: 'See traffic, sales, and conversion activity' },
      { id: 'support', label: 'Support', icon: HelpCircle, description: 'Get platform help' },
      ...(isAdminDashboardUser ? [{ id: 'admin', label: 'Admin', icon: Settings, description: 'Platform admin tools' }] : []),
    ];
    const dashboardSubNav =
      activeDashboardSection === 'buyer'
        ? [
            { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Buyer dashboard summary' },
            { id: 'orders', label: 'Orders', icon: ShoppingCart, description: 'Review purchases and receipts' },
            { id: 'purchases', label: 'Purchases', icon: Package, description: 'Access purchased items' },
            { id: 'wishlist', label: 'Wishlist', icon: Store, description: 'Saved products' },
            { id: 'support', label: 'Support', icon: HelpCircle, description: 'Get order support' },
          ]
        : activeDashboardSection === 'seller' || activeDashboardSection === 'affiliate' || activeDashboardSection === 'influencer' || activeDashboardSection === 'admin'
        ? businessDashboardSubNav
        : [];

    const dashboardSectionLabel =
      requestedDashboardSection === 'affiliate'
        ? 'Affiliate Dashboard'
        : requestedDashboardSection === 'influencer'
        ? 'Influencer Dashboard'
        : requestedDashboardSection === 'admin'
        ? 'Admin Dashboard'
        : requestedDashboardSection === 'buyer'
        ? 'Buyer Dashboard'
        : 'Seller Dashboard';

    const showPersistentDashboardSubNav = Boolean(
      user &&
      !hidePlatformChrome &&
      !isProductEditorRoute &&
      dashboardSubNav.length > 0
    );
    const isMarketplaceChromeRoute = location.pathname === '/marketplace' || location.pathname === '/products';
    const activeDashboardTabId =
      tabParam === 'fulfillment'
        ? 'orders'
        : tabParam === 'overview'
        ? 'products'
        : tabParam === 'earnings' || tabParam === 'payouts'
        ? 'financials'
        : tabParam === 'integrations'
        ? 'financials'
        : activeDashboardSection === 'admin'
        ? 'admin'
        : tabParam || 'products';
    const defaultDashboardTabId = activeDashboardSection === 'buyer' ? 'overview' : 'products';
    const activeDashboardTab =
      dashboardSubNav.find((tab) => tab.id === activeDashboardTabId) ||
      dashboardSubNav.find((tab) => tab.id === defaultDashboardTabId);

    useEffect(() => {
      setIsMobileDashboardSubNavOpen(false);
    }, [location.pathname, location.search]);

    const handlePersistentDashboardNavClick = (tabId: string) => {
      if (tabId === 'products') {
        const target = '/dashboard?tab=products';
        if (location.pathname.startsWith('/dashboard/products/edit/')) {
          window.location.assign(target);
          return;
        }
        navigate(target);
        return;
      }
      if (tabId === 'admin') {
        navigate('/dashboard?section=admin');
        return;
      }
      if (tabId === 'orders') {
        navigate('/dashboard?tab=orders');
        return;
      }
      if (tabId === 'influencer-promo') {
        navigate('/dashboard?tab=influencer-promo');
        return;
      }

      if (activeDashboardSection === 'buyer' || activeDashboardSection === 'seller' || activeDashboardSection === 'admin') {
        const target =
          activeDashboardSection === 'buyer'
            ? `/dashboard?section=buyer&tab=${encodeURIComponent(tabId)}`
            : `/dashboard?tab=${encodeURIComponent(tabId)}`;
        if (location.pathname.startsWith('/dashboard/products/edit/')) {
          window.location.assign(target);
          return;
        }
        navigate(target);
        return;
      }
    };

    return (
      <div className={hidePlatformChrome ? 'min-h-screen' : 'min-h-screen bg-bzo-gradient'}>
        {!hidePlatformChrome && (
          <GlobalHeaderBar
            onOpenAuth={() => setAuthModal({ isOpen: true, mode: 'login' })}
            onOpenSignup={() => setShowSimpleSignup(true)}
          />
        )}

        {showPersistentDashboardSubNav && (
          <div className="mt-14 border-b border-[#d6ab00] bg-[#ffe37a] xl:sticky xl:top-14 xl:z-40">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
              <div className="xl:hidden py-2">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fff4b8] px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b4f00]">
                      {dashboardSectionLabel}
                    </div>
                    <div className="truncate text-sm font-semibold text-[#2e2300]">
                      {activeDashboardTab?.label || 'Sections'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileDashboardSubNavOpen((current) => !current)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d6ab00] bg-white px-3 py-2 text-xs font-semibold text-[#2e2300]"
                    aria-expanded={isMobileDashboardSubNavOpen}
                    aria-label="Toggle dashboard sections"
                  >
                    Dashboard Menu
                    <ChevronDown className={`h-4 w-4 transition-transform ${isMobileDashboardSubNavOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {isMobileDashboardSubNavOpen && (
                  <>
                    <div className="mt-2 mb-2 flex gap-2 overflow-x-auto pb-1">
                      <Link
                        to="/dashboard/products/add"
                        onClick={() => setIsMobileDashboardSubNavOpen(false)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#101820] px-3 py-2 text-xs font-semibold text-[#ffcb05]"
                      >
                        Sell a Product
                      </Link>
                      <Link
                        to="/marketplace"
                        onClick={() => setIsMobileDashboardSubNavOpen(false)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#101820] hover:bg-[#ffef9f]"
                      >
                        Open Marketplace
                      </Link>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {dashboardSubNav.map((tab) => {
                        const Icon = tab.icon;
                        const isActive =
                          activeDashboardTabId === tab.id || (!activeDashboardTabId && tab.id === defaultDashboardTabId);

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handlePersistentDashboardNavClick(tab.id)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                              isActive ? 'border-[#101820] bg-[#101820] text-[#ffcb05]' : 'border-[#d6ab00] bg-white text-[#2e2300]'
                            }`}
                            title={tab.description}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="hidden xl:flex items-center gap-3 overflow-x-auto py-2">
                <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {dashboardSubNav.map((tab) => {
                  const Icon = tab.icon;
                  const isActive =
                    activeDashboardTabId === tab.id || (!activeDashboardTabId && tab.id === defaultDashboardTabId);

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handlePersistentDashboardNavClick(tab.id)}
                      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'border-[#101820] bg-[#101820] text-[#ffcb05]'
                          : 'border-transparent text-[#2e2300] hover:border-[#d6ab00] hover:bg-[#ffef9f]'
                      }`}
                      title={tab.description}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
                </nav>
                <div className="flex shrink-0 items-center gap-2 border-l border-[#d6ab00] pl-3">
                  <Link
                    to="/dashboard/products/add"
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#101820] px-3 py-2 text-sm font-semibold text-[#ffcb05] hover:bg-[#26313f]"
                  >
                    Sell a Product
                  </Link>
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-[#101820] hover:bg-[#ffef9f]"
                  >
                    Open Marketplace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {shouldRedirectBuyerDashboard ? (
          <Navigate to={customerAccountPath} replace />
        ) : null}

        <main className={hidePlatformChrome ? '' : showPersistentDashboardSubNav ? 'pb-16 pt-0 xl:pb-0' : isMarketplaceChromeRoute ? 'pb-16 pt-12 sm:pt-14 xl:pb-0' : 'pb-20 pt-16 xl:pb-0'}>
          {children}
        </main>

        {!hidePlatformChrome && (
          <Footer />
        )}

        {/* Auth Modal */}
        {!hideGlobalAuthModal && (
          <AuthModal
            isOpen={authModal.isOpen}
            mode={authModal.mode}
            audience={authModal.audience}
            onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
          />
        )}

        {/* Simple Signup Modal */}
        <SimpleSignupModal
          isOpen={showSimpleSignup}
          onClose={() => setShowSimpleSignup(false)}
          onSuccess={() => {
            setShowSimpleSignup(false);
            // Optionally redirect to dashboard
          }}
        />

        {/* Payment Modal */}
        {paymentModal.isOpen && paymentModal.product && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
                <button
                  onClick={() => setPaymentModal({ isOpen: false, product: null })}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ×
                </button>
              </div>
              <PaymentForm
                product={paymentModal.product}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <GlobalProvider>
      <AuthProvider>
        <CartProvider>
          <AffiliateProvider>
            <Router>
              <ScrollToTop />
              <CustomDomainHandler>
              <StorefrontChromeGate>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomeOrDashboard />} />
                    <Route path="/home" element={<HomeOrDashboard />} />
                    <Route path="/revolutionary" element={<RevolutionaryShowcaseSimple />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/digital-products" element={<Navigate to="/marketplace" replace />} />
                    <Route path="/products" element={<MarketplacePage />} />
                    <Route path="/insurance" element={<InsurancePublicRoute><InsuranceMarketplacePage /></InsurancePublicRoute>} />
                    <Route path="/insurance/agent/setup" element={<InsuranceAgentRoute><InsuranceAgentSetupPage /></InsuranceAgentRoute>} />
                    <Route path="/insurance/:slug" element={<InsurancePublicRoute><InsuranceListingPage /></InsurancePublicRoute>} />
                    <Route path="/stores" element={<StoresPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/:storeSlug/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/store/:storeSlug/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/seller/:storeSlug/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/affiliate/:affiliateId/product/:productId" element={<LegacyAffiliateProductRedirect />} />
                    <Route path="/partner/:storeSlug/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/af/:code" element={<AffiliateRedirectPage />} />
                    <Route path="/i/:code" element={<InfluencerRedirectPage />} />
                    <Route path="/promo/join/:code" element={<InfluencerRecruitPromoPage />} />
                    <Route path="/promo/beezio/:code" element={<InfluencerRecruitPromoPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
                    <Route path="/auth/login" element={<AuthPage mode="login" />} />
                    <Route path="/auth/register" element={<AuthPage mode="register" />} />
                    <Route path="/auth/signup" element={<AuthPage mode="register" />} />
                    <Route path="/account" element={<StorefrontBuyerAccountPage />} />
                    <Route path="/account/login" element={<StorefrontAuthPage mode="login" />} />
                    <Route path="/account/register" element={<StorefrontAuthPage mode="register" />} />
                    <Route path="/account/signup" element={<StorefrontAuthPage mode="register" />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/paypal/connect/callback" element={<PayPalConnectCallbackPage />} />
                    <Route path="/start-earning" element={<StartEarningPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setShowSimpleSignup(true)} />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/seller/signup" element={<SignUpPage />} />
                    <Route path="/affiliates" element={<AffiliatePageNew />} />
                    <Route path="/affiliate" element={<AffiliatePageNew />} />
                    <Route path="/affiliate/signup" element={<SignUpPage />} />
                    <Route path="/affiliate-signup" element={<SignUpPage />} />
                    <Route path="/affiliate/products" element={<AffiliateProductsPage />} />
                    <Route path="/affiliate/dashboard" element={<AffiliateDashboardPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/buyer" element={<Navigate to="/account" replace />} />
                    <Route path="/dashboard/seller" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard/affiliate" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard/:section" element={<Dashboard />} />
                    <Route path="/dashboard/store-settings" element={<StoreSettingsRoute />} />
                    <Route path="/add-product" element={<SellerProductFormPage />} />
                    <Route path="/add-product-old" element={<AddProductPage />} />
                    <Route path="/dashboard-preview" element={<DashboardPreview />} />
                    <Route path="/affiliate-dashboard-preview" element={<AffiliateDashboardPreview />} />
                    <Route path="/buyer-dashboard-preview" element={<BuyerDashboardPreview />} />
                    {/* Public store URLs (slug-based) */}
                    <Route path="/store/:storeSlug" element={<StoreSlugRoute />} />
                    <Route path="/store/:storeSlug/about" element={<StoreSlugRoute mode="about" />} />
                    <Route path="/seller/:storeSlug" element={<StoreSlugRoute />} />
                    <Route path="/seller/:storeSlug/about" element={<StoreSlugRoute mode="about" />} />

                    {/* Legacy ID-based store URLs (avoid colliding with slug routing) */}
                    <Route path="/store/id/:sellerId" element={<SellerStorePage />} />
                    <Route path="/store/id/:sellerId/about" element={<SellerAboutPage />} />
                    <Route path="/affiliate/:affiliateId" element={<LegacyAffiliateStoreRedirect />} />
                    <Route path="/affiliate/:affiliateId/about" element={<LegacyAffiliateAboutRedirect />} />
                    <Route path="/partner/:affiliateId" element={<AffiliateStorePage />} />
                    <Route path="/partner/:affiliateId/about" element={<AffiliateAboutPage />} />
                    <Route path="/affiliate/share" element={<AffiliateShareHubPage />} />
                    <Route path="/promo/product/:productId" element={<AffiliateSingleProductPromoPage />} />
                    <Route path="/affiliate/promo/:productId" element={<AffiliateSingleProductPromoPage />} />
                    <Route path="/:ownerType/:username/:pageSlug" element={<CustomPageView />} />
                    <Route path="/dashboard/products/add" element={<SellerProductFormPage />} />
                    <Route path="/dashboard/products/edit/:id" element={<ProductForm editMode={true} />} />
                    <Route path="/seller/products" element={<Navigate to="/dashboard?tab=products" replace />} />
                    <Route path="/dashboard/integrations" element={<Dashboard />} />
                    <Route path="/seller/products/new" element={<SellerProductFormPage />} />
                    <Route path="/seller/orders" element={<Navigate to="/dashboard?tab=orders" replace />} />
                    <Route path="/buyer/orders" element={<Navigate to="/account?tab=orders" replace />} />
                    <Route path="/profile" element={<ProfileCompletion />} />
                    <Route path="/earnings" element={<EarningsDashboard />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/debug-sw" element={<DebugServiceWorkerPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
                    <Route path="/legal/terms" element={<TermsOfService />} />
                    <Route path="/legal/payments-payouts" element={<PaymentsRolesPayouts />} />
                    <Route path="/legal/seller-terms" element={<SellerTerms />} />
                    <Route path="/legal/partner-terms" element={<PartnerTerms />} />
                    <Route path="/legal/influencer-terms" element={<InfluencerTerms />} />
                    <Route path="/legal/refund-policy" element={<RefundPolicy />} />
                    <Route path="/legal/dispute-policy" element={<DisputePolicy />} />
                    <Route path="/legal/payout-policy" element={<PayoutPolicy />} />
                    <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                    <Route path="/returns" element={<ReturnsPage />} />
                    <Route path="/shipping" element={<ShippingPage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    <Route path="/faq/custom-domains" element={<CustomDomainFAQPage />} />
                    <Route path="/affiliate-guide" element={<AffiliateGuide />} />
                    <Route path="/admin" element={<AdminRoute><Navigate to="/dashboard/admin" replace /></AdminRoute>} />
                    <Route path="/admin/products" element={<AdminRoute><AdminProductHubPage /></AdminRoute>} />
                    <Route path="/admin/printful" element={<AdminRoute><AdminPrintfulImportPage /></AdminRoute>} />
                    <Route path="/admin/bulk-products" element={<AdminRoute><BulkProductUploadPage /></AdminRoute>} />
                    <Route path="/admin/platform" element={<AdminRoute><PlatformAdminDashboard /></AdminRoute>} />
                    <Route path="/admin/payouts" element={<AdminRoute><AdminPayoutsQueuePage /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><PlatformSettings /></AdminRoute>} />
                    <Route path="/admin/messaging-smoke" element={<AdminRoute><MessagingSmokeTestPage /></AdminRoute>} />
                    <Route path="/admin/eggracks-import" element={<AdminRoute><EggRacksImportPage /></AdminRoute>} />
                    <Route path="/support/ops" element={<SupportRoute><SupportOperationsPage /></SupportRoute>} />
                    <Route path="/support" element={<ContactSupport />} />
                    <Route path="/support/disputes" element={<ContactSupport />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/get-started" element={<SignUpPage />} />
                    <Route path="/auth/verify" element={<AuthConfirmPage />} />
                    <Route path="/auth/confirm" element={<AuthConfirmPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                    <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/change-password" element={<ChangePasswordPage />} />
                    <Route path="/orders" element={<OrderManagement />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/contact-support" element={<ContactSupport />} />
                    <Route path="/inbox" element={<UniversalInbox />} />
                    <Route path="/messages" element={<UniversalInbox />} />
                    <Route path="/messaging-smoke" element={<MessagingSmokeTestPage />} />
                    <Route path="/write-review/:productId" element={<WriteReview />} />
                    <Route path="/:storeSlug/about" element={<StoreSlugRoute mode="about" />} />
                    <Route path="/:storeSlug/:pageSlug" element={<StoreSlugCustomPageRoute />} />
                    <Route path="/:storeSlug" element={<StoreSlugRoute />} />
                    <Route path="/store/:storeSlug/:pageSlug" element={<StoreSlugCustomPageRoute />} />
                    <Route path="/seller/:storeSlug/:pageSlug" element={<StoreSlugCustomPageRoute />} />
                    <Route path="/partner/:storeSlug/:pageSlug" element={<StoreSlugCustomPageRoute />} />
                  </Routes>
                </Suspense>
              </StorefrontChromeGate>
              </CustomDomainHandler>
            </Router>
        </AffiliateProvider>
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppWorking;
