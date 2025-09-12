import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContextMultiRole';
import { AffiliateProvider } from './contexts/AffiliateContext';
import { GlobalProvider } from './contexts/GlobalContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { CartProvider } from './contexts/CartContext';
import MarketplacePage from './pages/MarketplacePageBeautiful';
import FundraisersPage from './pages/FundraisersPageBeautiful';
import SellerGuide from './pages/SellerGuide';
import AffiliateGuide from './pages/AffiliateGuide';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import EnhancedSellerDashboard from './components/EnhancedSellerDashboard';
import EnhancedAffiliateDashboard from './components/EnhancedAffiliateDashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DebugSW from './pages/DebugSW';
import AuthModal from './components/AuthModal';
import { SAMPLE_PRODUCTS } from './data/sampleProducts';
import { Star, Heart, Share2, Users, TrendingUp, Shield, Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';

// Hero Section
const HeroSection = () => (
  <section className="bg-amber-50 py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-4xl font-bold text-amber-600">Empowering Sellers and Affiliates to Thrive Together</h1>
      <p className="mt-4 text-lg text-gray-600">
        Join Beezio, the revolutionary affiliate marketing platform that connects sellers, affiliates, and causes.
      </p>
      <div className="mt-6">
        <Link to="/marketplace" className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors font-medium">
          Explore the Marketplace
        </Link>
        <Link to="/seller-guide" className="ml-4 bg-gray-100 text-amber-600 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium">
          Learn More
        </Link>
      </div>
    </div>
  </section>
);

// Platform Highlights
const PlatformHighlights = () => (
  <section className="py-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-gray-800 text-center">Why Choose Beezio?</h2>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <Star className="w-12 h-12 text-amber-600 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-800">Innovative Tools</h3>
          <p className="mt-2 text-gray-600">Empower sellers and affiliates with cutting-edge marketing tools.</p>
        </div>
        <div className="text-center">
          <Users className="w-12 h-12 text-amber-600 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-800">Community Focused</h3>
          <p className="mt-2 text-gray-600">Build connections and grow together with our thriving community.</p>
        </div>
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-amber-600 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-800">Scalable Growth</h3>
          <p className="mt-2 text-gray-600">Achieve your goals with a platform designed for growth.</p>
        </div>
      </div>
    </div>
  </section>
);

// Feature Cards Component
const FeatureCards = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-gray-50">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Three Ways to Succeed with Beezio
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Choose your path to financial freedom - whether you're selling products, promoting them, or discovering amazing deals
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Seller Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border-t-4 border-blue-500">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">🏪 For Sellers</h3>
          <p className="text-gray-600 mb-6">
            Turn your products into profit machines with our comprehensive seller platform designed for maximum reach and revenue.
          </p>
          <div className="text-left mb-8">
            <h4 className="font-semibold text-gray-800 mb-3">🚀 What You Get:</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Custom Storefront</strong> - Professional shop with your branding</li>
              <li>• <strong>Unlimited Products</strong> - List as many items as you want</li>
              <li>• <strong>Built-in Affiliate Network</strong> - Thousands of promoters ready to sell for you</li>
              <li>• <strong>Real-time Analytics</strong> - Track sales, traffic, and performance</li>
              <li>• <strong>Automated Marketing</strong> - AI-powered product promotion</li>
              <li>• <strong>Secure Payments</strong> - Stripe integration with instant payouts</li>
              <li>• <strong>Mobile-Optimized</strong> - Your store looks perfect on all devices</li>
              <li>• <strong>Customer Support</strong> - 24/7 help when you need it</li>
            </ul>
          </div>
          <Link to="/seller-dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Start Selling Today
          </Link>
        </div>

        {/* Affiliate Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border-t-4 border-green-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">🤝 For Affiliates</h3>
          <p className="text-gray-600 mb-6">
            Transform your influence into income with our powerful affiliate marketing tools and personalized promotion platform.
          </p>
          <div className="text-left mb-8">
            <h4 className="font-semibold text-gray-800 mb-3">💰 What You Get:</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Custom Affiliate Store</strong> - Your own branded storefront</li>
              <li>• <strong>High Commission Rates</strong> - Up to 50% on every sale</li>
              <li>• <strong>Smart Link Generation</strong> - QR codes and custom URLs</li>
              <li>• <strong>Real-time Tracking</strong> - Monitor clicks, conversions, earnings</li>
              <li>• <strong>Marketing Materials</strong> - Banners, emails, social media content</li>
              <li>• <strong>Weekly Payouts</strong> - Get paid every week via Stripe</li>
              <li>• <strong>Performance Analytics</strong> - Detailed reports and insights</li>
              <li>• <strong>Multi-level Commissions</strong> - Earn from your network too</li>
            </ul>
          </div>
          <Link to="/affiliate-dashboard" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold">
            Start Earning Money
          </Link>
        </div>

        {/* Buyer Card */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 text-center border-t-4 border-purple-500">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">🛒 For Buyers</h3>
          <p className="text-gray-600 mb-6">
            Discover incredible products at great prices while supporting sellers and earning rewards through our smart shopping platform.
          </p>
          <div className="text-left mb-8">
            <h4 className="font-semibold text-gray-800 mb-3">🎁 What You Get:</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• <strong>Cashback Rewards</strong> - Earn money on every purchase</li>
              <li>• <strong>Exclusive Deals</strong> - Special offers from top sellers</li>
              <li>• <strong>Quality Guarantee</strong> - All products verified and rated</li>
              <li>• <strong>Secure Payments</strong> - Protected transactions every time</li>
              <li>• <strong>Free Shipping</strong> - Many items ship free</li>
              <li>• <strong>Easy Returns</strong> - Hassle-free return policy</li>
              <li>• <strong>Personalized Recommendations</strong> - AI-powered suggestions</li>
              <li>• <strong>24/7 Support</strong> - Help whenever you need it</li>
            </ul>
          </div>
          <Link to="/marketplace" className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-semibold">
            Start Shopping Now
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

// Custom Stores Section Component
const CustomStoresSection = () => {
  return (
    <div className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Your Own Branded Storefront
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Every seller and affiliate gets their own professional online store to showcase products and maximize commission earnings
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Seller Store Features */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">🏪</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Seller Storefront</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Create a professional online store that showcases your products and attracts customers from around the world.
            </p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Custom Branding</h4>
                  <p className="text-gray-600 text-sm">Your logo, colors, and brand identity</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Product Showcase</h4>
                  <p className="text-gray-600 text-sm">Beautiful product galleries and descriptions</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Affiliate Integration</h4>
                  <p className="text-gray-600 text-sm">Built-in tools for affiliates to promote your products</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Analytics Dashboard</h4>
                  <p className="text-gray-600 text-sm">Track sales, traffic, and customer behavior</p>
                </div>
              </div>
            </div>

            <Link
              to="/seller-dashboard"
              className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold inline-block"
            >
              Create Your Store
            </Link>
          </div>

          {/* Affiliate Store Features */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Affiliate Storefront</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Build your own affiliate marketing hub with custom branding and powerful tools to maximize your commission earnings.
            </p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Personal Branding</h4>
                  <p className="text-gray-600 text-sm">Your unique affiliate identity and style</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Commission Links</h4>
                  <p className="text-gray-600 text-sm">Custom URLs and QR codes for easy sharing</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Marketing Tools</h4>
                  <p className="text-gray-600 text-sm">Banners, emails, and social media content</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Performance Tracking</h4>
                  <p className="text-gray-600 text-sm">Real-time earnings and conversion analytics</p>
                </div>
              </div>
            </div>

            <Link
              to="/affiliate-dashboard"
              className="mt-8 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold inline-block"
            >
              Build Your Store
            </Link>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">Ready to Build Your Success Story?</h3>
            <p className="text-lg mb-6 opacity-90">
              Join thousands of successful sellers and affiliates who are already earning big with their custom Beezio stores
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/seller-dashboard"
                className="bg-white text-amber-600 px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                🚀 Start Selling
              </Link>
              <Link
                to="/affiliate-dashboard"
                className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-amber-600 transition-colors font-semibold"
              >
                💰 Start Earning
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
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
            Where <span className="text-amber-600">Sellers Move Products</span> & Affiliates Earn Big
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
            Join the ultimate marketplace where sellers showcase their products to reach millions, affiliates build passive income through smart promotion, and buyers discover quality items with unbeatable value.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/marketplace"
              className="bg-amber-600 text-white px-8 py-4 rounded-lg hover:bg-amber-700 transition-colors font-semibold text-lg"
            >
              🛍️ Start Shopping
            </Link>
            <Link
              to="/seller-dashboard"
              className="bg-white text-amber-600 border-2 border-amber-600 px-8 py-4 rounded-lg hover:bg-amber-50 transition-colors font-semibold text-lg"
            >
              🏪 Become a Seller
            </Link>
            <Link
              to="/affiliate-dashboard"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all font-semibold text-lg"
            >
              💰 Become an Affiliate
            </Link>
          </div>
        </div>
      </div>

      {/* Comprehensive Feature Cards */}
      <FeatureCards />

      {/* Custom Stores Section */}
      <CustomStoresSection />

      {/* Featured Products */}
      <FeaturedProducts />

      {/* Fundraiser Section */}
      <FundraiserSection />

      {/* Platform Highlights */}
      <PlatformHighlights />

      {/* Social Footer */}
      <SocialFooter />
    </>
  );
};

// Missing component definitions
// (HomePage is implemented above; keep the other placeholders below)
const ChatBot = () => <div>Chat Bot</div>;
const EnhancedBuyerDashboard = () => <div>Buyer Dashboard</div>;
const SellerStorePage = () => <div>Seller Store</div>;
const AffiliateStorePage = () => <div>Affiliate Store</div>;

const AppProductionReady = () => {
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

  return (
    <AuthProvider>
      <GlobalProvider>
        <CartProvider>
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
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/debug-sw" element={<DebugSW />} />
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
        </CartProvider>
      </GlobalProvider>
    </AuthProvider>
  );
};

export default AppProductionReady;
