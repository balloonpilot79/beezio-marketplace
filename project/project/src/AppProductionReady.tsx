import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';

// Simple Home Page
const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                🐝 Beezio.co
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-6">
                <Link to="/marketplace" className="text-gray-600 hover:text-gray-900 transition-colors">Products</Link>
                <Link to="/fundraisers" className="text-gray-600 hover:text-gray-900 transition-colors">Fundraisers</Link>
                <Link to="/services" className="text-gray-600 hover:text-gray-900 transition-colors">Services</Link>
              </nav>
              <div className="flex items-center space-x-4">
                <button className="text-gray-600 hover:text-gray-900 px-3 py-2">
                  Login
                </button>
                <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            Launch Your
            <span className="block text-yellow-600">Affiliate Empire</span>
            Today
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            The premier platform for sellers to build affiliate programs and affiliates to maximize earnings. 
            Join thousands of successful entrepreneurs already growing their business with Beezio.
          </p>
          
          {/* Main CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              to="/seller-dashboard"
              className="bg-yellow-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-yellow-600 transition-colors shadow-lg text-center"
            >
              🏪 Start Selling & Recruiting Affiliates
            </Link>
            <Link 
              to="/affiliate-dashboard"
              className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-colors shadow-lg text-center"
            >
              📈 Become an Affiliate & Earn
            </Link>
          </div>

          {/* Stats Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">$2.5M+</div>
              <div className="text-gray-600 mt-2">Affiliate Commissions Paid</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">15K+</div>
              <div className="text-gray-600 mt-2">Active Affiliates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">3.2K+</div>
              <div className="text-gray-600 mt-2">Successful Sellers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">50K+</div>
              <div className="text-gray-600 mt-2">Products Listed</div>
            </div>
          </div>
        </div>

        {/* Features Showcase */}
        <div className="mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need to Succeed</h2>
            <p className="text-xl text-gray-600">Powerful tools for sellers and affiliates to grow together</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* For Sellers */}
            <div className="space-y-8">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">🏪 For Sellers</h3>
              </div>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-yellow-600 text-xl">🚀</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Launch Products Instantly</h4>
                    <p className="text-gray-600">Upload your products, set commissions, and start recruiting affiliates in minutes.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-xl">👥</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Build Your Affiliate Army</h4>
                    <p className="text-gray-600">Access our network of proven affiliates ready to promote your products.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xl">📊</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Track Everything</h4>
                    <p className="text-gray-600">Real-time analytics, conversion tracking, and automated commission payments.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Affiliates */}
            <div className="space-y-8">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 For Affiliates</h3>
              </div>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 text-xl">💎</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Premium Products</h4>
                    <p className="text-gray-600">Promote high-quality products with generous commissions and proven conversion rates.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xl">💰</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Instant Payouts</h4>
                    <p className="text-gray-600">Get paid instantly when sales are made. No waiting periods, no minimum thresholds.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-xl">🎯</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Smart Tools</h4>
                    <p className="text-gray-600">Advanced analytics, custom landing pages, and AI-powered optimization tools.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
};

const MarketplacePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link to="/seller-dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">Sell</Link>
              <Link to="/affiliate-dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">Affiliate</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🛍️ Marketplace
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Browse products from our amazing sellers and affiliates. Find the perfect products to promote or purchase.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Sample Product Cards */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-48 bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
              <span className="text-4xl">📱</span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tech Gadgets</h3>
              <p className="text-gray-600 mb-4">Latest technology products with high commissions</p>
              <div className="flex justify-between items-center">
                <span className="text-green-600 font-semibold">25% Commission</span>
                <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors">View</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <span className="text-4xl">🏠</span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Home & Garden</h3>
              <p className="text-gray-600 mb-4">Beautiful home improvement products</p>
              <div className="flex justify-between items-center">
                <span className="text-green-600 font-semibold">30% Commission</span>
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">View</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-48 bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <span className="text-4xl">💪</span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Health & Fitness</h3>
              <p className="text-gray-600 mb-4">Premium wellness and fitness products</p>
              <div className="flex justify-between items-center">
                <span className="text-green-600 font-semibold">35% Commission</span>
                <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors">View</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const SellerDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link to="/marketplace" className="text-gray-600 hover:text-gray-900 transition-colors">Marketplace</Link>
              <Link to="/affiliate-dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">Affiliate</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🏪 Seller Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Manage your products, track sales, and grow your affiliate network.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-blue-600 text-xl">📦</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Products</h3>
            <p className="text-gray-600 mb-4">Upload new products to your store and set commission rates.</p>
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors w-full">Add Product</button>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-green-600 text-xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Affiliates</h3>
            <p className="text-gray-600 mb-4">View and manage your affiliate partners and their performance.</p>
            <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors w-full">View Affiliates</button>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <span className="text-yellow-600 text-xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-gray-600 mb-4">Track sales, commissions, and performance metrics.</p>
            <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors w-full">View Analytics</button>
          </div>
        </div>
        <div className="mt-16 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">New Affiliate Signup</p>
                <p className="text-gray-600">John Doe joined your affiliate program</p>
              </div>
              <span className="text-green-600 font-semibold">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">Product Sale</p>
                <p className="text-gray-600">Premium Widget sold via affiliate link</p>
              </div>
              <span className="text-blue-600 font-semibold">5 hours ago</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const AffiliateDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link to="/marketplace" className="text-gray-600 hover:text-gray-900 transition-colors">Marketplace</Link>
              <Link to="/seller-dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">Sell</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            💰 Affiliate Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Track your commissions, promote products, and maximize your earnings.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">$2,847</div>
            <div className="text-gray-600">Total Earnings</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">156</div>
            <div className="text-gray-600">Sales This Month</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">23</div>
            <div className="text-gray-600">Active Products</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">4.8%</div>
            <div className="text-gray-600">Conversion Rate</div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Top Performing Products</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-gray-900">Smart Phone Case</p>
                    <p className="text-gray-600">$24.99 • 25% commission</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">$312</p>
                  <p className="text-gray-600 text-sm">42 sales</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">💪</span>
                  <div>
                    <p className="font-semibold text-gray-900">Fitness Tracker</p>
                    <p className="text-gray-600">$89.99 • 30% commission</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">$269</p>
                  <p className="text-gray-600 text-sm">18 sales</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-4">
              <button className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors">
                💼 Browse New Products
              </button>
              <button className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                📊 View Detailed Analytics
              </button>
              <button className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors">
                🎯 Create Marketing Materials
              </button>
              <button className="w-full bg-yellow-500 text-white py-3 px-4 rounded-lg hover:bg-yellow-600 transition-colors">
                💳 Request Payout
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const SellerStorePage = () => {
  return (
    const SellerStorePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link to="/marketplace" className="text-gray-600 hover:text-gray-900 transition-colors">Marketplace</Link>
              <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">Contact Seller</button>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-white">🏪</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🛍️ Premium Seller Store
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to our curated collection of premium products with amazing affiliate opportunities.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="h-56 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <span className="text-5xl">📱</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Device Pro</h3>
              <p className="text-gray-600 mb-4">Revolutionary technology that changes everything.</p>
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-bold text-gray-900">$299.99</span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">30% Commission</span>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors">Buy Now</button>
                <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">Promote</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="h-56 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
              <span className="text-5xl">🏠</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Home Essential Kit</h3>
              <p className="text-gray-600 mb-4">Everything you need for a perfect home setup.</p>
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-bold text-gray-900">$149.99</span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">25% Commission</span>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors">Buy Now</button>
                <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">Promote</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="h-56 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <span className="text-5xl">💪</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Fitness Master Bundle</h3>
              <p className="text-gray-600 mb-4">Complete fitness solution for healthy living.</p>
              <div className="flex justify-between items-center mb-4">
                <span className="text-2xl font-bold text-gray-900">$199.99</span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">35% Commission</span>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors">Buy Now</button>
                <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">Promote</button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Want to Promote These Products?</h2>
          <p className="text-gray-600 mb-6">Join our affiliate program and start earning generous commissions on every sale.</p>
          <Link to="/affiliate-dashboard" className="bg-green-500 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-600 transition-colors inline-block">
            Become an Affiliate
          </Link>
        </div>
      </main>
    </div>
  );
};
  );
};

const AffiliateStorePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <nav className="flex items-center space-x-6">
              <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
              <Link to="/marketplace" className="text-gray-600 hover:text-gray-900 transition-colors">Marketplace</Link>
              <button className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors">Contact Affiliate</button>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-white">🤝</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎯 Affiliate Hub
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Partner with top brands and earn amazing commissions on products you believe in.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-3xl font-bold text-teal-600 mb-2">15%</div>
            <div className="text-gray-600">Average Commission</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-3xl font-bold text-blue-600 mb-2">2.3k</div>
            <div className="text-gray-600">Monthly Visitors</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-3xl font-bold text-green-600 mb-2">4.8%</div>
            <div className="text-gray-600">Conversion Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-3xl font-bold text-purple-600 mb-2">$1.2k</div>
            <div className="text-gray-600">Monthly Earnings</div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Products I Recommend</h2>
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Tech Gadget Pro</h3>
                  <p className="text-gray-600">Amazing device that I personally use daily</p>
                  <span className="text-green-600 font-semibold">Earn $45 per sale</span>
                </div>
                <button className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 transition-colors">View</button>
              </div>
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🏠</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Home Essential</h3>
                  <p className="text-gray-600">Perfect for any household, great conversion</p>
                  <span className="text-green-600 font-semibold">Earn $30 per sale</span>
                </div>
                <button className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 transition-colors">View</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Why Partner With Me?</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <span className="text-green-500 text-xl">✓</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Trusted by 2.3k+ Followers</h3>
                  <p className="text-gray-600">Built a loyal audience that trusts my recommendations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-green-500 text-xl">✓</span>
                <div>
                  <h3 className="font-semibold text-gray-900">High Conversion Rates</h3>
                  <p className="text-gray-600">4.8% average conversion across all promoted products</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-green-500 text-xl">✓</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Quality Content Creation</h3>
                  <p className="text-gray-600">Professional reviews, tutorials, and marketing materials</p>
                </div>
              </div>
            </div>
            <Link to="/seller-dashboard" className="mt-6 block w-full bg-blue-500 text-white py-3 px-4 rounded-lg text-center font-semibold hover:bg-blue-600 transition-colors">
              Partner With Me
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

const AppProductionReady = () => {
  return (
    <Router>
      <div style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/seller-dashboard" element={<SellerDashboard />} />
          <Route path="/affiliate-dashboard" element={<AffiliateDashboard />} />
                  <Route path="/store/:sellerId" element={<SellerStorePage />} />
                  <Route path="/affiliate/:affiliateId" element={<AffiliateStorePage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default AppProductionReady;
