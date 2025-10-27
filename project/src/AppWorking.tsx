import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ContactSupport from './pages/ContactSupport';
import { AuthProvider, useAuth } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GlobalProvider } from './contexts/GlobalContext';
import { GamificationProvider } from './contexts/GamificationContext';
import Header from './components/Header';
import UserSubHeader from './components/UserSubHeader';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import SimpleSignupModal from './components/SimpleSignupModal';
import PaymentForm from './components/PaymentForm';
import ProductForm from './components/ProductForm';
import AddProductPage from './pages/AddProductPage';
import HowItWorksPage from './pages/HowItWorksPage';
import SellersPage from './pages/SellersPage';
import AffiliatePageNew from './pages/AffiliatePageNew';
import AffiliateProductsPage from './pages/AffiliateProductsPage';
import AffiliateDashboardPage from './pages/AffiliateDashboardPage';
import StartEarningPage from './pages/StartEarningPageNew';
import EnhancedCheckoutPage from './pages/EnhancedCheckoutPage';
import ProductDetailPage from './pages/ProductDetailPageSimple';
import MarketplacePage from './pages/MarketplacePageSimple';
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
import CartPage from './pages/CartPage';
import WriteReview from './pages/WriteReview';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import EarningsDashboard from './components/EarningsDashboard';
import PlatformAdminDashboard from './components/PlatformAdminDashboard';
import PlatformSettings from './components/PlatformSettings';
import StoreCustomization from './components/StoreCustomization';
import UniversalIntegrationsPage from './components/UniversalIntegrationsPage';
import OrderManagement from './components/OrderManagement';
// import ChatBot from './components/ChatBot';
import ProductSlider from './components/ProductSlider';
import FundraiserSlider from './components/FundraiserSlider';
import RevolutionaryShowcaseSimple from './components/RevolutionaryShowcaseSimple';
import TestPage from './components/TestPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FAQPage from './pages/FAQPage';
import Footer from './components/Footer';
import SellerProductFormPage from './pages/SellerProductFormPage';
import ProfileCompletion from './components/ProfileCompletion';
import TestingDashboard from './components/TestingDashboard';
import AffiliateGuide from './pages/AffiliateGuide';
import ScrollToTop from './components/ScrollToTop';

// Protect admin route
const ADMIN_EMAIL = "balloonpilot79@gmail.com";
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  if (!profile || profile.role !== 'admin' || profile.email !== ADMIN_EMAIL) {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied. Admin only.</div>;
  }
  return <>{children}</>;
};

// Store Settings Route - requires seller role
const StoreSettingsRoute = () => {
  const { profile } = useAuth();
  if (!profile || profile.role !== 'seller') {
    return <div className="max-w-xl mx-auto mt-20 text-center text-red-600 text-lg font-bold">Access denied. Sellers only.</div>;
  }
  return <StoreCustomization userId={profile.id || 'default'} role="seller" />;
};

