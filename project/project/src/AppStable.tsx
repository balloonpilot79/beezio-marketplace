import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContextMultiRole';
import { CartProvider } from './contexts/CartContext';
import { GlobalProvider } from './contexts/GlobalContext';
import RevolutionaryShowcaseSimple from './components/RevolutionaryShowcaseSimple';
import MarketplacePageSimple from './pages/MarketplacePageSimple';
import TestPage from './components/TestPage';

// Simple Working Header
const SimpleHeader: React.FC<{ onOpenAuthModal: (modal: { isOpen: boolean; mode: string }) => void }> = ({ onOpenAuthModal }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-orange-600">🐝 Beezio</a>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="/" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Home</a>
            <a href="/products" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Products</a>
            <a href="/fundraisers" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Fundraisers</a>
            <a href="/sellers" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Sellers</a>
            <a href="/affiliates" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Affiliates</a>
            <a href="/revolutionary" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Revolutionary</a>
            <a href="/test" className="text-gray-700 hover:text-orange-600 font-medium transition-colors">Test</a>
          </nav>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="text-gray-700 hover:text-orange-600 font-medium transition-colors"
            >
              Login
            </button>
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Beautiful Home Page Component
interface HomePageProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: string }) => void;
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
              The World's First <span className="font-bold">Transparent Recurring Commission</span> Marketplace
            </p>
            <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
              Revolutionary pricing model where everyone wins: sellers get 100% of their desired price, 
              affiliates earn generous recurring commissions every month, and customers see exactly where every dollar goes.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
                className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
              >
                🚀 Start Selling Now
              </button>
              <button 
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'signup' })}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-orange-600 transition-colors"
              >
                💰 Become an Affiliate
              </button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
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
              <p className="text-sm font-semibold text-blue-800">Result: 280% higher conversion rates</p>
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
              <p className="text-sm font-semibold text-green-800">Income: 1,800% more than competitors</p>
            </div>
          </div>

          {/* Trust Architecture */}
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust-First Architecture</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Transparent pricing creates customer confidence, gamified affiliate system drives 
              engagement, and recurring payments ensure long-term relationships.
            </p>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-purple-800">Trust Score: 98% customer satisfaction</p>
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
              <div className="text-4xl font-bold text-white mb-2">1,800%</div>
              <div className="text-gray-300">More Affiliate Income</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">280%</div>
              <div className="text-gray-300">Higher Conversions</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">98%</div>
              <div className="text-gray-300">Customer Trust Score</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple placeholder pages
const FundraisersPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-5xl font-bold text-emerald-600 mb-6">💝 Fundraisers</h1>
      <p className="text-xl text-gray-700 mb-8">Support amazing causes while earning recurring commissions</p>
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon!</h3>
        <p className="text-gray-600">Revolutionary fundraising platform with transparent pricing and recurring affiliate commissions.</p>
      </div>
    </div>
  </div>
);

const SellersPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-5xl font-bold text-purple-600 mb-6">🏪 Sellers</h1>
      <p className="text-xl text-gray-700 mb-8">Get 100% of your desired price with our transparent pricing model</p>
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Perfect for Sellers!</h3>
        <p className="text-gray-600">No hidden fees. You set your price, we handle everything else transparently.</p>
      </div>
    </div>
  </div>
);

const AffiliatesPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-5xl font-bold text-orange-600 mb-6">💰 Affiliates</h1>
      <p className="text-xl text-gray-700 mb-8">Earn monthly recurring commissions that build real wealth</p>
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">1,800% More Income!</h3>
        <p className="text-gray-600">Monthly recurring commissions vs one-time payments. Build sustainable income streams.</p>
      </div>
    </div>
  </div>
);

// Simple ChatBot
const SimpleChatBot = () => (
  <div className="fixed bottom-6 right-6 z-50">
    <button className="bg-orange-600 text-white p-4 rounded-full shadow-lg hover:bg-orange-700 transition-colors">
      <span className="text-2xl">💬</span>
    </button>
  </div>
);

// Simple Auth Modal
const SimpleAuthModal: React.FC<{
  isOpen: boolean;
  mode: string;
  onClose: () => void;
}> = ({ isOpen, mode, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-600 mb-4">
            {mode === 'login' ? 'Welcome back to Beezio!' : 'Join the revolutionary marketplace!'}
          </p>
          <button
            onClick={onClose}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppStable: React.FC = () => {
  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'login' });

  return (
    <GlobalProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <SimpleHeader onOpenAuthModal={setAuthModal} />
              
              <main>
                <Routes>
                  <Route path="/" element={<HomePage onOpenAuthModal={setAuthModal} />} />
                  <Route path="/test" element={<TestPage />} />
                  <Route path="/revolutionary" element={<RevolutionaryShowcaseSimple />} />
                  <Route path="/products" element={<MarketplacePageSimple />} />
                  <Route path="/marketplace" element={<MarketplacePageSimple />} />
                  <Route path="/fundraisers" element={<FundraisersPage />} />
                  <Route path="/sellers" element={<SellersPage />} />
                  <Route path="/affiliates" element={<AffiliatesPage />} />
                </Routes>
              </main>

              <SimpleChatBot />

              <SimpleAuthModal
                isOpen={authModal.isOpen}
                mode={authModal.mode}
                onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
              />
            </div>
          </Router>
        </CartProvider>
      </AuthProvider>
    </GlobalProvider>
  );
};

export default AppStable;
