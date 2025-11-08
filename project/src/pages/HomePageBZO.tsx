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
    <div className="min-h-screen bg-white">
      {/* HERO SLIDER SECTION */}
      <section className="bg-white text-black px-5 py-8 relative overflow-hidden">
        {/* Decorative Bees */}
        <img src="/bzobee.png" alt="" className="absolute top-4 left-8 w-16 h-16 opacity-30" />
        <img src="/bzobee.png" alt="" className="absolute top-8 right-12 w-14 h-14 opacity-25" />
        
        <div className="max-w-3xl mx-auto relative z-10">
          {/* Slider */}
          <div className="relative h-40 flex items-center justify-center">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-all duration-700 ${
                  index === currentSlide
                    ? 'opacity-100 translate-x-0'
                    : index < currentSlide
                    ? 'opacity-0 -translate-x-full'
                    : 'opacity-0 translate-x-full'
                }`}
              >
                <div className="mb-2.5">{React.cloneElement(slide.icon as React.ReactElement, { className: 'w-11 h-11 text-[#ffcc00]' })}</div>
                <h2 className="text-xl font-bold mb-2">{slide.title}</h2>
                <p className="text-sm max-w-xl mx-auto leading-relaxed text-gray-700">
                  {slide.description}
                </p>
              </div>
            ))}
          </div>

          {/* Slide Indicators */}
          <div className="flex justify-center gap-2 mt-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-7 bg-[#ffcc00]'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex justify-center mt-5">
            <button 
              onClick={onOpenSimpleSignup}
              className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-semibold text-sm px-6 py-2.5 rounded transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="bg-[#f9d900] text-center px-5 py-10 relative overflow-hidden">
        {/* Decorative Bees */}
        <img src="/bzobee.png" alt="" className="absolute bottom-6 left-16 w-20 h-20 opacity-25" />
        <img src="/bzobee.png" alt="" className="absolute top-6 right-20 w-14 h-14 opacity-30" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-2xl font-bold mb-3">What is Beezio?</h2>
          <p className="text-base leading-relaxed">
            Beezio is an online marketplace that empowers sellers to build their own stores, list products, and manage affiliates — all in one platform. Affiliates earn lifetime commissions, fundraisers can raise money through custom stores, and buyers shop easily from verified sellers.
          </p>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-12 py-16 bg-white">
        {/* For Sellers */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">For Sellers</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ Custom storefronts under your domain</li>
            <li>✓ Stripe checkout through Beezio</li>
            <li>✓ Optional affiliate system with flexible commissions</li>
          </ul>
        </div>

        {/* For Affiliates */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">For Affiliates</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ 5% lifetime commissions sitewide</li>
            <li>✓ Earn more with seller-defined bonuses</li>
          </ul>
        </div>

        {/* For Fundraisers */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">For Fundraisers</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ Launch cause-based stores (shirts, merch, donations)</li>
            <li>✓ All affiliate earnings go toward your cause</li>
          </ul>
        </div>

        {/* For Buyers */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">For Buyers</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ Shop safely from trusted sellers</li>
            <li>✓ Support fundraisers and affiliates</li>
          </ul>
        </div>

        {/* Custom Stores & Domains */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">Custom Stores & Domains</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ Bring your own domain or use Beezio subdomain</li>
            <li>✓ Flexible design options</li>
          </ul>
        </div>

        {/* API Integrations */}
        <div className="bg-white border-2 border-[#ffcc00] p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-bold mb-3 text-black">API Integrations</h3>
          <ul className="list-none space-y-2 text-sm text-gray-700">
            <li>✓ Connect with Beezio's API for automation</li>
            <li>✓ Import or sync external products</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default HomePage;