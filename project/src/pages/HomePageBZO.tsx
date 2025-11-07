import React from 'react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="bg-[#111] text-white text-center px-5 py-32">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">Create an Online Marketplace with Beezio</h1>
          <p className="text-xl max-w-3xl mx-auto mb-8 leading-relaxed">
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
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <button
                onClick={onOpenSimpleSignup}
                className="bg-[#FFD700] hover:bg-[#FFC700] text-gray-900 px-10 py-5 rounded-lg text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.location.href = '/how-it-works'}
                className="bg-transparent border-2 border-gray-300 hover:border-[#FFD700] text-gray-900 px-10 py-5 rounded-lg text-lg font-semibold transition-all duration-200"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="py-16 bg-white border-b border-gray-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 text-sm md:text-base">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Choose Your Path
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Whether you're selling, promoting, or fundraising—Beezio has the tools you need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white rounded-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group"
              >
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl group-hover:bg-[#FFD700]/10 transition-colors">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed text-center">
                  {feature.description}
                </p>
                <a
                  href={feature.link}
                  className="block text-center text-[#FFD700] font-semibold hover:underline"
                >
                  Learn More →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Features */}
      <div className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">
              Everything You Need to Succeed
            </h2>
            
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#FFD700]/10 rounded-lg">
                    <Globe className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Custom Domains</h3>
                    <p className="text-gray-600">Bring your own domain or use a free Beezio subdomain. Full branding control.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#FFD700]/10 rounded-lg">
                    <CreditCard className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Built-in POS System</h3>
                    <p className="text-gray-600">Accept payments seamlessly with our integrated checkout system. No third-party needed.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#FFD700]/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Lifetime Commissions</h3>
                    <p className="text-gray-600">Affiliates earn 5% on every sale from their referrals—forever. Build passive income.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#FFD700]/10 rounded-lg">
                    <Store className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Full Store Control</h3>
                    <p className="text-gray-600">Manage products, set commission rates, upload unlimited photos. Your store, your rules.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gray-900">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Ready to Build Your Business?
            </h2>
            <p className="text-xl text-gray-300">
              Join Beezio today and start selling, earning, or fundraising in minutes—completely free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button
                onClick={onOpenSimpleSignup}
                className="bg-[#FFD700] hover:bg-[#FFC700] text-gray-900 px-12 py-5 rounded-lg text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Get Started Free
              </button>
              <button
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                className="bg-transparent border-2 border-white hover:bg-white hover:text-gray-900 text-white px-12 py-5 rounded-lg text-lg font-semibold transition-all duration-200"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;