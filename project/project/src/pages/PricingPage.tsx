import React from 'react';

const PricingPage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
            Stores are free. Fees live inside the sale price.
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            No subscriptions or setup costs. The buyer sees one clean price that includes platform and processing fees while you keep what you set.
          </p>
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-2xl mx-auto space-y-4 text-left">
            <h2 className="text-2xl font-bold text-purple-600">How it works</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>You set the amount you want to keep per sale.</li>
              <li>Shipping is separate and calculated at checkout based on your settings.</li>
              <li>Beezio bakes platform and processing fees into the buyer price so checkout stays simple.</li>
              <li>Pricing is transparent and shown before purchase.</li>
            </ul>
            <p className="text-sm text-gray-500">
              Sellers never pay for a store. Beezio only earns from the baked-in fee on each sale.
            </p>
          </div>
          <div className="mt-12">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              Start selling free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
