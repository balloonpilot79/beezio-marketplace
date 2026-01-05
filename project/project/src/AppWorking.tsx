import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import ContactSupport from './pages/ContactSupport';
import { AuthProvider, useAuth } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GlobalProvider } from './contexts/GlobalContext';
import HomePageBZO from './pages/HomePageBZO';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import SimpleSignupModal from './components/SimpleSignupModal';
import PaymentForm from './components/PaymentForm';
import ProductForm from './components/ProductForm';
import AddProductPage from './pages/AddProductPage';
import StreamlinedAddProducts from './pages/StreamlinedAddProducts';
import HowItWorksPage from './pages/HowItWorksPage';
import SellersPage from './pages/SellersPage';
import AffiliatePageNew from './pages/AffiliatePageNew';
import AffiliateProductsPage from './pages/AffiliateProductsPage';
import AffiliateDashboardPage from './pages/AffiliateDashboardPage';
import StartEarningPage from './pages/StartEarningPageNew';
import CheckoutPage from './pages/CheckoutPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import ProductDetailPage from './pages/ProductDetailPageSimple';
import AffiliateRedirectPage from './pages/AffiliateRedirectPage';
import AffiliateShareHubPage from './pages/AffiliateShareHubPage';
import MarketplacePage from './pages/MarketplacePageDual';
import SearchPage from './pages/SearchPage';
import FundraisersPage from './pages/FundraisersPage';
import FundraiserDetailPage from './pages/FundraiserDetailPage';
import DashboardPreview from './pages/DashboardPreview';
import AffiliateDashboardPreview from './pages/AffiliateDashboardPreview';
import BuyerDashboardPreview from './pages/BuyerDashboardPreview';
import SignUpPage from './pages/SignUpPage';
import CausesPage from './pages/CausesPage';
import SellerStorePage from './pages/SellerStorePage';
import AffiliateStorePage from './pages/AffiliateStorePage';
import CustomPageView from './pages/CustomPageView';
import CartPage from './pages/CartPage';
import WriteReview from './pages/WriteReview';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import EarningsDashboard from './components/EarningsDashboard';
import PlatformAdminDashboard from './components/PlatformAdminDashboard';
import PlatformSettings from './components/PlatformSettings';
import StoreCustomization from './components/StoreCustomization';
import AffiliateStoreCustomization from './components/AffiliateStoreCustomization';
import OrderManagement from './components/OrderManagement';
import RevolutionaryShowcaseSimple from './components/RevolutionaryShowcaseSimple';
import TestPage from './components/TestPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FAQPage from './pages/FAQPage';
import Footer from './components/Footer';
import GlobalHeaderBar from './components/GlobalHeaderBar';
import SellerProductFormPage from './pages/SellerProductFormPage';
import SellerProductsPage from './pages/SellerProductsPage';
import ProfileCompletion from './components/ProfileCompletion';
import TestingDashboard from './components/TestingDashboard';
import AffiliateGuide from './pages/AffiliateGuide';
import ScrollToTop from './components/ScrollToTop';
import CustomDomainHandler from './components/CustomDomainHandler';
import { initializeReferralTracking } from './utils/referralTracking';
import MessagesPage from './pages/MessagesPage';
import StoresPage from './pages/StoresPage';
import AboutPage from './pages/AboutPage';
import AuthPage from './pages/AuthPage';
import DashboardRoleSelector from './pages/DashboardRoleSelector';
import CJProductImportPage from './pages/CJProductImportPage';
import BulkProductUploadPage from './pages/BulkProductUploadPage';
import AdminProductHubPage from './pages/AdminProductHubPage';
import OnboardingPage from './pages/OnboardingPage';
import StripeReturnPage from './pages/StripeReturnPage';
import { canAccessCJImport } from './utils/cjImportAccess';
import { resolveProfileIdForUser } from './utils/resolveProfileId';

import DashboardLayout from './components/layout/DashboardLayout';
import UniversalInbox from './components/UniversalInbox';

// Protect admin route
const ADMIN_EMAIL = "jason@beezio.co";
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, hasRole } = useAuth();
  const isAdminByRole = profile?.role === 'admin' || profile?.primary_role === 'admin' || hasRole('admin');
  const isAdminByEmailFallback = profile?.email === ADMIN_EMAIL;
  if (!isAdminByRole && !isAdminByEmailFallback) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied. Admin only.</div>;
  }
  return <>{children}</>;
};

// CJ Import Route - intentionally restricted to the official Beezio store account(s)
const CJImportRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!canAccessCJImport(user?.email)) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied.</div>;
  }
  return <>{children}</>;
};

// Store Settings Route - requires seller role
const StoreSettingsRoute = () => {
  const { profile, currentRole, user } = useAuth();
  const [resolvedProfileId, setResolvedProfileId] = React.useState<string>('');
  
  if (!profile) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Please sign in to access store settings.</div>;
  }

  const role = profile?.primary_role || profile?.role || currentRole;
  const profileId = resolvedProfileId || (profile as any)?.id || user?.id || 'default';

  React.useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    void (async () => {
      const canonical = await resolveProfileIdForUser(user.id);
      if (!cancelled) setResolvedProfileId(canonical);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Show appropriate customization based on role
  if (role === 'seller' || role === 'fundraiser') {
    return <StoreCustomization userId={profileId} role="seller" />;
  } else if (role === 'affiliate') {
    return <AffiliateStoreCustomization affiliateId={profileId} />;
  } else {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Your Store</h2>
        <p className="text-gray-600 mb-6">To create a custom store, you need to be a seller or affiliate.</p>
        <div className="space-y-3">
          <Link to="/profile" className="block px-6 py-3 bg-[#ffcb05] text-black rounded-lg hover:bg-[#e0b000] transition-colors">
            Become a Seller
          </Link>
          <Link to="/profile" className="block px-6 py-3 bg-[#101820] text-[#ffcb05] rounded-lg hover:bg-black transition-colors">
            Become an Affiliate
          </Link>
        </div>
      </div>
    );
  }
};

