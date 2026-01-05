import React from 'react';
import { Br            <nav className="hidden md:flex space-x-8">
              <a href="/" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Home</a>
              <a href="/products" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Products</a>
              <a href="/fundraisers" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Fundraisers</a>
              <a href="/seller-dashboard" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Seller Dashboard</a>
              <a href="/affiliate-dashboard" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Affiliate Dashboard</a>
              <a href="/buyer-dashboard" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Buyer Dashboard</a>
            </nav>Router as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { GlobalProvider } from './contexts/GlobalContext';
import EnhancedSellerDashboard from './components/EnhancedSellerDashboard';
import EnhancedAffiliateDashboard from './components/EnhancedAffiliateDashboard';
import EnhancedBuyerDashboard from './components/EnhancedBuyerDashboard';

const SimpleWorkingApp: React.FC = () => {
  return (
    <GlobalProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/seller-dashboard" element={<EnhancedSellerDashboard />} />
              <Route path="/affiliate-dashboard" element={<EnhancedAffiliateDashboard />} />
              <Route path="/buyer-dashboard" element={<EnhancedBuyerDashboard />} />
            </Routes>
          </Router>
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a href="/" className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">🐝 Beezio</a>
            </div>
            <div className="flex items-center space-x-8">
              <nav className="hidden md:flex space-x-8">
                <a href="/" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Home</a>
                <a href="/products" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Products</a>
                <a href="/fundraisers" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Fundraisers</a>
              </nav>
              <div className="flex items-center space-x-4">
                <button className="text-gray-700 hover:text-orange-600 font-medium transition-colors">
                  Login
                </button>
                <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium transition-colors">
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              🐝 BEEZIO
            </h1>
            <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
              A pricing model where everyone wins: sellers get 100% of their desired price, 
              affiliates earn generous commissions, and customers see exactly where every dollar goes.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
                Start Selling
              </button>
              <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors">
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
            Three groundbreaking features that make us the most transparent and profitable marketplace
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Transparent Pricing */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
              💰
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
              📈
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Monthly Commissions</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Affiliates earn every month customers stay subscribed. Build wealth through 
              recurring income with payments every two weeks.
            </p>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800">More affiliate income</p>
            </div>
          </div>

          {/* Trust Architecture */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
              🤝
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

      {/* Featured Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Products</h2>
          <p className="text-lg text-gray-600">Discover our top-rated products from trusted sellers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Sample Featured Products */}
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-gray-500 text-sm">Product Image</span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Featured Product {item}</h3>
                <p className="text-sm text-gray-600 mb-3">Amazing product description that highlights key benefits</p>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-orange-600">$29.99</span>
                  <button className="bg-orange-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-orange-700 transition-colors">
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Products Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">New Products</h2>
            <p className="text-lg text-gray-600">Fresh arrivals from our marketplace community</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sample New Products */}
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-br from-blue-200 to-purple-300 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">New Product {item}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">New Product {item}</h3>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">NEW</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Latest addition with innovative features</p>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-orange-600">$39.99</span>
                    <button className="bg-orange-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-orange-700 transition-colors">
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fundraisers Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Active Fundraisers</h2>
          <p className="text-lg text-gray-600">Support meaningful causes and make a difference</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Sample Fundraisers */}
          {[
            { title: "Help Local School", goal: 5000, raised: 3200, category: "Education" },
            { title: "Community Garden Project", goal: 2000, raised: 1500, category: "Environment" },
            { title: "Animal Shelter Support", goal: 3000, raised: 2100, category: "Animals" }
          ].map((fundraiser, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="h-48 bg-gradient-to-br from-green-200 to-blue-300 flex items-center justify-center">
                <span className="text-gray-600 text-sm">{fundraiser.title}</span>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{fundraiser.title}</h3>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{fundraiser.category}</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">Making a positive impact in our community through collective support</p>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Raised: ${fundraiser.raised.toLocaleString()}</span>
                    <span>Goal: ${fundraiser.goal.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(fundraiser.raised / fundraiser.goal) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {Math.round((fundraiser.raised / fundraiser.goal) * 100)}% funded
                  </div>
                </div>

                <button className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors font-medium">
                  Support This Cause
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors">
            View All Fundraisers
          </button>
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

      {/* ChatBot */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="bg-orange-600 hover:bg-orange-700 text-white rounded-full p-4 shadow-lg transition-colors group">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Need help? Chat with us!
          </span>
        </button>
      </div>
    </div>
  );
};

export default SimpleWorkingApp;
