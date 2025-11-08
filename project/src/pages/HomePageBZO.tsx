import React from 'react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="bg-white text-black text-center px-5 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-3">Create an Online Marketplace with Beezio</h1>
          <p className="text-lg max-w-3xl mx-auto mb-6 leading-relaxed">
            Sell products and run your own store on a customizable marketplace platform — or earn passive income as an affiliate.
          </p>
          <button 
            onClick={onOpenSimpleSignup}
            className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-semibold text-lg px-6 py-3 rounded transition-all duration-300"
          >
            Get Started
          </button>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="bg-[#f9d900] text-center px-5 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-5">What is Beezio?</h2>
          <p className="text-lg leading-relaxed">
            Beezio is an online marketplace that empowers sellers to build their own stores, list products, and manage affiliates — all in one platform. Affiliates earn lifetime commissions, fundraisers can raise money through custom stores, and buyers shop easily from verified sellers.
          </p>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-12 py-16 bg-white">
        {/* For Sellers */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">For Sellers</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>Custom storefronts under your domain</li>
            <li>Stripe checkout through Beezio</li>
            <li>Optional affiliate system with flexible commissions</li>
          </ul>
        </div>

        {/* For Affiliates */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">For Affiliates</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>5% lifetime commissions sitewide</li>
            <li>Earn more with seller-defined bonuses</li>
          </ul>
        </div>

        {/* For Fundraisers */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">For Fundraisers</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>Launch cause-based stores (shirts, merch, donations)</li>
            <li>All affiliate earnings go toward your cause</li>
          </ul>
        </div>

        {/* For Buyers */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">For Buyers</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>Shop safely from trusted sellers</li>
            <li>Support fundraisers and affiliates</li>
          </ul>
        </div>

        {/* Custom Stores & Domains */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">Custom Stores & Domains</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>Bring your own domain or use Beezio subdomain</li>
            <li>Flexible design options</li>
          </ul>
        </div>

        {/* API Integrations */}
        <div className="bg-[#f8f8f8] p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-3 text-black">API Integrations</h3>
          <ul className="list-none space-y-2 text-sm">
            <li>Connect with Beezio's API for automation</li>
            <li>Import or sync external products</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default HomePage;