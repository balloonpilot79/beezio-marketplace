import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GlobalProvider } from './contexts/GlobalContext';
import { GamificationProvider } from './contexts/GamificationContext';
import MarketplacePage from './pages/MarketplacePageBeautiful';
import FundraisersPage from './pages/FundraisersPageBeautiful';
import SellerGuide from './pages/SellerGuide';
import AffiliateGuide from './pages/AffiliateGuide';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import EnhancedSellerDashboard from './components/EnhancedSellerDashboard';
import EnhancedAffiliateDashboard from './components/EnhancedAffiliateDashboard';
import EnhancedBuyerDashboard from './components/EnhancedBuyerDashboard';
import SellerStorePage from './pages/SellerStorePage';
import AffiliateStorePage from './pages/AffiliateStorePage';
import AuthModal from './components/AuthModal';
import ChatBot from './components/ChatBot';
import { SAMPLE_PRODUCTS } from './data/sampleProducts';
import { Star, Heart, Share2, Users, TrendingUp, Shield, Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';

// Professional Header component
const Header = () => {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleSignIn = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleGetStarted = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header */}
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-2xl font-bold text-amber-600">🐝 Beezio</Link>
              <nav className="hidden md:flex space-x-6">
                <Link to="/marketplace" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">Marketplace</Link>
                <Link to="/seller-guide" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">For Sellers</Link>
                <Link to="/affiliate-guide" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">For Affiliates</Link>
                <Link to="/fundraisers" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">Fundraisers</Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <button 
                  onClick={handleSignOut}
                  className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
                >
                  Sign Out
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleSignIn}
                    className="text-gray-700 hover:text-amber-600 transition-colors font-medium"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={handleGetStarted}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors font-medium"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-header with Dashboard Links (only when logged in) */}
          {user && (
            <div className="border-t border-gray-100">
              <div className="flex items-center justify-between py-2 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-500 font-medium hidden sm:inline">Dashboards:</span>
                  <Link to="/seller-dashboard" className="text-gray-600 hover:text-amber-600 transition-colors font-medium whitespace-nowrap">
                    🏪 Seller
                  </Link>
                  <Link to="/affiliate-dashboard" className="text-gray-600 hover:text-amber-600 transition-colors font-medium whitespace-nowrap">
                    🤝 Affiliate
                  </Link>
                  <Link to="/buyer-dashboard" className="text-gray-600 hover:text-amber-600 transition-colors font-medium whitespace-nowrap">
                    🛒 Buyer
                  </Link>
                </div>
                <span className="text-sm text-gray-600 font-medium hidden md:inline">
                  Welcome, {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}! 👋
                </span>
              </div>
            </div>
          )}
        </div>
      </header>
      
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
      />
    </>
  );
};

