import React from 'react';
import { ArrowRight, CheckCircle, Store, Megaphone } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import { getPartnerLabel, getPartnerProgramLabel } from '../utils/processorSafeCopy';

const StartEarningPage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  return (
    <PublicLayout>
      <div className="space-y-12">
        <section className="text-center space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
            {getPartnerProgramLabel()}
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">
            Start selling or promoting with clear storefronts and clear payouts
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            Sellers get a custom storefront, affiliates and influencers can start free, and Beezio keeps checkout, tracking,
            and promotion tools in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-amber-500 text-black px-8 py-3 rounded-full font-semibold hover:bg-amber-600 transition-colors"
            >
              Get started
            </button>
            <button
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="border border-gray-300 text-gray-800 px-8 py-3 rounded-full font-semibold hover:border-gray-400 transition-colors"
            >
              I already have an account
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-700">
                <Store className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">For Sellers</h2>
            </div>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Every seller gets a custom storefront for products, collections, and brand presentation.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Products you add to Beezio populate into your storefront automatically.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Set the amount you want to earn and let Beezio add required costs on top of that target.
              </li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-700">
                <Megaphone className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">For {getPartnerLabel()}</h2>
            </div>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Join free and get access to share tools after approval.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Share curated storefronts, collections, and tracked product links.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                Earn from attributed activity without paying a monthly subscription fee to participate.
              </li>
            </ul>
          </div>
        </section>

        <section className="border border-amber-200 bg-amber-50/60 rounded-2xl p-6 text-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">How the program works</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Create a Beezio account and complete your profile.</li>
            <li>Sellers launch a storefront. Affiliates and influencers apply for access to share tools.</li>
            <li>Use Beezio storefronts, product links, and checkout to sell or promote with trackable activity.</li>
          </ol>
          <p className="text-sm mt-4">
            Purchases are completed through Beezio checkout, and orders are fulfilled by sellers or their suppliers.
          </p>
        </section>

        <section className="text-center">
          <button
            onClick={onOpenSimpleSignup}
            className="inline-flex items-center gap-2 bg-black text-amber-300 px-8 py-3 rounded-full font-semibold hover:bg-black/90 transition-colors"
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>
    </PublicLayout>
  );
};

export default StartEarningPage;
