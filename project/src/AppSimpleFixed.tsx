import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { AffiliateProvider } from './contexts/AffiliateContext';
import MarketplacePage from './pages/MarketplacePageSimple';

// Simple Header component
const SimpleHeader = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-2xl font-bold text-yellow-600">🐝 Beezio</Link>
            <nav className="hidden md:flex space-x-8">
              <Link to="/marketplace" className="text-gray-700 hover:text-yellow-600 transition-colors">Marketplace</Link>
              <Link to="/sellers" className="text-gray-700 hover:text-yellow-600 transition-colors">Sellers</Link>
              <Link to="/affiliates" className="text-gray-700 hover:text-yellow-600 transition-colors">Affiliates</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Simple HomePage component
const HomePage = () => {
  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Welcome to Beezio Marketplace
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-yellow-100">
            Transparent pricing • Fair commissions • Affiliate-friendly
          </p>
          <div className="space-x-4">
            <Link 
              to="/marketplace" 
              className="bg-white text-yellow-600 px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg inline-block"
            >
              Browse Marketplace
            </Link>
            <Link 
              to="/marketplace" 
              className="bg-yellow-600 text-white px-8 py-3 rounded-lg hover:bg-yellow-700 transition-colors font-semibold text-lg inline-block"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </div>

      {/* Mock Flow Testing Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Test Mock Seller → Affiliate → Buyer Flow?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            We have a Gaming Headset with 30% commission ready for testing!
          </p>
          
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                🎧 Professional Bluetooth Gaming Headset - Limited Edition
              </h3>
              <div className="text-lg text-gray-600 space-y-1">
                <div><strong>Price:</strong> $189.99</div>
                <div><strong>Commission:</strong> 30% = $57.00</div>
                <div><strong>Seller:</strong> MockSeller Pro</div>
              </div>
            </div>
            
            <Link 
              to="/marketplace" 
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg inline-block"
            >
              Start Mock Flow Test →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppSimple = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <AffiliateProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <SimpleHeader />
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
              </Routes>
            </div>
          </Router>
        </AffiliateProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default AppSimple;