// Beautiful Home Page Component (DEPRECATED - using HomePageBZO)
// Removed to avoid build errors - see HomePageBZO.tsx for active homepage

const AppWorking: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({ isOpen: false, mode: 'login' });
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
      setAuthModal({ isOpen: true, mode: e.detail?.mode === 'register' ? 'register' : 'login' });
    };
    window.addEventListener('open-auth-modal', handler);
    return () => window.removeEventListener('open-auth-modal', handler);
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

  return (
    <GlobalProvider>
      <AuthProvider>
        <CartProvider>
          <AffiliateProvider>
            <Router>
              <ScrollToTop />
              <CustomDomainHandler>
              <div className="min-h-screen bg-bzo-gradient">
                <GlobalHeaderBar
                  onOpenAuth={() => setAuthModal({ isOpen: true, mode: 'login' })}
                  onOpenSignup={() => setShowSimpleSignup(true)}
                />
                <main className="pt-16">
                  <Routes>
                    <Route path="/" element={<HomeOrDashboard />} />
                    <Route path="/home" element={<HomeOrDashboard />} />
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/testing" element={<TestingDashboard />} />
                    <Route path="/revolutionary" element={<RevolutionaryShowcaseSimple />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/products" element={<MarketplacePage />} />
                    <Route path="/stores" element={<StoresPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/fundraisers" element={<FundraisersPage />} />
                    <Route path="/fundraiser/:fundraiserId" element={<FundraiserDetailPage />} />
                    <Route path="/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/af/:code" element={<AffiliateRedirectPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/auth/login" element={<AuthPage mode="login" />} />
                    <Route path="/auth/signup" element={<AuthPage mode="register" />} />
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/stripe/return" element={<StripeReturnPage />} />
                    <Route path="/start-earning" element={<StartEarningPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setShowSimpleSignup(true)} />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/seller/signup" element={<SignUpPage />} />
                    <Route path="/affiliates" element={<AffiliatePageNew />} />
                    <Route path="/affiliate" element={<AffiliatePageNew />} />
                    <Route path="/affiliate/signup" element={<SignUpPage />} />
                    <Route path="/affiliate-signup" element={<SignUpPage />} />
                    <Route path="/affiliate/products" element={<AffiliateProductsPage />} />
                    <Route path="/affiliate/dashboard" element={<AffiliateDashboardPage />} />
                    <Route path="/dashboard" element={<DashboardRoleSelector />} />
                    <Route path="/dashboard/buyer" element={<Dashboard />} />
                    <Route path="/dashboard/seller" element={<Dashboard />} />
                    <Route path="/dashboard/affiliate" element={<Dashboard />} />
                    <Route path="/dashboard/fundraiser" element={<Dashboard />} />
                    <Route path="/dashboard/:role" element={<Dashboard />} />
                    <Route path="/add-product" element={<StreamlinedAddProducts />} />
                    <Route path="/add-product-old" element={<AddProductPage />} />
                    <Route path="/dashboard-preview" element={<DashboardPreview />} />
                    <Route path="/affiliate-dashboard-preview" element={<AffiliateDashboardPreview />} />
                    <Route path="/buyer-dashboard-preview" element={<BuyerDashboardPreview />} />
                    <Route path="/messages" element={<MessagesPage />} />
                    <Route path="/store/:sellerId" element={<SellerStorePage />} />
                    <Route path="/affiliate/:affiliateId" element={<AffiliateStorePage />} />
                    <Route path="/affiliate/share" element={<AffiliateShareHubPage />} />
                    <Route path="/:ownerType/:username/:pageSlug" element={<CustomPageView />} />
                    <Route path="/dashboard/products/add" element={<ProductForm />} />
                    <Route path="/dashboard/products/edit/:id" element={<ProductForm editMode={true} />} />
                    <Route path="/dashboard/products" element={<SellerProductsPage />} />
                    <Route path="/seller/products" element={<SellerProductsPage />} />
                    <Route path="/dashboard/store-settings" element={<StoreSettingsRoute />} />
                    <Route path="/dashboard/integrations" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard/inbox" element={<DashboardLayout title="Inbox"><UniversalInbox /></DashboardLayout>} />
                    <Route path="/seller/products/new" element={<SellerProductFormPage />} />
                    <Route path="/profile" element={<ProfileCompletion />} />
                    <Route path="/earnings" element={<EarningsDashboard />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    <Route path="/affiliate-guide" element={<AffiliateGuide />} />
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/products" element={<AdminRoute><AdminProductHubPage /></AdminRoute>} />
                    <Route path="/admin/bulk-products" element={<AdminRoute><BulkProductUploadPage /></AdminRoute>} />
                    <Route path="/admin/platform" element={<AdminRoute><PlatformAdminDashboard /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><PlatformSettings /></AdminRoute>} />
                    <Route path="/admin/cj-import" element={<CJImportRoute><CJProductImportPage /></CJImportRoute>} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/get-started" element={<SignUpPage />} />
                    <Route path="/causes" element={<CausesPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                    <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
                    <Route path="/orders" element={<OrderManagement />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/contact-support" element={<ContactSupport />} />
                    <Route path="/write-review/:productId" element={<WriteReview />} />
                  </Routes>
                </main>

                {/* Footer */}
                <Footer />

                {/* Auth Modal */}
                <AuthModal
                  isOpen={authModal.isOpen}
                  mode={authModal.mode}
                  onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
                />

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
              </CustomDomainHandler>
            </Router>
        </AffiliateProvider>
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppWorking;
