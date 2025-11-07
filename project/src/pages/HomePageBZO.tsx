import React from 'react';
import { ArrowRight, DollarSign, Users, TrendingUp } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const features = [
    {
      icon: <DollarSign className="w-10 h-10 text-bzo-primary" />,
      title: "Join as a Seller",
      description: "List products and earn commissions",
      action: "Start Selling"
    },
    {
      icon: <Users className="w-10 h-10 text-bzo-primary" />,
      title: "Promote & Earn", 
      description: "Promote products for commission",
      action: "Start Promoting"
    },
    {
      icon: <TrendingUp className="w-10 h-10 text-bzo-primary" />,
      title: "Raise Funds",
      description: "Create fundraising campaigns",
      action: "Start Campaign"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section (condensed to keep cards above the fold) */}
      <div className="container mx-auto px-6 py-8">
        {/* Single column to reduce height */}
        <div className="max-w-5xl">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold text-black leading-tight">
                Boost Your Income
                <br />
                <span className="text-bzo-yellow-primary">with Affiliate Marketing</span>
              </h1>
              <p className="text-xl text-black max-w-2xl">
                Connect with sellers, promote products, and earn commissions. Join thousands already earning with Beezio's transparent marketplace.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onOpenSimpleSignup}
                className="btn-bzo-primary px-10 py-4 rounded-full text-xl font-bold flex items-center justify-center gap-2"
              >
                🚀 Join the Hive Today
                <ArrowRight className="w-6 h-6" />
              </button>
              <button
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="btn-bzo-primary px-8 py-4 rounded-full text-xl font-semibold"
              >
                Sign In
              </button>
            </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-12">
        <div className="container mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-black mb-4">Three Ways to Earn with Beezio</h2>
            <p className="text-lg text-black">Choose your path to financial success</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white border-2 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-200"
                style={{ borderColor: 'var(--bzo-yellow-primary)' }}
              >
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-black mb-3">
                  {feature.title}
                </h3>
                <p className="text-base text-black mb-6">
                  {feature.description}
                </p>
                <button 
                  onClick={onOpenSimpleSignup}
                  className="btn-bzo-primary px-6 py-3 rounded-full font-bold w-full"
                >
                  {feature.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats moved below the three cards */}
      <div className="bg-white py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-row flex-wrap gap-8 justify-center">
            <div className="text-center min-w-[120px]">
              <div className="text-3xl font-bold text-black">10K+</div>
              <div className="text-base text-black">Active Users</div>
            </div>
            <div className="text-center min-w-[120px]">
              <div className="text-3xl font-bold text-black">$2M+</div>
              <div className="text-base text-black">Total Earned</div>
            </div>
            <div className="text-center min-w-[120px]">
              <div className="text-3xl font-bold text-black">500+</div>
              <div className="text-base text-black">Products</div>
            </div>
            <div className="text-center min-w-[120px]">
              <div className="text-3xl font-bold text-black">24/7</div>
              <div className="text-base text-black">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* What Makes Beezio Different */}
      <div className="py-12 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-black mb-4">Why Choose Beezio?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-lg font-bold text-black mb-2">Transparent Fees</h3>
              <p className="text-black">No hidden costs. Know exactly what you earn.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-lg font-bold text-black mb-2">Instant Payouts</h3>
              <p className="text-black">Get paid immediately when you make a sale.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="text-lg font-bold text-black mb-2">Community First</h3>
              <p className="text-black">Built by affiliates, for affiliates and sellers.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🛡️</div>
              <h3 className="text-lg font-bold text-black mb-2">Secure Platform</h3>
              <p className="text-black">Enterprise-grade security for your business.</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={onOpenSimpleSignup}
              className="btn-bzo-primary px-12 py-4 rounded-full text-xl font-bold"
            >
              Start Earning Today →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;