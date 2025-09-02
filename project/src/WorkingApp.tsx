import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

// Simple Home Page
const HomePage: React.FC = () => {
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({ 
    isOpen: false, 
    mode: 'login' 
  });
  const navigate = useNavigate();
  const { user, signIn, signUp, signOut } = useAuth();

  const handleLogin = (role: string) => {
    if (user) {
      navigate(`/${role}-dashboard`);
    } else {
      setAuthModal({ isOpen: true, mode: 'login' });
    }
  };

  const handleAuth = async (email: string, password: string, userData?: any) => {
    try {
      if (authModal.mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) {
          alert('Login failed: ' + result.error.message);
          return;
        }
      } else {
        const result = await signUp(email, password, userData || { role: 'buyer' });
        if (result.error) {
          alert('Sign up failed: ' + result.error.message);
          return;
        }
      }
      setAuthModal({ isOpen: false, mode: 'login' });
      // User will be redirected by the auth context
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const toggleAuthMode = () => {
    setAuthModal(prev => ({
      ...prev,
      mode: prev.mode === 'login' ? 'register' : 'login'
    }));
  };

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
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">Welcome, {user.email}</span>
                  <button 
                    onClick={signOut}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2"
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Get Started
                  </button>
                </>
              )}
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
            <button 
              onClick={() => handleLogin('seller')}
              className="bg-yellow-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-yellow-600 transition-colors shadow-lg"
            >
              🏪 Start Selling & Recruiting Affiliates
            </button>
            <button 
              onClick={() => handleLogin('affiliate')}
              className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-colors shadow-lg"
            >
              📈 Become an Affiliate & Earn
            </button>
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
                    <h4 className="text-lg font-semibold text-gray-900">Premium Products to Promote</h4>
                    <p className="text-gray-600">Access high-converting products with generous commission rates up to 50%.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 text-xl">🔗</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Smart Affiliate Links</h4>
                    <p className="text-gray-600">Get unique tracking links, promotional materials, and conversion optimization tools.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-pink-600 text-xl">💰</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Fast Payouts</h4>
                    <p className="text-gray-600">Weekly payments, multiple payout methods, and transparent earnings tracking.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Showcase */}
        <div className="mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Discover What's Possible</h2>
            <p className="text-xl text-gray-600">Explore different ways to monetize and grow your business</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Regular Products */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4 text-center">🛍️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Product Marketplace</h3>
              <p className="text-gray-600 mb-6 text-center">Sell physical and digital products with built-in affiliate recruitment.</p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>• Digital downloads & courses</li>
                <li>• Physical product fulfillment</li>
                <li>• Subscription-based products</li>
                <li>• Multi-vendor marketplace</li>
              </ul>
              <button 
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={() => navigate('/marketplace')}
              >
                Browse Products
              </button>
            </div>

            {/* Fundraisers */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4 text-center">🎯</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Fundraiser Campaigns</h3>
              <p className="text-gray-600 mb-6 text-center">Launch fundraising campaigns with affiliate-powered promotion.</p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>• Charity & cause fundraising</li>
                <li>• Business crowdfunding</li>
                <li>• Community projects</li>
                <li>• Reward-based campaigns</li>
              </ul>
              <button 
                className="w-full bg-green-100 text-green-700 py-3 px-6 rounded-lg hover:bg-green-200 transition-colors"
                onClick={() => navigate('/fundraisers')}
              >
                View Fundraisers
              </button>
            </div>

            {/* Services */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4 text-center">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Service Marketplace</h3>
              <p className="text-gray-600 mb-6 text-center">Offer services and build referral networks with affiliate partners.</p>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>• Consulting & coaching</li>
                <li>• Design & development</li>
                <li>• Marketing services</li>
                <li>• Professional services</li>
              </ul>
              <button 
                className="w-full bg-blue-100 text-blue-700 py-3 px-6 rounded-lg hover:bg-blue-200 transition-colors"
                onClick={() => navigate('/services')}
              >
                Explore Services
              </button>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Success Stories</h2>
            <p className="text-xl text-gray-600">See how others are building their affiliate empires</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-yellow-50 rounded-xl p-8 border border-yellow-200">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">S</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Sarah Chen - Digital Course Creator</h4>
                  <p className="text-gray-600 mt-2">"I went from $5K/month to $50K/month in 6 months by recruiting affiliates through Beezio. The platform made everything so easy!"</p>
                  <div className="mt-4 text-sm text-yellow-700 font-medium">Revenue increased by 900% 📈</div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-8 border border-blue-200">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">M</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Mike Rodriguez - Top Affiliate</h4>
                  <p className="text-gray-600 mt-2">"As a full-time affiliate marketer, Beezio gives me access to the highest-paying programs. I earn $25K+ monthly now."</p>
                  <div className="mt-4 text-sm text-blue-700 font-medium">Monthly earnings: $25,000+ 💰</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-24 text-center bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Build Your Empire?</h2>
          <p className="text-xl mb-8 opacity-90">Join thousands of successful entrepreneurs already growing with Beezio</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => handleLogin('seller')}
              className="bg-white text-yellow-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start as a Seller
            </button>
            <button 
              onClick={() => handleLogin('affiliate')}
              className="bg-yellow-400 text-yellow-900 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-yellow-300 transition-colors"
            >
              Become an Affiliate
            </button>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {authModal.isOpen && (
        <AuthModal 
          mode={authModal.mode}
          onClose={() => setAuthModal({ isOpen: false, mode: 'login' })}
          onAuth={handleAuth}
          onToggleMode={toggleAuthMode}
        />
      )}

      {/* AI Chatbot */}
      <AIChatbot />
    </div>
  );
};

