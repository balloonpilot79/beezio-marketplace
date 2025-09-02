import React from 'react';
import { DollarSign, Shield, Zap, Globe, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const SellersPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-green-400 to-emerald-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">For Sellers</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Turn your products into profit with our transparent marketplace
          </p>
        </div>
      </section>

      {/* How It Works for Sellers */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, Transparent Process</h2>
            <p className="text-xl text-gray-600">Set your profit, choose commission rates, and start selling</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* For Sellers */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">How Selling Works</h3>
              <div className="space-y-4 text-left max-w-2xl mx-auto">
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

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-green-200">
                <span className="text-gray-700 font-medium">Seller's desired profit</span>
                <span className="text-green-600 font-bold text-lg">$100.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-green-200">
                <span className="text-gray-700 font-medium">Affiliate commission (20%)</span>
                <span className="text-blue-600 font-bold text-lg">$20.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-green-200">
                <span className="text-gray-700 font-medium">Beezio platform fee (10%)</span>
                <span className="text-amber-600 font-bold text-lg">$12.00</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-green-200">
                <span className="text-gray-700 font-medium">Stripe processing fee (3%)</span>
                <span className="text-purple-600 font-bold text-lg">$4.08</span>
              </div>
              <div className="flex justify-between items-center py-4 bg-white rounded-lg px-4 border-2 border-green-300">
                <span className="text-gray-900 font-bold text-xl">Customer pays</span>
                <span className="text-green-600 font-bold text-2xl">$136.08</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-green-100 rounded-lg">
              <p className="text-green-800 text-center">
                <strong>You get exactly $100 profit!</strong> Affiliates earn $20, Beezio gets $12, Stripe gets $4.08
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Sell on Beezio?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Secure & Trusted</h3>
              <p className="text-gray-600">Bank-level security with Stripe payment processing</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Global Reach</h3>
              <p className="text-gray-600">Sell to customers worldwide with built-in affiliate network</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Easy Setup</h3>
              <p className="text-gray-600">List products in minutes, start selling immediately</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seller Tools and Features */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🛠️ Seller Tools & Features</h2>
            <p className="text-xl text-gray-600">Everything you need to succeed, included from day one</p>
          </div>

          <div className="max-w-4xl mx-auto">
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
        </div>
      </section>

      {/* Seller Dashboard Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Experience Your Seller Dashboard</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See exactly what you'll have access to as a Beezio seller. No registration required!
            </p>
          </div>

          <div className="max-w-md mx-auto">
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
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-green-400 to-emerald-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of sellers building successful businesses on Beezio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-green-600 px-8 py-3 rounded-lg text-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Selling Today
            </button>
            <Link 
              to="/dashboard-preview"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-green-600 transition-colors font-semibold"
            >
              Preview Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellersPage;
