import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
// import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthProvider as AuthProviderMultiRole, useAuth as useAuthMultiRole } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { GlobalProvider } from './contexts/GlobalContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GamificationProvider } from './contexts/GamificationContext';
import MarketplacePage from './pages/MarketplacePageSimple';
import ProductDetailPage from './pages/ProductDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import ServicesPage from './pages/ServicesPage';
import SellersPage from './pages/SellersPage';
import AffiliateProductsPage from './pages/AffiliateProductsPage';
import SellerProductsPage from './pages/SellerProductsPage';
import SellerProductFormPage from './pages/SellerProductFormPage';
import AffiliateGuide from './pages/AffiliateGuide';
import AutomationPage from './pages/AutomationPage';
import Dashboard from './components/Dashboard';
import UnifiedDashboard from './components/UnifiedDashboard';
import DashboardTest from './components/DashboardTest';
import ProfileSetup from './components/ProfileSetup';
import UserSubHeader from './components/UserSubHeader';
import AuthModal from './components/AuthModal';
import SimpleSignupModal from './components/SimpleSignupModal';
import AutomationBanner from './components/AutomationBanner';

function App() {
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
  }>({
    isOpen: false,
    mode: 'login',
  });

  // State for new simplified signup modal
  const [simpleSignupModal, setSimpleSignupModal] = useState(false);

  return (
    <GlobalProvider>
      {/* Use MultiRole Auth Provider for new unified system */}
      <AuthProviderMultiRole>
        <CartProvider>
          <GamificationProvider>
            <AffiliateProvider>
              <Router>
              <div className="min-h-screen bg-gray-50">
                <Header 
                  onOpenAuthModal={setAuthModal}
                  onOpenSimpleSignup={() => setSimpleSignupModal(true)}
                />
                <UserSubHeader />
                <main>
                  <Routes>
                    <Route path="/" element={<HomePage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setSimpleSignupModal(true)} />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/services" element={<ServicesPage />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/affiliate-guide" element={<AffiliateGuide />} />
                    <Route path="/automation" element={<AutomationPage />} />
                    <Route path="/product/:productId" element={<ProductDetailPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/dashboard" element={<UnifiedDashboard />} />
                    <Route path="/legacy-dashboard" element={<Dashboard />} />
                    <Route path="/dashboard-test" element={<DashboardTest />} />
                    <Route path="/complete-profile" element={<ProfileSetup />} />
                    <Route path="/affiliate/products" element={<AffiliateProductsPage />} />
                    <Route path="/seller/products" element={<SellerProductsPage />} />
                    <Route path="/seller/products/new" element={<SellerProductFormPage />} />
                    <Route path="/how-it-works" element={<HowItWorksPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setSimpleSignupModal(true)} />} />
                    <Route path="/start-earning" element={<StartEarningPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setSimpleSignupModal(true)} />} />
                    <Route path="/pricing" element={<PricingPage onOpenAuthModal={setAuthModal} onOpenSimpleSignup={() => setSimpleSignupModal(true)} />} />
                  </Routes>
                </main>
                
                {/* Legacy Auth Modal */}
                {authModal.isOpen && (
                  <AuthModal
                    isOpen={authModal.isOpen}
                    onClose={() => setAuthModal({ ...authModal, isOpen: false })}
                    mode={authModal.mode}
                  />
                )}

                {/* New Simple Signup Modal */}
                {simpleSignupModal && (
                  <SimpleSignupModal
                    isOpen={simpleSignupModal}
                    onClose={() => setSimpleSignupModal(false)}
                    onSuccess={() => console.log('Signup success!')}
                  />
                )}
              </div>
            </Router>
            </AffiliateProvider>
          </GamificationProvider>
        </CartProvider>
      </AuthProviderMultiRole>
    </GlobalProvider>
  );
}

