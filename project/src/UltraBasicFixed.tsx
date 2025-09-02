import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { GlobalProvider } from './contexts/GlobalContext';
import { GamificationProvider } from './contexts/GamificationContext';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import PaymentForm from './components/PaymentForm';
import ProductForm from './components/ProductForm';
import HowItWorksPage from './pages/HowItWorksPage';
import SellersPage from './pages/SellersPage';
import AffiliatePageNew from './pages/AffiliatePageNew';
import ProductDetailPage from './pages/ProductDetailPage';
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
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import EarningsDashboard from './components/EarningsDashboard';
import PlatformAdminDashboard from './components/PlatformAdminDashboard';
import StoreCustomization from './components/StoreCustomization';
import UniversalIntegrationsPage from './components/UniversalIntegrationsPage';
import OrderManagement from './components/OrderManagement';
import ChatBot from './components/ChatBot';
import RevolutionaryShowcaseSimple from './components/RevolutionaryShowcaseSimple';
import TestPage from './components/TestPage';

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
  return <StoreCustomization sellerId={profile.id || 'default'} />;
};

// Beautiful Home Page Component
interface HomePageProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              🐝 BEEZIO
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              The World's First <span className="font-bold">Transparent Commission</span> Marketplace
            </p>
            <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
              A pricing model where everyone wins: sellers get 100% of their desired price, 
              affiliates earn generous commissions, and customers see exactly where every dollar goes.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
              >
                Start Selling
              </button>
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors"
              >
                Become an Affiliate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Beezio Works</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Three groundbreaking features that make us the most transparent and profitable marketplace ever created
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Transparent Pricing */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Transparent Pricing</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Show customers exactly where every dollar goes. No hidden fees, 
              complete transparency builds trust and higher conversion rates.
            </p>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-800">Result: Higher conversion rates</p>
            </div>
          </div>

          {/* Recurring Commissions */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Monthly Commissions</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Affiliates earn every month customers stay subscribed. Build wealth through 
              recurring income instead of one-time payments.
            </p>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800">More affiliate income</p>
            </div>
          </div>

          {/* Trust Architecture */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust-First Platform</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Transparent pricing creates customer confidence, affiliate system drives 
              engagement, and recurring payments ensure long-term relationships.
            </p>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-purple-800">High customer satisfaction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2">100%</div>
              <div className="text-gray-300">Transparent Pricing</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Monthly</div>
              <div className="text-gray-300">Affiliate Income</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Higher</div>
              <div className="text-gray-300">Conversions</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Trust</div>
              <div className="text-gray-300">Customer Focus</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppWorking: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({ isOpen: false, mode: 'login' });
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
          <GamificationProvider>
            <Router>
              <div className="min-h-screen bg-gray-50">
                <Header onOpenAuthModal={setAuthModal} />
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <Routes>
                    <Route path="/" element={<HomePage onOpenAuthModal={setAuthModal} />} />
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/revolutionary" element={<RevolutionaryShowcaseSimple />} />
                    <Route path="/products" element={<MarketplacePage />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/fundraisers" element={<FundraisersPage />} />
                    <Route path="/fundraiser/:fundraiserId" element={<FundraiserDetailPage />} />
                    <Route path="/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/affiliates" element={<AffiliatePageNew />} />
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
                    <Route path="/earnings" element={<EarningsDashboard />} />
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/platform" element={<AdminRoute><PlatformAdminDashboard /></AdminRoute>} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/causes" element={<CausesPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/orders" element={<OrderManagement />} />
                    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                  </Routes>
                </main>

                <ChatBot />

                {/* Auth Modal */}
                <AuthModal
                  isOpen={authModal.isOpen}
                  mode={authModal.mode}
                  onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
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
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppWorking;
