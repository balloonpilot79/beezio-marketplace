import React, { useState, useEffect } from 'react';
import { Store, Users, TrendingUp, Globe, Package, Zap } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: <Store className="w-11 h-11 text-[#ffcc00]" />,
      title: "Build Your Online Store",
      description: "Create a professional marketplace with your own custom domain and branding"
    },
    {
      icon: <Users className="w-11 h-11 text-[#ffcc00]" />,
      title: "Affiliate Marketing Platform",
      description: "Enable affiliates to promote your products and earn lifetime commissions"
    },
    {
      icon: <TrendingUp className="w-11 h-11 text-[#ffcc00]" />,
      title: "Grow Your Revenue",
      description: "Leverage our commission structure to scale your business with affiliates"
    },
    {
      icon: <Globe className="w-11 h-11 text-[#ffcc00]" />,
      title: "Custom Domains",
      description: "Use your own domain or get a free Beezio subdomain for your store"
    },
    {
      icon: <Package className="w-11 h-11 text-[#ffcc00]" />,
      title: "Product Management",
      description: "Easy-to-use tools for uploading products, managing inventory, and tracking orders"
    },
    {
      icon: <Zap className="w-11 h-11 text-[#ffcc00]" />,
      title: "Launch in Minutes",
      description: "Get your marketplace up and running quickly with our streamlined setup process"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50">
      {/* HERO SLIDER SECTION */}
      <section className="relative px-5 py-8 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-yellow-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Floating Badge */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-yellow-300 rounded-full px-4 py-1.5 shadow-lg animate-float">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
              </span>
              <span className="text-xs font-semibold text-gray-800">🚀 Launch Your Store in Minutes</span>
            </div>
          </div>

          {/* Slider with Glass Effect */}
          <div className="relative h-40 flex items-center justify-center bg-white/40 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-6">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-all duration-700 p-8 ${
                  index === currentSlide
                    ? 'opacity-100 translate-x-0 scale-100'
                    : index < currentSlide
                    ? 'opacity-0 -translate-x-full scale-95'
                    : 'opacity-0 translate-x-full scale-95'
                }`}
              >
                <div className="mb-3 transform transition-transform duration-500 hover:scale-110">
                  {React.cloneElement(slide.icon as React.ReactElement, { className: 'w-10 h-10 text-[#ffcc00] drop-shadow-lg' })}
                </div>
                <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                  {slide.title}
                </h2>
                <p className="text-sm max-w-2xl mx-auto leading-relaxed text-gray-700 font-medium">
                  {slide.description}
                </p>
              </div>
            ))}
          </div>

          {/* Slide Indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${
                  index === currentSlide
                    ? 'w-8 bg-gradient-to-r from-[#ffcc00] to-[#ffd700] shadow-yellow-300'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400 hover:w-5'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* CTA Button with Glow Effect */}
          <div className="flex justify-center mt-5 gap-4">
            <button 
              onClick={onOpenSimpleSignup}
              className="group relative bg-gradient-to-r from-[#ffcc00] to-[#ffd700] hover:from-[#ffd700] hover:to-[#ffcc00] text-black font-bold text-sm px-6 py-3 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-yellow-300/50 hover:scale-105 transform"
            >
              <span className="relative z-10">Start Earning Today - It's Free</span>
              <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES GRID with Hover Effects */}
      <section className="px-5 py-10 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Everything You Need to Succeed
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* For Sellers */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Store className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">For Sellers</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Custom storefronts under your domain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Stripe checkout through Beezio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Optional affiliate system with flexible commissions</span>
                </li>
              </ul>
            </div>

            {/* For Affiliates */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">For Affiliates</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>5% lifetime commissions sitewide</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Earn more with seller-defined bonuses</span>
                </li>
              </ul>
            </div>

            {/* For Fundraisers */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">For Fundraisers</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Launch cause-based stores (shirts, merch, donations)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>All affiliate earnings go toward your cause</span>
                </li>
              </ul>
            </div>

            {/* For Buyers */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">For Buyers</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Shop safely from trusted sellers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Support fundraisers and affiliates</span>
                </li>
              </ul>
            </div>

            {/* Custom Stores & Domains */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">Custom Stores & Domains</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Bring your own domain or use Beezio subdomain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Flexible design options</span>
                </li>
              </ul>
            </div>

            {/* API Integrations */}
            <div className="group bg-white border-2 border-yellow-300 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-200/50 transition-all duration-300 hover:-translate-y-2 hover:border-yellow-400">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-gray-900">API Integrations</h3>
              <ul className="list-none space-y-2 text-xs text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Connect with Beezio's API for automation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">✓</span>
                  <span>Import or sync external products</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;