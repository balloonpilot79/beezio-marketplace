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
import SellerProductFormPage from './pages/SellerProductFormPage';
import ProfileCompletion from './components/ProfileCompletion';
import TestingDashboard from './components/TestingDashboard';

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
        {/* Marketplace Header Banner */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-lg font-medium">🐝 Welcome to Beezio Marketplace</span>
                <span className="hidden sm:inline text-yellow-100">• Transparent pricing • Fair commissions</span>
              </div>
              <div className="text-sm">
                <span className="bg-white/20 px-3 py-1 rounded-full">Your Trusted Affiliate Platform</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Hero Section */}
        <div className="bg-white border-b border-gray-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
                Discover Amazing Products
              </h1>
              
              {/* Search Bar */}
              <div className="max-w-4xl mx-auto">
                <div className="flex">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search for products, brands, or categories..."
                      className="w-full px-6 py-4 text-lg border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <button className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-r-lg hover:from-yellow-600 hover:to-orange-600 transition-all font-semibold text-lg">
                    Search
                  </button>
                </div>
                
                {/* Category Menu Bar */}
                <div className="flex flex-wrap justify-center gap-6 mt-6 py-4 border-t border-gray-100">
                  {['All Products', 'Electronics', 'Fashion', 'Home & Garden', 'Books', 'Sports', 'Beauty', 'Health & Wellness', 'Technology', 'Arts & Crafts', 'Automotive', 'Pet Supplies', 'Toys & Games'].map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        if (category === 'All Products') {
                          window.location.href = '/marketplace';
                        } else {
                          window.location.href = `/marketplace?category=${encodeURIComponent(category)}`;
                        }
                      }}
                      className="text-gray-700 hover:text-yellow-600 hover:underline transition-colors font-medium cursor-pointer"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Proposition Hero */}
        <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border-y border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                The World's First <span className="text-blue-600">100% Transparent</span> Marketplace
              </h2>
              <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-8">
                Unlike Amazon, eBay, or other platforms that hide fees and take massive cuts, we show customers exactly where every dollar goes. 
                This breakthrough in transparency creates unprecedented trust and generates true recurring monthly income for affiliates.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-lg text-center border-l-4 border-blue-500">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">👁️</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Complete Transparency</h3>
                <p className="text-gray-600 text-sm">First platform ever to show customers the exact breakdown of where their money goes - no hidden fees or surprises</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg text-center border-l-4 border-green-500">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Recurring Revenue</h3>
                <p className="text-gray-600 text-sm">Affiliates earn every month customers stay active - build true wealth through recurring income, not just one-time commissions</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg text-center border-l-4 border-yellow-500">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Trust = More Sales</h3>
                <p className="text-gray-600 text-sm">When customers see transparency, they buy more. When affiliates see recurring income, they promote more. Everyone wins.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Why This Changes Everything</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-red-600 mb-2">❌ Traditional Platforms:</h4>
                  <ul className="text-gray-600 space-y-1 text-sm">
                    <li>• Hidden fees and surprise charges</li>
                    <li>• One-time commissions only</li>
                    <li>• Platform keeps most of the profit</li>
                    <li>• No transparency = customer distrust</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-green-600 mb-2">✅ Beezio Platform:</h4>
                  <ul className="text-green-700 space-y-1 text-sm">
                    <li>• Every fee shown upfront to customers</li>
                    <li>• Monthly recurring affiliate income</li>
                    <li>• Fair profit sharing for everyone</li>
                    <li>• Transparency builds customer loyalty</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg"
              >
                Start Earning Recurring Income
              </button>
              <button 
                onClick={() => window.location.href = '/how-it-works'}
                className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-all font-semibold border-2 border-blue-600"
              >
                See How It Works
              </button>
            </div>
          </div>
        </div>

        {/* Product Slider */}
        <ProductSlider />
        
        {/* Fundraiser Slider */}
        <FundraiserSlider />

        {/* Call to Action Section */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Start Your Journey?
            </h2>
            <p className="text-xl text-yellow-100 mb-8 max-w-2xl mx-auto">
              Join thousands of sellers and affiliates earning with complete transparency
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="group bg-white text-yellow-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-white/20 flex items-center justify-center"
              >
                <span className="mr-2">🚀</span>
                Start Selling Today
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="group border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1 shadow-xl hover:shadow-white/20 flex items-center justify-center"
              >
                <span className="mr-2">💰</span>
                Become an Affiliate
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
            
            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-12">
              <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-lg font-semibold text-white mb-2">Instant Setup</h3>
                <p className="text-white/80 text-sm">Launch your store in minutes</p>
              </div>
              <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="text-3xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold text-white mb-2">Smart Analytics</h3>
                <p className="text-white/80 text-sm">Track performance in real-time</p>
              </div>
              <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="text-3xl mb-3">💎</div>
                <h3 className="text-lg font-semibold text-white mb-2">Premium Support</h3>
                <p className="text-white/80 text-sm">24/7 expert assistance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof Stats */}
        <div className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Join the Transparency Revolution
              </h2>
              <p className="text-lg text-gray-600">
                Early adopters are already seeing unprecedented results
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">35+</div>
                <div className="text-gray-600 text-sm md:text-base">Sample Products</div>
                <div className="text-xs text-gray-500">Across 13 Categories</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">65%</div>
                <div className="text-gray-600 text-sm md:text-base">Max Commission</div>
                <div className="text-xs text-gray-500">Recurring Monthly</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-yellow-600 mb-2">100%</div>
                <div className="text-gray-600 text-sm md:text-base">Transparency</div>
                <div className="text-xs text-gray-500">No Hidden Fees</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">∞</div>
                <div className="text-gray-600 text-sm md:text-base">Growth Potential</div>
                <div className="text-xs text-gray-500">Unlimited Earnings</div>
              </div>
            </div>

            <div className="text-center mt-12">
              <div className="inline-flex items-center bg-blue-50 rounded-full px-6 py-3">
                <span className="text-blue-600 font-semibold">🚀 Pre-Launch Phase</span>
                <span className="ml-2 text-blue-500">• Get in early and dominate your niche</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Beezio is Revolutionary</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Three groundbreaking features that make us the most transparent and profitable marketplace ever created
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Transparent Pricing */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">👁️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">100% Transparent Pricing</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                First marketplace to show customers exactly where every dollar goes. No hidden fees, 
                complete transparency builds unprecedented trust and higher conversion rates.
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800">Coming Soon - Revolutionary Transparency</p>
              </div>
            </div>
            {/* Recurring Commissions */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Monthly Recurring Commissions</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Affiliates earn EVERY MONTH customers stay subscribed. Build true wealth through 
                recurring income instead of one-time payments like other platforms.
              </p>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800">Launching Soon - True Recurring Income</p>
              </div>
            </div>
            {/* Trust Architecture */}
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">⚡</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust-First Architecture</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Transparent pricing creates customer confidence, gamified affiliate system drives 
                engagement, and recurring payments ensure long-term relationships.
              </p>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-800">Launching Soon - Built for Trust & Transparency</p>
              </div>
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