interface HeaderProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const { user, signOut } = useAuthMultiRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      // setUserMenuOpen(false); // removed unused state
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-2xl">🐝</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Beezio</span>
          </Link>

          {/* Navigation - Fixed/Locked Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/marketplace" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Marketplace
            </Link>
            <Link to="/services" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Services
            </Link>
            <Link to="/how-it-works" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              How It Works
            </Link>
            <Link to="/automation" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              🚀 Free Automation
            </Link>
            <Link to="/start-earning" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Start Earning
            </Link>
            <Link to="/pricing" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
              Pricing
            </Link>
            {user && (
              <Link to="/dashboard" className="text-gray-700 hover:text-purple-600 font-medium transition-colors">
                Dashboard
              </Link>
            )}
          </nav>

          {/* Mobile Navigation Menu */}
          <div className="md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-500 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-purple-600 font-medium">Welcome back!</span>
                <Link 
                  to="/dashboard" 
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg transform hover:scale-105"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="text-purple-700 hover:text-purple-800 font-medium transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={onOpenSimpleSignup}
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-6 py-2 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
                >
                  🚀 Join Beezio
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-3">
              {/* Main Navigation Dropdown */}
              <details className="mb-2">
                <summary className="font-bold text-purple-700 py-2 cursor-pointer">Main Menu</summary>
                <div className="pl-4">
                  <Link to="/marketplace" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Marketplace</Link>
                  <Link to="/services" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Services</Link>
                  <Link to="/how-it-works" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
                  <Link to="/automation" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>🚀 Free Automation</Link>
                  <Link to="/start-earning" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Start Earning</Link>
                  <Link to="/pricing" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
                </div>
              </details>
              {user && (
                <>
                  {/* Quick Actions for Mobile: Shop and Sell */}
                  <details className="mb-2">
                    <summary className="font-bold text-green-700 py-2 cursor-pointer">Quick Actions</summary>
                    <div className="pl-4">
                      <Link to="/marketplace" className="block text-white bg-gradient-to-r from-green-400 to-blue-500 font-bold py-2 px-4 rounded-lg shadow mb-2 text-center hover:from-green-500 hover:to-blue-600" onClick={() => setMobileMenuOpen(false)}>🛒 Shop Products</Link>
                      <Link to="/dashboard/products/add" className="block text-white bg-gradient-to-r from-yellow-400 to-orange-500 font-bold py-2 px-4 rounded-lg shadow mb-4 text-center hover:from-yellow-500 hover:to-orange-600" onClick={() => setMobileMenuOpen(false)}>➕ Sell a Product</Link>
                    </div>
                  </details>
                  {/* Role Dashboards Dropdown */}
                  <details>
                    <summary className="font-bold text-blue-700 py-2 cursor-pointer">Dashboards</summary>
                    <div className="pl-4">
                      <Link to="/dashboard" className="block text-gray-700 hover:text-purple-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                      <Link to="/dashboard/seller" className="block text-gray-700 hover:text-yellow-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Seller Dashboard</Link>
                      <Link to="/dashboard/affiliate" className="block text-gray-700 hover:text-green-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Affiliate Dashboard</Link>
                      <Link to="/dashboard/buyer" className="block text-gray-700 hover:text-blue-600 font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Buyer Dashboard</Link>
                    </div>
                  </details>
                </>
              )}
              {!user && (
                <details>
                  <summary className="font-bold text-purple-700 py-2 cursor-pointer">Account</summary>
                  <div className="pl-4 pt-2 space-y-2">
                    <button onClick={() => { onOpenAuthModal({ isOpen: true, mode: 'login' }); setMobileMenuOpen(false); }} className="block w-full text-left text-gray-700 hover:text-purple-600 font-medium py-2">Login</button>
                    <button onClick={() => { onOpenAuthModal({ isOpen: true, mode: 'register' }); setMobileMenuOpen(false); }} className="block w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-center">Sign Up</button>
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

interface HomePageProps {
  onOpenSimpleSignup?: () => void;
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-transparent to-yellow-400/5"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-yellow-400/10 to-orange-400/10 rounded-full -translate-y-48 translate-x-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-400/10 to-indigo-400/10 rounded-full translate-y-32 -translate-x-32"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center">
            <div className="animate-fadeInUp">
              {/* Bee icon */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full shadow-2xl mb-8">
                <span className="text-4xl">🐝</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-display font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
                  Buzz Into Savings,
                </span>
                <br />
                <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                  Earn With Every Sale
                </span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-purple-700 mb-4 max-w-4xl mx-auto leading-relaxed font-medium">
                🛍️ Shop Local • 💰 Earn Rewards • 🤝 Build Community
              </p>
              <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
                Where sellers, affiliates, buyers, and fundraisers all thrive together in the Beezio hive
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button 
                  onClick={onOpenSimpleSignup}
                  className="bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 hover:from-yellow-500 hover:via-orange-500 hover:to-orange-600 text-black px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl transform hover:scale-105 hover:shadow-orange-400/25"
                >
                  🚀 Start Earning Today
                </button>
                <Link 
                  to="/marketplace"
                  className="bg-white/80 backdrop-blur-sm hover:bg-white text-purple-700 border-2 border-purple-200 hover:border-purple-300 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg transform hover:scale-105"
                >
                  🛍️ Explore Marketplace
                </Link>
              </div>
              
              {/* What Beezio Is All About */}
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl max-w-6xl mx-auto border border-purple-100">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-3xl">🏪</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Sellers Profit</h4>
                    <p className="text-sm text-gray-600">Printful, Printify, Shopify integration</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-3xl">🤝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Affiliates Earn</h4>
                    <p className="text-sm text-gray-600">Up to 50% commissions + cashback</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-3xl">💝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Fundraisers Raise</h4>
                    <p className="text-sm text-gray-600">Commerce-powered fundraising</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-3xl">🛒</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Buyers Save</h4>
                    <p className="text-sm text-gray-600">Discounts while supporting causes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Free Automation Banner */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AutomationBanner
            variant="top"
            onDismiss={() => console.log('Banner dismissed')}
            className="mb-8"
          />
        </div>
      </section>

      {/* What Makes Beezio Different */}
      <section className="py-20 bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full shadow-xl mb-6">
              <span className="text-3xl">🌟</span>
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              What Makes Beezio Different?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Unlike other platforms that only serve one type of user, Beezio is designed for everyone to succeed together
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl">🏪</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-purple-800">Sellers Make Money</h3>
              <p className="text-gray-600">Integrate Printful, Printify, import Shopify stores, or sell anything. Keep 100% of your listed prices.</p>
            </div>
            
            <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-purple-800">Affiliates Earn Big</h3>
              <p className="text-gray-600">Earn 10-50% commissions. Buy products and get your commission back - making everything cheaper.</p>
            </div>
            
            <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl">💝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-purple-800">Fundraisers Powered by Commerce</h3>
              <p className="text-gray-600">Raise money by promoting products instead of just asking for donations. Commission goes to your cause.</p>
            </div>
            
            <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-3xl">🛒</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-purple-800">Buyers Save Money</h3>
              <p className="text-gray-600">Buy through affiliate links and get cashback. Support causes while shopping smart.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 text-white relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-400/10 rounded-full translate-y-24 -translate-x-24"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full shadow-2xl mb-6">
              <span className="text-3xl">🛍️</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Shop Featured Products
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Discover amazing products from our community of sellers and earn rewards through our affiliate program
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Featured Product 1 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300 group border border-white/20">
              <div className="relative h-48 bg-gradient-to-br from-blue-400/20 to-purple-500/20 overflow-hidden">
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    🔥 Best Seller
                  </span>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    25% Commission
                  </span>
                </div>
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white text-4xl">📱</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-white mb-2">Premium Wireless Headphones</h3>
                <p className="text-purple-200 text-sm mb-4">High-quality wireless headphones with noise cancellation</p>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-white">$199.99</span>
                    <span className="text-lg text-purple-300 line-through">$249.99</span>
                  </div>
                  <div className="flex items-center text-yellow-400">
                    <span className="text-sm">⭐ 4.8 (127)</span>
                  </div>
                </div>
                <Link 
                  to="/marketplace"
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-center font-bold transform hover:scale-105 shadow-lg"
                >
                  🛒 Shop Now
                </Link>
              </div>
            </div>

            {/* Featured Product 2 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300 group border border-white/20">
              <div className="relative h-48 bg-gradient-to-br from-pink-400/20 to-rose-500/20 overflow-hidden">
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    ⭐ Top Rated
                  </span>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    30% Commission
                  </span>
                </div>
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <span className="text-white text-4xl">✨</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-white mb-2">Organic Skincare Set</h3>
                <p className="text-purple-200 text-sm mb-4">Complete organic skincare routine for all skin types</p>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-white">$89.99</span>
                    <span className="text-lg text-purple-300 line-through">$119.99</span>
                  </div>
                  <div className="flex items-center text-yellow-400">
                    <span className="text-sm">⭐ 4.9 (89)</span>
                  </div>
                </div>
                <Link 
                  to="/marketplace"
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-center font-bold transform hover:scale-105 shadow-lg"
                >
                  🛒 Shop Now
                </Link>
              </div>
            </div>

            {/* Featured Product 3 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300 group border border-white/20">
              <div className="relative h-48 bg-gradient-to-br from-green-400/20 to-emerald-500/20 overflow-hidden">
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    🆕 New Arrival
                  </span>
                </div>
                <div className="absolute top-4 right-4 z-10">
                  <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    20% Commission
                  </span>
                </div>
                <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-white text-4xl">⌚</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-white mb-2">Smart Fitness Tracker</h3>
                <p className="text-purple-200 text-sm mb-4">Advanced fitness tracking with heart rate monitoring</p>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-white">$149.99</span>
                    <span className="text-lg text-purple-300 line-through">$199.99</span>
                  </div>
                  <div className="flex items-center text-yellow-400">
                    <span className="text-sm">⭐ 4.7 (203)</span>
                  </div>
                </div>
                <Link 
                  to="/marketplace"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                >
                  Shop Now
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link 
              to="/marketplace"
              className="inline-flex items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              View All Products
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Bee-Themed CTA Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 text-6xl opacity-10">🐝</div>
          <div className="absolute top-20 right-20 text-4xl opacity-10">🐝</div>
          <div className="absolute bottom-20 left-20 text-5xl opacity-10">🐝</div>
          <div className="absolute bottom-10 right-10 text-3xl opacity-10">🐝</div>
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="mb-6">
            <span className="text-6xl mb-4 block">🐝</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Ready to Join the Beezio Hive?
            </h2>
          </div>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
            Buzz into success with our thriving marketplace! Earn up to 50% commission as an affiliate, 
            or showcase your products to thousands of eager buyers. The hive is waiting for you! 🍯
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={onOpenSimpleSignup}
                className="group bg-gradient-to-r from-yellow-400 to-orange-400 text-purple-800 hover:from-yellow-300 hover:to-orange-300 font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-300 transform hover:-translate-y-1 shadow-2xl hover:shadow-yellow-400/25 flex items-center justify-center"
              >
                <span className="mr-2">🚀</span>
                Become an Affiliate
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button 
                onClick={onOpenSimpleSignup}
                className="group backdrop-blur border-2 border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-2xl text-lg transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-white/20 flex items-center justify-center"
              >
                <span className="mr-2">🛍️</span>
                Start Selling Products
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-lg font-semibold text-white mb-2">High Commissions</h3>
              <p className="text-white/80 text-sm">Earn up to 50% on every sale</p>
            </div>
            <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-white mb-2">Instant Payments</h3>
              <p className="text-white/80 text-sm">Get paid weekly, no delays</p>
            </div>
            <div className="backdrop-blur bg-white/10 rounded-2xl p-6 border border-white/20">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold text-white mb-2">Easy Marketing</h3>
              <p className="text-white/80 text-sm">Powerful tools & analytics</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const HowItWorksPage: React.FC<HomePageProps> = ({ onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">How Beezio Works</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Beezio is the only platform where sellers, affiliates, buyers, and fundraisers all win together
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-3xl">🏪</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Sellers</h3>
            <ul className="space-y-3 text-gray-600">
              <li>• Connect Printful, Printify, or Shopify stores</li>
              <li>• List any product or service</li>
              <li>• Keep 100% of your listed price</li>
              <li>• Get promoted by thousands of affiliates</li>
              <li>• Built-in payment processing</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-3xl">🤝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Affiliates</h3>
            <ul className="space-y-3 text-gray-600">
              <li>• Earn 10-50% commission on every sale</li>
              <li>• Buy products and get your commission back</li>
              <li>• Share custom affiliate links</li>
              <li>• Track earnings in real-time</li>
              <li>• Weekly payouts via Stripe</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-3xl">💝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Fundraisers</h3>
            <ul className="space-y-3 text-gray-600">
              <li>• Sell products to raise money for causes</li>
              <li>• Commission goes to your fundraising goal</li>
              <li>• Keep 100% of your product price</li>
              <li>• Share links to earn donations via sales</li>
              <li>• Track progress and earnings</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-3xl">🛒</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Buyers</h3>
            <ul className="space-y-3 text-gray-600">
              <li>• Get discounts through affiliate links</li>
              <li>• Support causes while shopping</li>
              <li>• Discover unique products</li>
              <li>• Secure payment processing</li>
              <li>• Customer support included</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Get Started?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={onOpenSimpleSignup}
              className="bg-purple-600 text-white px-8 py-4 rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
            >
              Join Beezio Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StartEarningPage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">Start Making Money Today</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose your path to financial freedom on Beezio
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏪</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Become a Seller</h3>
            <p className="text-gray-600 mb-6">Start selling your products or services and keep 100% of your listed price</p>
            <ul className="text-left space-y-2 mb-8 text-gray-600">
              <li>✓ No monthly fees</li>
              <li>✓ Easy product listing</li>
              <li>✓ Affiliate network included</li>
              <li>✓ Built-in payments</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Selling
            </button>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-xl text-center border-2 border-purple-200">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🤝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Become an Affiliate</h3>
            <p className="text-gray-600 mb-6">Earn up to 50% commission promoting products you love</p>
            <ul className="text-left space-y-2 mb-8 text-gray-600">
              <li>✓ No experience needed</li>
              <li>✓ Thousands of products</li>
              <li>✓ Weekly payouts</li>
              <li>✓ Buy & get cashback</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Start Earning
            </button>
            <div className="mt-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium">
              Most Popular Choice
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">💝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Start Fundraising</h3>
            <p className="text-gray-600 mb-6">Raise money by promoting products - commission goes to your cause instead of you</p>
            <ul className="text-left space-y-2 mb-8 text-gray-600">
              <li>✓ Higher success rates than donations</li>
              <li>✓ Commission goes to your fundraiser</li>
              <li>✓ People get value for their money</li>
              <li>✓ Easy sharing tools</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Start Fundraising
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-12 shadow-xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Choose Beezio?</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
              <p className="text-gray-600">You keep of your price</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">50%</div>
              <p className="text-gray-600">Max affiliate commission</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">$0</div>
              <p className="text-gray-600">Fees deducted from you</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">24/7</div>
              <p className="text-gray-600">Customer support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PricingPage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            No fees deducted from you. Beezio adds fees on top of your prices so everyone gets exactly what they expect.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Sellers */}
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏪</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Sellers</h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">FREE</div>
            <p className="text-gray-600 mb-6">Keep 100% of your price</p>
            <ul className="text-left space-y-3 mb-8 text-gray-600">
              <li>✓ Keep 100% of your listed price</li>
              <li>✓ No fees deducted from you</li>
              <li>✓ No monthly fees</li>
              <li>✓ No setup costs</li>
              <li>✓ Free affiliate network</li>
              <li>✓ Built-in payment processing</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Selling Free
            </button>
          </div>

          {/* Affiliates */}
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center border-2 border-green-200">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🤝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Affiliates</h3>
            <div className="text-4xl font-bold text-green-600 mb-2">FREE</div>
            <p className="text-gray-600 mb-6">Always free to join</p>
            <ul className="text-left space-y-3 mb-8 text-gray-600">
              <li>✓ Earn 10-50% commission</li>
              <li>✓ No fees ever</li>
              <li>✓ Weekly payouts</li>
              <li>✓ Get cashback on purchases</li>
              <li>✓ Real-time analytics</li>
              <li>✓ Custom affiliate links</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Join Free
            </button>
            <div className="mt-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium">
              Most Popular
            </div>
          </div>

          {/* Fundraisers */}
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">💝</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Fundraisers</h3>
            <div className="text-4xl font-bold text-purple-600 mb-2">FREE</div>
            <p className="text-gray-600 mb-6">Keep 100% of proceeds</p>
            <ul className="text-left space-y-3 mb-8 text-gray-600">
              <li>✓ Keep 100% of fundraising goal</li>
              <li>✓ No fees deducted from you</li>
              <li>✓ No upfront costs</li>
              <li>✓ Higher success rates</li>
              <li>✓ Easy sharing tools</li>
              <li>✓ Progress tracking</li>
            </ul>
            <button 
              onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Start Fundraising
            </button>
          </div>
        </div>

        {/* How Pricing Works */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">How Our Pricing Works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">💰 Example: $100 Product Sale</h3>
              <div className="bg-white rounded-lg p-6 shadow-lg">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Your Listed Price:</span>
                    <span className="font-bold text-green-600">$100.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>+ Beezio Fee (10%):</span>
                    <span>$10.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>+ Affiliate/Fundraiser (20%):</span>
                    <span>$20.00</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>+ Stripe Processing (3%):</span>
                    <span>$3.90</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-bold">
                    <span>Customer Pays:</span>
                    <span>$133.90</span>
                  </div>
                  <div className="flex justify-between font-bold text-green-600">
                    <span>You Receive:</span>
                    <span>$100.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-purple-600">
                    <span>Affiliate/Fundraiser Gets:</span>
                    <span>$20.00</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">✨ The Beezio Advantage</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <span><strong>Sellers get exactly what they price:</strong> Set $100, receive $100</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <span><strong>Affiliates earn full commission:</strong> No hidden deductions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-3">✓</span>
                  <span><strong>Fundraisers raise money via commerce:</strong> Commission goes to their cause</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-3">✓</span>
                  <span><strong>Customers know total upfront:</strong> Transparent pricing at checkout</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="bg-white rounded-2xl p-12 shadow-xl mb-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Compare to Others</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-4 px-6">Feature</th>
                  <th className="py-4 px-6 text-purple-600 font-bold">Beezio</th>
                  <th className="py-4 px-6 text-gray-500">Shopify</th>
                  <th className="py-4 px-6 text-gray-500">Etsy</th>
                  <th className="py-4 px-6 text-gray-500">Amazon</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-6">Monthly Fee</td>
                  <td className="py-4 px-6 text-green-600 font-bold">$0</td>
                  <td className="py-4 px-6">$29+</td>
                  <td className="py-4 px-6">$0</td>
                  <td className="py-4 px-6">$39.99</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6">Seller Keeps</td>
                  <td className="py-4 px-6 text-green-600 font-bold">100% of listed price</td>
                  <td className="py-4 px-6">~97% after fees</td>
                  <td className="py-4 px-6">~93.5% after fees</td>
                  <td className="py-4 px-6">~85-92% after fees</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6">Who Pays Fees</td>
                  <td className="py-4 px-6 text-green-600 font-bold">Customer (transparent)</td>
                  <td className="py-4 px-6">Seller (deducted)</td>
                  <td className="py-4 px-6">Seller (deducted)</td>
                  <td className="py-4 px-6">Seller (deducted)</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6">Built-in Affiliates</td>
                  <td className="py-4 px-6 text-green-600 font-bold">✓ Free</td>
                  <td className="py-4 px-6">✗ Extra cost</td>
                  <td className="py-4 px-6">✗ No</td>
                  <td className="py-4 px-6">✓ Limited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-6">Fundraising Tools</td>
                  <td className="py-4 px-6 text-green-600 font-bold">✓ Built-in</td>
                  <td className="py-4 px-6">✗ No</td>
                  <td className="py-4 px-6">✗ No</td>
                  <td className="py-4 px-6">✗ No</td>
                </tr>
                <tr>
                  <td className="py-4 px-6">Setup Time</td>
                  <td className="py-4 px-6 text-green-600 font-bold">5 minutes</td>
                  <td className="py-4 px-6">1-2 hours</td>
                  <td className="py-4 px-6">30 minutes</td>
                  <td className="py-4 px-6">1-2 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-gray-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">How does the pricing work?</h3>
              <p className="text-gray-600 mb-6">You set your price and receive exactly that amount. Beezio adds 10% + affiliate commission + 3% Stripe fee on top, which the customer pays transparently.</p>
              
              <h3 className="font-bold text-gray-900 mb-2">Do I pay any fees?</h3>
              <p className="text-gray-600 mb-6">No! Sellers, affiliates, and fundraisers never pay fees. All fees are added on top and paid by the customer with full transparency.</p>
              
              <h3 className="font-bold text-gray-900 mb-2">How do payouts work?</h3>
              <p className="text-gray-600">Weekly automatic payouts via Stripe. You receive exactly your listed price. Minimum payout is $25.</p>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600 mb-6">Yes! Since there are no monthly fees, you can stop using Beezio anytime without penalties.</p>
              
              <h3 className="font-bold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600 mb-6">All major credit cards, debit cards, and digital wallets via Stripe.</p>
              
              <h3 className="font-bold text-gray-900 mb-2">Is there customer support?</h3>
              <p className="text-gray-600">Yes! 24/7 email support and live chat during business hours.</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-600 mb-8">Join the platform where everyone wins</p>
          <button 
            onClick={() => onOpenAuthModal?.({ isOpen: true, mode: 'register' })}
            className="bg-purple-600 text-white px-8 py-4 rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
          >
            Start Free Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;