import React from 'react';
import { ArrowRight, DollarSign, Users, TrendingUp } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const features = [
    {
      icon: <DollarSign className="w-8 h-8 text-bzo-black" />,
      title: "Join as a Seller",
      description: "List products and earn",
      action: "Start Selling"
    },
    {
      icon: <Users className="w-8 h-8 text-bzo-black" />,
      title: "Promote & Earn", 
      description: "Promote products for commission",
      action: "Start Promoting"
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-bzo-black" />,
      title: "Raise Funds",
      description: "Create fundraising campaigns",
      action: "Start Campaign"
    }
  ];

  return (
    <div className="min-h-screen bg-white flex items-center">
      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold text-black leading-tight">
                Boost Your Income
                <br />
                <span className="text-bzo-yellow-primary">with Affiliate Marketing</span>
              </h1>
              <p className="text-lg text-black max-w-lg">
                Connect with sellers, promote products, and earn commissions.
              </p>
            </div>
            
            {/* Three Feature Cards in One Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white border-2 border-bzo-yellow-primary rounded-xl p-4 text-center">
                  <div className="flex justify-center mb-2">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-bold text-black mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-black mb-3">
                    {feature.description}
                  </p>
                  <button 
                    onClick={onOpenSimpleSignup}
                    className="bg-gradient-to-r from-bzo-yellow-primary to-bzo-yellow-secondary hover:from-bzo-yellow-secondary hover:to-bzo-yellow-primary text-black px-4 py-2 rounded-full font-semibold w-full shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {feature.action}
                  </button>
                </div>
              ))}
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onOpenSimpleSignup}
                className="bg-gradient-to-r from-bzo-yellow-primary to-bzo-yellow-secondary hover:from-bzo-yellow-secondary hover:to-bzo-yellow-primary text-black px-8 py-4 rounded-full text-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                🚀 Join the Hive Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                className="bg-gradient-to-r from-bzo-yellow-secondary to-bzo-yellow-primary hover:from-bzo-yellow-primary hover:to-bzo-yellow-secondary text-black px-8 py-4 rounded-full text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                Sign In
              </button>
            </div>

            {/* Stats */}
            <div className="flex flex-row gap-6 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-black">10K+</div>
                <div className="text-sm text-black">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-black">$2M+</div>
                <div className="text-sm text-black">Earned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-black">500+</div>
                <div className="text-sm text-black">Products</div>
              </div>
            </div>
          </div>

          {/* Right - Bigger BZO Mascot */}
          <div className="flex justify-center items-center">
            <img 
              src="/bee-mascot.png" 
              alt="BZO Bee Mascot" 
              className="w-80 h-80 lg:w-96 lg:h-96 object-contain" 
              style={{ filter: 'brightness(1.1) contrast(1.1)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;