import React from 'react';

const StartEarningPage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
            Start Earning Today
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of successful sellers and affiliates who are earning commissions on Beezio's marketplace.
          </p>
          <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-green-100">
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-2xl font-bold text-green-600 mb-4">For Sellers</h3>
              <p className="text-gray-600 mb-4">Create and sell digital products with zero upfront costs. Earn from every sale with our automated system.</p>
              <ul className="text-left text-sm text-gray-600 space-y-2">
                <li>✅ Zero inventory costs</li>
                <li>✅ Automated fulfillment</li>
                <li>✅ Global reach</li>
                <li>✅ Real-time analytics</li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-blue-100">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-2xl font-bold text-blue-600 mb-4">For Affiliates</h3>
              <p className="text-gray-600 mb-4">Promote products and earn generous commissions on every successful referral.</p>
              <ul className="text-left text-sm text-gray-600 space-y-2">
                <li>✅ High commission rates</li>
                <li>✅ Real-time tracking</li>
                <li>✅ Multiple payment options</li>
                <li>✅ Marketing tools provided</li>
              </ul>
            </div>
          </div>
          <button
            onClick={onOpenSimpleSignup}
            className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
          >
            � Start Earning Commissions
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartEarningPage;