// Beautiful Home Page Component
interface HomePageProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Compact Hero Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Welcome to <span className="text-yellow-600">Beezio</span>
              </h1>
              <p className="text-sm text-gray-600">
                Your marketplace for buying, selling & earning
              </p>
            </div>

            {/* Compact Search Bar */}
            <div className="max-w-2xl mx-auto mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 bg-white"
                />
                <button className="absolute right-1.5 top-1.5 bg-yellow-600 text-white px-4 py-1.5 rounded-md hover:bg-yellow-700 transition-colors text-sm font-medium">
                  Search
                </button>
              </div>
            </div>

            {/* Compact Category Pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Beauty', 'Health', 'Tech'].map((category) => (
                <button
                  key={category}
                  onClick={() => window.location.href = `/marketplace?category=${encodeURIComponent(category)}`}
                  className="px-3 py-1.5 bg-white rounded-md text-xs font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
                >
                  {category}
                </button>
              ))}
              <button
                onClick={() => window.location.href = '/marketplace'}
                className="px-3 py-1.5 bg-yellow-600 rounded-md text-xs font-medium text-white hover:bg-yellow-700 transition-all"
              >
                All Categories →
              </button>
            </div>
          </div>
        </div>

        {/* Prominent CTA Banner */}
        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 border-b border-yellow-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-white text-center md:text-left">
                <h2 className="text-lg md:text-xl font-bold mb-1">
                  Start Earning with Beezio Today
                </h2>
                <p className="text-sm text-yellow-50">
                  Sell products • Promote & earn commissions • Raise funds • Get 2% on your affiliate network
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => window.location.href = '/signup?role=seller'}
                  className="bg-white text-yellow-700 px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-yellow-50 transition-all shadow-md hover:shadow-lg"
                >
                  Become a Seller
                </button>
                <button
                  onClick={() => window.location.href = '/signup?role=affiliate'}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
                >
                  Become an Affiliate
                </button>
                <button
                  onClick={() => window.location.href = '/signup?role=fundraiser'}
                  className="border-2 border-white text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-white hover:text-yellow-700 transition-all"
                >
                  Start Fundraising
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Slider - Featured Products */}
        <ProductSlider />
        
        {/* Fundraiser Slider */}
        <FundraiserSlider />

        {/* Compact 3-Card Section */}
        <div className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                Three Ways to Earn
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {/* Seller Card */}
              <div className="bg-white rounded-lg p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Sell Products</h3>
                <p className="text-xs text-gray-600 mb-3">Custom store • Set your price • Get paid</p>
                <button 
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="w-full bg-blue-500 text-white py-2 rounded-md font-medium hover:bg-blue-600 transition-colors text-sm"
                >
                  Start Selling
                </button>
              </div>

              {/* Affiliate Card */}
              <div className="bg-white rounded-lg p-5 border border-gray-200 hover:border-green-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Promote Products</h3>
                <p className="text-xs text-gray-600 mb-3">Custom rates • Share links • Earn commissions</p>
                <button 
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="w-full bg-green-500 text-white py-2 rounded-md font-medium hover:bg-green-600 transition-colors text-sm"
                >
                  Become Affiliate
                </button>
              </div>

              {/* Referral Card */}
              <div className="bg-white rounded-lg p-5 border border-gray-200 hover:border-yellow-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">Refer Affiliates</h3>
                <p className="text-xs text-gray-600 mb-3">Build network • Earn 2% • Passive income</p>
                <button 
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="w-full bg-yellow-600 text-white py-2 rounded-md font-medium hover:bg-yellow-700 transition-colors text-sm"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact CTA Footer */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 py-10 border-t border-gray-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-yellow-700 transition-all text-sm"
              >
                Sign Up Free
              </button>
              <button 
                onClick={() => window.location.href = '/how-it-works'}
                className="border border-gray-400 bg-transparent text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-700 transition-all text-sm"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const AppWorking: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({ isOpen: false, mode: 'login' });
  const [showSimpleSignup, setShowSimpleSignup] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; product: any }>({ isOpen: false, product: null });

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

  return (
    <GlobalProvider>
      <AuthProvider>
        <CartProvider>
          <AffiliateProvider>
            <GamificationProvider>
              <Router>
              <ScrollToTop />
              <div className="min-h-screen bg-gray-50">
                <Header onOpenAuthModal={setAuthModal} />
                <UserSubHeader />
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage onOpenAuthModal={setAuthModal} />} />
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/testing" element={<TestingDashboard />} />
                    <Route path="/revolutionary" element={<RevolutionaryShowcaseSimple />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/fundraisers" element={<FundraisersPage />} />
                    <Route path="/fundraiser/:fundraiserId" element={<FundraiserDetailPage />} />
                    <Route path="/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/start-earning" element={<StartEarningPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setShowSimpleSignup(true)} />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/affiliates" element={<AffiliatePageNew />} />
                    <Route path="/affiliate/products" element={<AffiliateProductsPage />} />
                    <Route path="/affiliate/dashboard" element={<AffiliateDashboardPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/add-product" element={<AddProductPage />} />
                    <Route path="/dashboard-preview" element={<DashboardPreview />} />
                    <Route path="/affiliate-dashboard-preview" element={<AffiliateDashboardPreview />} />
                    <Route path="/buyer-dashboard-preview" element={<BuyerDashboardPreview />} />
                    <Route path="/store/:sellerId" element={<SellerStorePage />} />
                    <Route path="/affiliate/:affiliateId" element={<AffiliateStorePage />} />
                    <Route path="/dashboard/:role" element={<Dashboard />} />
                    <Route path="/dashboard/products/add" element={<ProductForm />} />
                    <Route path="/dashboard/products/edit/:id" element={<ProductForm editMode={true} />} />
                    <Route path="/dashboard/store-settings" element={<StoreSettingsRoute />} />
                    <Route path="/dashboard/integrations" element={<UniversalIntegrationsPage />} />
                    <Route path="/seller/products/new" element={<SellerProductFormPage />} />
                    <Route path="/profile" element={<ProfileCompletion />} />
                    <Route path="/earnings" element={<EarningsDashboard />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/faq" element={<FAQPage />} />
                    <Route path="/affiliate-guide" element={<AffiliateGuide />} />
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/platform" element={<AdminRoute><PlatformAdminDashboard /></AdminRoute>} />
                    <Route path="/admin/settings" element={<AdminRoute><PlatformSettings /></AdminRoute>} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/causes" element={<CausesPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<EnhancedCheckoutPage />} />
                    <Route path="/orders" element={<OrderManagement />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/contact-support" element={<ContactSupport />} />
                    <Route path="/write-review/:productId" element={<WriteReview />} />
                  </Routes>
                </main>

                {/* Footer */}
                <Footer />

                {/* <ChatBot /> */}

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
            </Router>
          </GamificationProvider>
        </AffiliateProvider>
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppWorking;
