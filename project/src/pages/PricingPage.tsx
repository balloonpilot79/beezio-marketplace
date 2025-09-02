import React from 'react';

const PricingPage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            No monthly fees, no setup costs, no hidden charges. You only pay when you earn.
          </p>
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-purple-600 mb-6">How It Works</h2>
            <div className="text-left space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span>Your Product Price</span>
                <span className="font-bold text-green-600">$29.99</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span>Beezio Platform Fee (10%)</span>
                <span className="text-red-600">+$2.99</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span>Affiliate Commission (varies)</span>
                <span className="text-red-600">+$3.00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span>Stripe Processing Fee (3%)</span>
                <span className="text-red-600">+$0.99</span>
              </div>
              <div className="flex justify-between items-center py-2 text-lg font-bold bg-gray-50 p-3 rounded">
                <span>Customer Pays</span>
                <span>$36.97</span>
              </div>
              <div className="flex justify-between items-center py-2 text-xl font-bold text-green-600 bg-green-50 p-3 rounded">
                <span>You Receive</span>
                <span>$29.99</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              * Affiliate commission rates vary by product (typically 10-30%)
            </p>
          </div>
          <div className="mt-12">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              🚀 Start Selling Free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
