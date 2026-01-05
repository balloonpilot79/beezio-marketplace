import React from 'react';
import { Link } from 'react-router-dom';

const SellerCompletePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">🏪 Start Selling on Beezio</h1>
          <p className="text-xl opacity-90">
            Join thousands of sellers reaching customers worldwide with our global marketplace
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">How Selling Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">1. List Your Products</h3>
              <p className="text-gray-600">
                Upload photos, write descriptions, and set your prices. Our global sourcing system helps optimize your inventory.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Get Affiliates</h3>
              <p className="text-gray-600">
                Our network connects you with affiliates who promote your products. You set the commission rates.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Earn Money</h3>
              <p className="text-gray-600">
                Receive payments instantly when orders are placed. Track your earnings in real-time.
              </p>
            </div>
          </div>
        </section>

        {/* Fees Structure */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">💳 Fee Structure</h2>
          
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-semibold text-green-600 mb-4">Simple, Transparent Pricing</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="font-medium">Platform Fee</span>
                    <span className="text-xl font-bold text-green-600">5%</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="font-medium">Payment Processing</span>
                    <span className="text-xl font-bold">2.9% + $0.30</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="font-medium">Listing Fee</span>
                    <span className="text-xl font-bold text-green-600">FREE</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="font-medium">Monthly Fee</span>
                    <span className="text-xl font-bold text-green-600">FREE</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold mb-4">Example: $100 Sale</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sale Amount:</span>
                    <span>$100.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee (5%):</span>
                    <span className="text-red-600">-$5.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Processing:</span>
                    <span className="text-red-600">-$3.20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Affiliate Commission:</span>
                    <span className="text-red-600">-$10.00</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Your Earnings:</span>
                    <span className="text-green-600">$81.80</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🚀 Why Sell on Beezio?</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🌍 Global Reach</h3>
              <p className="text-gray-600">
                Access customers worldwide with our multi-language, multi-currency platform and global sourcing network.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🤖 Smart Automation</h3>
              <p className="text-gray-600">
                Zapier integrations automate your workflow. From inventory management to order fulfillment.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">📈 Built-in Marketing</h3>
              <p className="text-gray-600">
                Our affiliate network promotes your products. You don't pay unless they make sales.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">💼 Professional Tools</h3>
              <p className="text-gray-600">
                Advanced analytics, inventory management, and customer insights to grow your business.
              </p>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎯 Getting Started</h2>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-lg border">
            <h3 className="text-2xl font-semibold mb-4">Ready to Start Selling?</h3>
            <p className="text-gray-700 mb-6">
              Join our community of successful sellers and start earning today. No upfront costs, no monthly fees.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-center"
              >
                Start Selling Now
              </Link>
              
              <Link
                to="/dashboard-preview"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-200 text-center"
              >
                View Seller Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">❓ Frequently Asked Questions</h2>
          
          <div className="space-y-4">
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">How do I get paid?</summary>
              <p className="mt-3 text-gray-600">
                Payments are processed instantly to your bank account or PayPal. You can track all earnings in your seller dashboard.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">Can I sell internationally?</summary>
              <p className="mt-3 text-gray-600">
                Yes! Our global platform supports multiple currencies and languages. Our sourcing system helps you fulfill orders worldwide.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">How do affiliate commissions work?</summary>
              <p className="mt-3 text-gray-600">
                You set the commission rate (typically 10-30%). Affiliates only earn when they generate sales, so it's performance-based marketing.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">What support do you provide?</summary>
              <p className="mt-3 text-gray-600">
                24/7 seller support, marketing resources, analytics tools, and access to our global sourcing network and automation tools.
              </p>
            </details>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SellerCompletePage;
