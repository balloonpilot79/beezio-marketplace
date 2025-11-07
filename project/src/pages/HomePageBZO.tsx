import React from 'react';
import { ShoppingBag, Megaphone, Heart, ArrowRight } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const features = [
    {
      icon: <img src="/bee-mascot.png" alt="Sell Products" className="w-12 h-12" />,
      title: "Join as a Seller",
      description: "List your products and set commission rates.",
      action: "Start Selling"
    },
    {
      icon: <img src="/bee-mascot.png" alt="Promote Products" className="w-12 h-12" />,
      title: "Promote & Earn", 
      description: "Choose from a variety of products to promote",
      action: "Start Promoting"
    },
    {
      icon: <img src="/bee-mascot.png" alt="Refer Others" className="w-12 h-12" />,
      title: "Raise Funds",
      description: "Create campaigns and receive support",
      action: "Start Campaign"
    }
  ];

  return (
    <div className="min-h-screen bg-bzo-gradient">
      {/* Hero Section */}
      <div className="hero-bzo">
        <div className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl md:text-6xl font-bold text-bzo-black leading-tight">
                  Boost Your Income
                  <br />
                  <span className="text-bzo-yellow-primary">with Affiliate Marketing</span>
                </h1>
                <p className="text-xl text-gray-600 max-w-lg">
                  Connect with sellers, promote products, and earn commissions.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onOpenSimpleSignup}
                  className="btn-bzo-primary px-8 py-4 rounded-full text-lg font-semibold flex items-center justify-center gap-2 group"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="btn-bzo-outline px-8 py-4 rounded-full text-lg font-semibold"
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* Right - BZO Mascot */}
            <div className="flex justify-center">
              <div className="bzo-mascot">
                <div className="w-80 h-80 relative">
                  {/* BZO SVG Placeholder - We'll add the actual image later */}
                  <div className="w-full h-full bg-gradient-to-br from-bzo-yellow-primary to-bzo-yellow-secondary rounded-full flex items-center justify-center shadow-2xl">
                    <div className="text-center">
                      <img src="/bee-mascot.png" alt="BZO Bee Mascot" className="w-16 h-16 mb-4 mx-auto" />
                      <div className="text-2xl font-bold text-bzo-black">BZO</div>
                      <div className="text-sm text-bzo-black opacity-75">the bee</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-bzo p-8 text-center group">
                <div className="flex justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-bzo-black mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                <button 
                  onClick={onOpenSimpleSignup}
                  className="btn-bzo-outline px-6 py-3 rounded-full font-semibold w-full group-hover:btn-bzo-primary transition-all duration-300"
                >
                  {feature.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-bzo-black text-center">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl font-bold text-bzo-white">
              Ready to Start Your Journey with BZO?
            </h2>
            <p className="text-xl text-gray-300">
              Join thousands of sellers and affiliates already earning with Beezio's marketplace.
            </p>
            <button
              onClick={onOpenSimpleSignup}
              className="btn-bzo-primary px-10 py-4 rounded-full text-xl font-semibold"
            >
              🚀 Join the Hive Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;