// Auth Modal Component
const AuthModal: React.FC<{
  mode: 'login' | 'register';
  onClose: () => void;
  onAuth: (email: string, password: string, userData?: any) => void;
  onToggleMode: () => void;
}> = ({ mode, onClose, onAuth, onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('buyer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      onAuth(email, password, { fullName, role });
    } else {
      onAuth(email, password);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {mode === 'login' ? 'Login to Beezio' : 'Join Beezio'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="affiliate">Affiliate</option>
              </select>
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            required
          />
          <button 
            type="submit"
            className="w-full bg-yellow-500 text-white py-3 px-6 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button 
            onClick={onToggleMode}
            className="text-yellow-600 hover:text-yellow-700 text-sm"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}
          </button>
        </div>
        <button 
          onClick={onClose}
          className="mt-4 w-full text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// AI Chatbot Component
const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hi! I\'m your Beezio AI assistant. How can I help you get started with affiliate marketing today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const quickQuestions = [
    "How do I start as a seller?",
    "What commission rates can I earn?",
    "How does the affiliate program work?",
    "What are the fees?",
    "Can I promote on social media?"
  ];

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const newMessages = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response (you can integrate with actual AI later)
    setTimeout(() => {
      let response = '';
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('seller') || lowerMessage.includes('sell')) {
        response = 'Great! As a seller on Beezio, you can create products, set your own commission rates (up to 50%), and recruit affiliates to promote your products. You can start by clicking "Start as a Seller" and creating your first product listing. Would you like me to guide you through the setup process?';
      } else if (lowerMessage.includes('affiliate') || lowerMessage.includes('commission')) {
        response = 'As an affiliate, you can earn commissions ranging from 10% to 50% depending on the product. We have digital courses, physical products, and services available to promote. You get real-time tracking, weekly payouts, and professional marketing materials. Ready to start earning?';
      } else if (lowerMessage.includes('fee') || lowerMessage.includes('cost')) {
        response = 'Beezio is free to join for both sellers and affiliates! Sellers pay a small transaction fee only when they make sales (5% platform fee), and affiliates earn without any upfront costs. No monthly subscriptions or hidden fees.';
      } else if (lowerMessage.includes('social media') || lowerMessage.includes('promote')) {
        response = 'Absolutely! You can promote on all social media platforms - Instagram, TikTok, YouTube, Facebook, Twitter, and more. We provide custom tracking links, promotional graphics, and even video content to help you succeed. Many of our top affiliates use social media as their primary promotion channel.';
      } else {
        response = 'That\'s a great question! I\'d love to help you with that. For more detailed assistance, you can also reach out to our support team or check our knowledge base. Is there anything specific about getting started with Beezio that I can help clarify?';
      }
      
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-2xl z-50 animate-pulse"
      >
        🤖
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 p-4 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            🤖
          </div>
          <div>
            <h3 className="text-white font-semibold">Beezio AI Assistant</h3>
            <p className="text-white text-xs opacity-90">Online • Ready to help</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-2xl ${
              message.role === 'user' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Questions */}
        {messages.length === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">Quick questions:</p>
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuestion(question)}
                className="w-full text-left text-sm bg-gray-50 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
            placeholder="Ask me anything..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Components with Supabase Integration
const SellerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, activeProducts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSellerData();
    }
  }, [user]);

  const fetchSellerData = async () => {
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user?.id);

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Calculate stats (mock for now)
      setStats({
        totalSales: productsData?.length * 15 || 0,
        totalRevenue: productsData?.length * 500 || 0,
        activeProducts: productsData?.filter(p => p.is_active).length || 0
      });
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Seller Dashboard</span>
              <span className="text-sm text-gray-600">Welcome, {profile?.full_name || user?.email}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Seller Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Sales</h3>
            <p className="text-3xl font-bold text-yellow-600">{stats.totalSales}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue</h3>
            <p className="text-3xl font-bold text-green-600">${stats.totalRevenue}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Products</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.activeProducts}</p>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Your Products</h2>
              <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                Add Product
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No products yet. Start by adding your first product!</p>
              </div>
            ) : (
              products.map((product) => (
                <div key={product.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{product.title}</h3>
                      <p className="text-gray-600 mt-1">{product.description?.substring(0, 100)}...</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>Price: ${product.price || product.subscription_price}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          product.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-700 px-3 py-1 text-sm">Edit</button>
                      <button className="text-gray-600 hover:text-gray-700 px-3 py-1 text-sm">Analytics</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AffiliateDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [affiliateLinks, setAffiliateLinks] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, pending: 0, paid: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAffiliateData();
    }
  }, [user]);

  const fetchAffiliateData = async () => {
    try {
      // Fetch affiliate links
      const { data: linksData, error: linksError } = await supabase
        .from('affiliate_links')
        .select('*, products(*)')
        .eq('affiliate_id', user?.id);

      if (linksError) throw linksError;
      setAffiliateLinks(linksData || []);

      // Mock earnings data
      setEarnings({
        total: linksData?.length * 125 || 0,
        pending: linksData?.length * 45 || 0,
        paid: linksData?.length * 80 || 0
      });
    } catch (error) {
      console.error('Error fetching affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Affiliate Dashboard</span>
              <span className="text-sm text-gray-600">Welcome, {profile?.full_name || user?.email}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Affiliate Dashboard</h1>
        
        {/* Earnings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Earnings</h3>
            <p className="text-3xl font-bold text-green-600">${earnings.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600">${earnings.pending}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Paid Out</h3>
            <p className="text-3xl font-bold text-blue-600">${earnings.paid}</p>
          </div>
        </div>

        {/* Affiliate Links */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Your Affiliate Links</h2>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Find Products
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {affiliateLinks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No affiliate links yet. Start promoting products to earn commissions!</p>
              </div>
            ) : (
              affiliateLinks.map((link) => (
                <div key={link.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{link.products?.title}</h3>
                      <p className="text-gray-600 mt-1">Commission: {link.commission_rate}%</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>Clicks: {link.clicks || 0}</span>
                        <span>Conversions: {link.conversions || 0}</span>
                        <span>Earnings: ${link.total_earned || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-700 px-3 py-1 text-sm">Copy Link</button>
                      <button className="text-gray-600 hover:text-gray-700 px-3 py-1 text-sm">Stats</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const BuyerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBuyerData();
    }
  }, [user]);

  const fetchBuyerData = async () => {
    try {
      // Fetch recent products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(6);

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching buyer data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Buyer Dashboard</span>
              <span className="text-sm text-gray-600">Welcome, {profile?.full_name || user?.email}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Discover Products</h1>
        
        {/* Featured Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Featured Products</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {products.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-gray-400">Product Image</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{product.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{product.description?.substring(0, 100)}...</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-900">
                    ${product.price || product.subscription_price}
                    {product.is_subscription && '/month'}
                  </span>
                  <button className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
          {products.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>No products available at the moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Products Page
const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link to="/fundraisers" className="text-gray-600 hover:text-gray-900">Fundraisers</Link>
              <Link to="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
              {user ? (
                <span className="text-gray-600">Welcome, {user.email}</span>
              ) : (
                <Link to="/" className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Product Marketplace</h1>
          <p className="text-xl text-gray-600">Discover amazing products and start your affiliate journey</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sample Products */}
          {[
            { title: "Digital Marketing Mastery Course", price: "$197", commission: "40%", category: "Education" },
            { title: "SEO Optimization Toolkit", price: "$97", commission: "30%", category: "Software" },
            { title: "Social Media Templates Pack", price: "$47", commission: "50%", category: "Design" },
            { title: "Email Marketing Automation", price: "$127", commission: "35%", category: "Software" },
            { title: "Content Creation Workshop", price: "$77", commission: "45%", category: "Education" },
            { title: "Brand Identity Design Kit", price: "$67", commission: "40%", category: "Design" }
          ].map((product, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-yellow-600 text-sm font-medium">Product Image</span>
              </div>
              <div className="mb-2">
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{product.category}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.title}</h3>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold text-gray-900">{product.price}</span>
                <span className="text-green-600 font-medium">{product.commission} commission</span>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors">
                  Get Affiliate Link
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Fundraisers Page
const FundraisersPage: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
              🐝 Beezio.co
            </Link>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link to="/marketplace" className="text-gray-600 hover:text-gray-900">Products</Link>
              <Link to="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
              {user ? (
                <span className="text-gray-600">Welcome, {user.email}</span>
              ) : (
                <Link to="/" className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Active Fundraisers</h1>
          <p className="text-xl text-gray-600">Support great causes and earn commissions for spreading the word</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Sample Fundraisers */}
          {[
            { title: "Clean Water for Rural Communities", raised: "$45,230", goal: "$100,000", commission: "5%", category: "Charity", progress: 45 },
            { title: "Tech Startup Launch Campaign", raised: "$78,500", goal: "$150,000", commission: "8%", category: "Business", progress: 52 },
            { title: "Community Garden Project", raised: "$12,840", goal: "$25,000", commission: "6%", category: "Community", progress: 51 },
            { title: "Educational App Development", raised: "$34,200", goal: "$75,000", commission: "10%", category: "Technology", progress: 46 },
            { title: "Animal Shelter Expansion", raised: "$89,600", goal: "$120,000", commission: "7%", category: "Animals", progress: 75 },
            { title: "Green Energy Initiative", raised: "$156,800", goal: "$200,000", commission: "9%", category: "Environment", progress: 78 }
          ].map((fundraiser, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-green-600 text-sm font-medium">Fundraiser Image</span>
              </div>
              <div className="mb-2">
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">{fundraiser.category}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{fundraiser.title}</h3>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{fundraiser.raised} raised</span>
                  <span>{fundraiser.goal} goal</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${fundraiser.progress}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-500 mt-1">{fundraiser.progress}% funded</div>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-blue-600 font-medium">{fundraiser.commission} affiliate commission</span>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                  Promote & Earn
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Learn More
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Services Page (placeholder)
const ServicesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Services Marketplace</h1>
        <p className="text-gray-600 mb-8">Coming Soon - Connect with service providers and affiliates</p>
        <Link to="/" className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

// Main App Component
const WorkingApp: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/fundraisers" element={<FundraisersPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/seller-dashboard" element={<SellerDashboard />} />
            <Route path="/affiliate-dashboard" element={<AffiliateDashboard />} />
            <Route path="/buyer-dashboard" element={<BuyerDashboard />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default WorkingApp;
