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
            Join thousands of successful sellers, affiliates, and fundraisers who are earning on Beezio.
          </p>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-4">For Sellers</h3>
              <p className="text-gray-600">Create and sell digital products with zero upfront costs.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-4">For Affiliates</h3>
              <p className="text-gray-600">Promote products and earn commissions on every sale.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-4">For Fundraisers</h3>
              <p className="text-gray-600">Raise funds for causes while earning from referrals.</p>
            </div>
          </div>
          <button
            onClick={onOpenSimpleSignup}
            className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
          >
            🚀 Start Earning Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartEarningPage;
