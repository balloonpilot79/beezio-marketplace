import React from 'react';
import { DollarSign, TrendingUp, Users, Shield, Zap, Globe, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorksPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-amber-400 to-orange-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">How Beezio Works</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            The transparent marketplace where sellers, affiliates, and buyers all win
          </p>
        </div>
      </section>

      {/* How It Works Steps */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Process</h2>
            <p className="text-xl text-gray-600">Everyone knows exactly what they're getting</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* For Sellers */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Sellers</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600">Set your desired profit amount (e.g., $100)</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600">Choose affiliate commission rate</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600">We calculate the final price automatically</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <p className="text-gray-600">Get exactly what you wanted when you sell!</p>
                </div>
              </div>
            </div>

            {/* For Affiliates */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Affiliates</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600">Browse products with clear commission rates</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600">Generate your unique affiliate link</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600">Share and promote products</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <p className="text-gray-600">Earn commission on every sale!</p>
                </div>
              </div>
            </div>

            {/* For Buyers */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Buyers</h3>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600">Browse quality products from verified sellers</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600">See transparent pricing with no hidden fees</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600">Secure checkout with global payment options</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <p className="text-gray-600">Support sellers and affiliates with your purchase!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Breakdown Example */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Transparent Pricing Example</h2>
            <p className="text-xl text-gray-600">See exactly how our pricing works</p>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-amber-200">
                <span className="text-gray-700 font-medium">Seller's desired profit</span>
                <span className="text-green-600 font-bold text-lg">$100.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-amber-200">
                <span className="text-gray-700 font-medium">Affiliate commission (20%)</span>
                <span className="text-blue-600 font-bold text-lg">$20.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-amber-200">
                <span className="text-gray-700 font-medium">Beezio platform fee (10%)</span>
                <span className="text-amber-600 font-bold text-lg">$12.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-amber-200">
                <span className="text-gray-700 font-medium">Stripe processing fee (3%)</span>
                <span className="text-purple-600 font-bold text-lg">$4.08</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-white rounded-lg px-4 border-2 border-amber-300">
                <span className="text-gray-900 font-bold text-xl">Customer pays</span>
                <span className="text-amber-600 font-bold text-2xl">$136.08</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 text-center">
                <strong>Everyone wins:</strong> Seller gets $100, Affiliate earns $20, Beezio gets $12, Stripe gets $4.08
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Beezio?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Secure & Trusted</h3>
              <p className="text-gray-600">Bank-level security with Stripe payment processing</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Global Marketplace</h3>
              <p className="text-gray-600">Sell and buy from anywhere in the world</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Easy to Use</h3>
              <p className="text-gray-600">Simple setup, powerful features, transparent pricing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Built-in Tools and Features */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🛠️ Built-in Tools & Features</h2>
            <p className="text-xl text-gray-600">Everything you need to succeed, included from day one</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Seller Tools */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🏪</span>Seller Tools & Features
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Custom Storefronts</h4>
                  <p className="text-gray-600 text-sm">Professional, mobile-responsive stores with your branding, custom domains, and SEO optimization.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
                  <h4 className="font-semibold text-gray-900 mb-2">RESTful API Integration</h4>
                  <p className="text-gray-600 text-sm">Sync inventory, manage orders, and integrate with your existing systems through our comprehensive API.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Advanced Analytics Dashboard</h4>
                  <p className="text-gray-600 text-sm">Real-time sales tracking, customer insights, conversion metrics, and exportable reports.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-amber-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Integrated Payment Processing</h4>
                  <p className="text-gray-600 text-sm">Stripe integration with automatic payouts, subscription billing, and multi-currency support.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Product Management</h4>
                  <p className="text-gray-600 text-sm">Easy product uploads, image galleries, detailed descriptions, and category organization.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Affiliate Network Access</h4>
                  <p className="text-gray-600 text-sm">Connect with motivated affiliates, set commission rates, and track performance metrics.</p>
                </div>
              </div>
            </div>

            {/* Affiliate Tools */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🚀</span>Affiliate Tools & Features
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Personal Branded Storefronts</h4>
                  <p className="text-gray-600 text-sm">Your own affiliate store with curated products, custom layouts, and personal branding.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Smart Link Generator</h4>
                  <p className="text-gray-600 text-sm">One-click tracked affiliate links with built-in analytics and automatic commission tracking.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Performance Analytics</h4>
                  <p className="text-gray-600 text-sm">Real-time click tracking, conversion rates, earnings reports, and top-product insights.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-amber-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Creative Assets Library</h4>
                  <p className="text-gray-600 text-sm">High-converting banners, product images, email templates, and social media content.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Mobile Apps (iOS & Android)</h4>
                  <p className="text-gray-600 text-sm">Generate links, track earnings, discover products, and manage your business on-the-go.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Gamification & Community</h4>
                  <p className="text-gray-600 text-sm">Earn points, unlock badges, climb leaderboards, and connect with top affiliates.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-pink-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Smart Notifications</h4>
                  <p className="text-gray-600 text-sm">Real-time alerts for new products, commission increases, and optimization opportunities.</p>
                </div>
                
                <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-teal-500">
                  <h4 className="font-semibold text-gray-900 mb-2">Flexible Payment Options</h4>
                  <p className="text-gray-600 text-sm">PayPal, bank transfer, cryptocurrency, or reinvest for bonus commissions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* API and Integration Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🔗 API & Integration Capabilities</h2>
            <p className="text-xl text-gray-600">Connect Beezio with your existing business systems</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">🔌</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">RESTful API</h3>
              <p className="text-gray-600">Complete CRUD operations for products, orders, users, and analytics with comprehensive documentation.</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-time Webhooks</h3>
              <p className="text-gray-600">Instant notifications for orders, payments, affiliate conversions, and inventory changes.</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">🔄</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Third-party Integrations</h3>
              <p className="text-gray-600">Connect with Shopify, WooCommerce, Stripe, PayPal, Mailchimp, and 50+ popular platforms.</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Analytics API</h3>
              <p className="text-gray-600">Access detailed metrics, conversion data, and performance insights programmatically.</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">🛡️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Secure Authentication</h3>
              <p className="text-gray-600">OAuth 2.0, JWT tokens, API keys, and role-based access control for enterprise security.</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">📱</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Mobile SDKs</h3>
              <p className="text-gray-600">Native iOS and Android SDKs for seamless mobile app integration and development.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Previews Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Experience the Platform</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Explore our comprehensive dashboards designed for sellers, affiliates, and buyers. 
              See exactly what you'll get when you join Beezio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Seller Dashboard Preview */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Seller Dashboard</h3>
                  <DollarSign className="h-8 w-8" />
                </div>
                <p className="mt-2 opacity-90">Complete sales management suite</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Revenue Analytics & Tracking
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Product Management Tools
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Affiliate Recruitment System
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Performance Insights
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Order Management
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    Payout Tracking
                  </div>
                </div>
                <Link 
                  to="/dashboard-preview"
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Preview Seller Dashboard
                </Link>
              </div>
            </div>

            {/* Affiliate Dashboard Preview */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Affiliate Dashboard</h3>
                  <TrendingUp className="h-8 w-8" />
                </div>
                <p className="mt-2 opacity-90">Gamified promotion platform</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Leaderboard & Rankings
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Commission Tracking
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Link Management Tools
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Campaign Creation
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Performance Analytics
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Earnings Dashboard
                  </div>
                </div>
                <Link 
                  to="/affiliate-dashboard-preview"
                  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Preview Affiliate Dashboard
                </Link>
              </div>
            </div>

            {/* Buyer Dashboard Preview */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Buyer Dashboard</h3>
                  <Users className="h-8 w-8" />
                </div>
                <p className="mt-2 opacity-90">Enhanced shopping experience</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Order History & Tracking
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Subscription Management
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Personalized Wishlist
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Product Recommendations
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Loyalty Program Benefits
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Support & Returns
                  </div>
                </div>
                <Link 
                  to="/buyer-dashboard-preview"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Preview Buyer Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Affiliate Success Stories & Tips */}
      <section id="affiliate-success" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Affiliate Success on Beezio</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Learn how our top affiliates are building sustainable income streams
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Success Stories */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Success Stories</h3>
              
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      SJ
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Sarah J. - Diamond Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "I went from $0 to $5,000/month in just 6 months by focusing on eco-friendly products. 
                      The transparency and high commission rates make Beezio the best platform I've used."
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $5,000/month
                      </span>
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                        💎 Diamond Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      MR
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Mike R. - Gold Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "The gamification aspect keeps me motivated. Seeing my rank climb and competing 
                      with other affiliates has increased my earnings by 300%!"
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $2,800/month
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                        🥇 Gold Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      LK
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Lisa K. - Silver Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "Started part-time while working my day job. The site-wide affiliate links 
                      mean I earn from every sale, not just specific products!"
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $1,200/month
                      </span>
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
                        🥈 Silver Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Affiliate Tips & Strategies */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">💡 Pro Tips for Success</h3>
              
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-lg p-6">
                  <h4 className="font-bold text-amber-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">🎯</span>
                    Choose Your Niche Wisely
                  </h4>
                  <p className="text-amber-700">
                    Focus on products you're passionate about. Authenticity drives sales. Our top affiliates 
                    average 3x higher conversion rates when promoting products they personally use and love.
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">📱</span>
                    Leverage Social Media
                  </h4>
                  <p className="text-blue-700">
                    Use our built-in social sharing tools and custom link generators. Instagram Stories, 
                    TikTok reviews, and YouTube demos consistently outperform generic ads.
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-6">
                  <h4 className="font-bold text-purple-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">📊</span>
                    Track Everything
                  </h4>
                  <p className="text-purple-700">
                    Use our analytics dashboard daily. Monitor which content performs best, what times 
                    your audience is most active, and which products have the highest conversion rates.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="font-bold text-green-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">🤝</span>
                    Build Relationships
                  </h4>
                  <p className="text-green-700">
                    Connect with sellers directly through our platform. Many offer exclusive deals 
                    and higher commission rates to their top-performing affiliates.
                  </p>
                </div>

                <div className="bg-red-50 rounded-lg p-6">
                  <h4 className="font-bold text-red-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">⚡</span>
                    Act Fast on Trends
                  </h4>
                  <p className="text-red-700">
                    Our trending products dashboard shows what's hot right now. Early adopters 
                    of trending products earn 5x more in their first month than those who wait.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action for Affiliates */}
          <div className="mt-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-8 text-center text-white">
            <h3 className="text-3xl font-bold mb-4">Ready to Start Your Affiliate Journey?</h3>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join over 10,000 affiliates already earning with Beezio. Start promoting today and see 
              your first commission within 24 hours!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transition-colors">
                Start as Affiliate - FREE
              </button>
              <Link 
                to="/affiliate-dashboard-preview"
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-white hover:text-purple-600 transition-colors"
              >
                Preview Affiliate Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-amber-400 to-orange-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of sellers and affiliates building successful businesses on Beezio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-amber-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Selling Today
            </button>
            <button className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-amber-600 transition-colors font-semibold">
              Become an Affiliate
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorksPage;