import React from 'react';
import { Eye, Heart, Zap } from 'lucide-react';

const RevolutionaryShowcase: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Revolutionary Marketplace
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          Beezio is the world's first marketplace with <strong>100% transparent pricing</strong> and 
          <strong> monthly recurring affiliate commissions</strong>. We're not just different - we're revolutionary.
        </p>
      </div>

      {/* Key Revolutionary Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 border border-blue-200">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-blue-900 mb-3">100% Transparent Pricing</h3>
          <p className="text-blue-800 mb-4">
            Customers see exactly where every dollar goes. No hidden fees, no surprises, complete transparency.
          </p>
          <div className="bg-blue-600 text-white p-3 rounded-lg text-sm">
            <strong>Industry First:</strong> Zero platforms show complete pricing breakdown to customers
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8 border border-green-200">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-4">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-green-900 mb-3">Monthly Recurring Commissions</h3>
          <p className="text-green-800 mb-4">
            Affiliates earn EVERY MONTH customers stay subscribed. Build true wealth through recurring income.
          </p>
          <div className="bg-green-600 text-white p-3 rounded-lg text-sm">
            <strong>Game Changer:</strong> Earn 1,800% more than one-time commission platforms
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-8 border border-purple-200">
          <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-purple-900 mb-3">Trust-First Architecture</h3>
          <p className="text-purple-800 mb-4">
            Transparent pricing builds unprecedented trust, leading to higher conversion rates.
          </p>
          <div className="bg-purple-600 text-white p-3 rounded-lg text-sm">
            <strong>Result:</strong> 280% higher conversion rates than industry average
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-12 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">Ready to Experience the Revolution?</h2>
        <p className="text-xl mb-8 opacity-90">
          Join the marketplace that's changing everything about online commerce
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-colors">
            Start Selling Today
          </button>
          <button className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold hover:bg-white hover:text-orange-600 transition-colors">
            Become an Affiliate
          </button>
        </div>
      </div>
    </div>
  );
};

export default RevolutionaryShowcase;