// Feature Cards Component
const FeatureCards = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Three Ways to Succeed with Beezio
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Whether you're selling products, promoting them, or supporting causes, we've got you covered
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Seller Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">For Sellers</h3>
          <p className="text-gray-600 mb-6">
            List your products with transparent pricing and fair commission structures. Reach a wider audience through our affiliate network.
          </p>
          <ul className="text-sm text-gray-600 space-y-2 mb-8">
            <li>• Easy product listing</li>
            <li>• Built-in affiliate network</li>
            <li>• Real-time analytics</li>
            <li>• Secure payments</li>
          </ul>
          <Link to="/sellers" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Start Selling
          </Link>
        </div>

        {/* Affiliate Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">For Affiliates</h3>
          <p className="text-gray-600 mb-6">
            Promote quality products and earn competitive commissions. Access marketing materials and track your performance.
          </p>
          <ul className="text-sm text-gray-600 space-y-2 mb-8">
            <li>• High-quality products</li>
            <li>• Competitive commissions</li>
            <li>• Marketing resources</li>
            <li>• Performance tracking</li>
          </ul>
          <Link to="/affiliates" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
            Join as Affiliate
          </Link>
        </div>

        {/* Buyer Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">For Buyers</h3>
          <p className="text-gray-600 mb-6">
            Discover amazing products with transparent pricing. Support your favorite creators and causes with every purchase.
          </p>
          <ul className="text-sm text-gray-600 space-y-2 mb-8">
            <li>• Transparent pricing</li>
            <li>• Quality guarantee</li>
            <li>• Support creators</li>
            <li>• Secure shopping</li>
          </ul>
          <Link to="/marketplace" className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
            Start Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

// Featured Products Component
const FeaturedProducts = () => {
  const featuredProducts = SAMPLE_PRODUCTS.slice(0, 6);

  return (
    <div className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Products
          </h2>
          <p className="text-xl text-gray-600">
            Discover trending products from our trusted sellers
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
              <div className="aspect-w-16 aspect-h-12 bg-gray-200">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">
                    {product.commission_rate}% Commission
                  </span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{product.rating}</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {product.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">${product.price}</span>
                    <p className="text-xs text-gray-500">by {product.seller}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Heart className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link 
            to="/marketplace" 
            className="bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition-colors font-semibold"
          >
            View All Products
          </Link>
        </div>
      </div>
    </div>
  );
};

// Fundraiser Section Component
const FundraiserSection = () => {
  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Support Causes That Matter
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Our fundraiser platform connects supporters with meaningful causes. Every purchase can make a difference.
            </p>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Create or Support</h4>
                  <p className="text-gray-600">Launch your own fundraiser or support existing causes</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Shop with Purpose</h4>
                  <p className="text-gray-600">A portion of every purchase goes to your chosen cause</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Track Impact</h4>
                  <p className="text-gray-600">See exactly how your contributions are making a difference</p>
                </div>
              </div>
            </div>

            <Link 
              to="/fundraisers" 
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Explore Fundraisers
            </Link>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">❤️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Every Purchase Count</h3>
              <p className="text-gray-600 mb-6">
                Join our community of changemakers making a real difference with their purchases
              </p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">100%</div>
                  <div className="text-sm text-gray-600">Transparent Impact</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">Every</div>
                  <div className="text-sm text-gray-600">Purchase Matters</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Social Media Footer Component
const SocialFooter = () => {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <span className="text-3xl font-bold text-amber-500">🐝 Beezio</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              The world's first 100% transparent marketplace connecting sellers, affiliates, and buyers in a fair and sustainable ecosystem.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/marketplace" className="text-gray-300 hover:text-white transition-colors">Marketplace</Link></li>
              <li><Link to="/sellers" className="text-gray-300 hover:text-white transition-colors">For Sellers</Link></li>
              <li><Link to="/affiliates" className="text-gray-300 hover:text-white transition-colors">For Affiliates</Link></li>
              <li><Link to="/fundraisers" className="text-gray-300 hover:text-white transition-colors">Fundraisers</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2">
              {/* <li><Link to="/help" className="text-gray-300 hover:text-white transition-colors">Help Center</Link></li> */}
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-gray-300 hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 mt-8 text-center">
          <p className="text-gray-400">© 2025 Beezio. All rights reserved. Built for transparency and fairness.</p>
        </div>
      </div>
    </footer>
  );
};

// Main HomePage component
const HomePage = () => {
  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            The Transparent <span className="text-amber-600">Marketplace</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
            Connect sellers, affiliates, and buyers in a fair ecosystem where everyone wins. 100% transparent pricing, competitive commissions, quality products.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/marketplace" 
              className="bg-amber-600 text-white px-8 py-4 rounded-lg hover:bg-amber-700 transition-colors font-semibold text-lg"
            >
              Start Shopping
            </Link>
            <Link 
              to="/seller-dashboard" 
              className="bg-white text-amber-600 border-2 border-amber-600 px-8 py-4 rounded-lg hover:bg-amber-50 transition-colors font-semibold text-lg"
            >
              Become a Seller
            </Link>
            <Link 
              to="/affiliate-dashboard" 
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all font-semibold text-lg"
            >
              Become an Affiliate
            </Link>
          </div>
        </div>
      </div>

      <FeatureCards />
      <FeaturedProducts />
      <FundraiserSection />
      <SocialFooter />
    </>
  );
};

const AppProductionReady = () => {
  return (
    <GlobalProvider>
      <AuthProvider>
        <AffiliateProvider>
          <GamificationProvider>
            <Router>
              <div className="min-h-screen bg-white">
                <Header />
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/marketplace" element={<MarketplacePage />} />
                  <Route path="/seller-guide" element={<SellerGuide />} />
                  <Route path="/affiliate-guide" element={<AffiliateGuide />} />
                  <Route path="/fundraisers" element={<FundraisersPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/seller-dashboard" element={<EnhancedSellerDashboard />} />
                  <Route path="/affiliate-dashboard" element={<EnhancedAffiliateDashboard />} />
                  <Route path="/buyer-dashboard" element={<EnhancedBuyerDashboard />} />
                  <Route path="/store/:sellerId" element={<SellerStorePage />} />
                  <Route path="/affiliate/:affiliateId" element={<AffiliateStorePage />} />
                </Routes>
                <ChatBot />
              </div>
            </Router>
          </GamificationProvider>
        </AffiliateProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppProductionReady;
