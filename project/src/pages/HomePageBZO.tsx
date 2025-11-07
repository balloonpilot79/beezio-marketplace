import React from 'react';
import { Store, TrendingUp, Heart, ArrowRight, Check, Globe, CreditCard } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const features = [
    {
      icon: <Store className="w-12 h-12 text-[#FFD700]" />,
      title: "For Sellers",
      description: "Create your free custom website. Bring your own domain. Use our POS checkout system. Set your own commission rates.",
      link: "/sellers"
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-[#FFD700]" />,
      title: "For Affiliates", 
      description: "Earn 5% lifetime commission on every sale from people you refer. Get your own custom storefront. Choose products to promote.",
      link: "/affiliates"
    },
    {
      icon: <Heart className="w-12 h-12 text-[#FFD700]" />,
      title: "For Fundraisers",
      description: "Launch your custom fundraising store. Promote products and earn for your cause. Manage everything from one dashboard.",
      link: "/fundraisers"
    }
  ];

  const benefits = [
    "Free custom websites for sellers",
    "Bring your own domain",
    "Built-in POS checkout system",
    "5% lifetime affiliate commissions",
    "Choose your commission rates",
    "Custom storefronts for all users"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Full Width */}
      <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
        <div className="container mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 leading-tight tracking-tight">
              Sell. Earn. Grow.
              <br />
              <span className="text-[#FFD700]">All on Beezio.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Create your own free store, use your own domain, and earn lifetime commissions.
            </p>
            
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