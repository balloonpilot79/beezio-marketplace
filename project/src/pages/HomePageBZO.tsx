import React, { useState, useEffect } from 'react';
import { Store, Users, TrendingUp, Globe, Package, Zap } from 'lucide-react';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: <Store className="w-12 h-12 text-[#ffcc00]" />,
      title: "Build Your Online Store",
      description: "Create a professional marketplace with your own custom domain and branding"
    },
    {
      icon: <Users className="w-12 h-12 text-[#ffcc00]" />,
      title: "Affiliate Marketing Platform",
      description: "Enable affiliates to promote your products and earn lifetime commissions"
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-[#ffcc00]" />,
      title: "Grow Your Revenue",
      description: "Leverage our commission structure to scale your business with affiliates"
    },
    {
      icon: <Globe className="w-12 h-12 text-[#ffcc00]" />,
      title: "Custom Domains",
      description: "Use your own domain or get a free Beezio subdomain for your store"
    },
    {
      icon: <Package className="w-12 h-12 text-[#ffcc00]" />,
      title: "Product Management",
      description: "Easy-to-use tools for uploading products, managing inventory, and tracking orders"
    },
    {
      icon: <Zap className="w-12 h-12 text-[#ffcc00]" />,
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
      <section className="bg-white text-black px-5 py-10 relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          {/* Slider */}
          <div className="relative h-48 flex items-center justify-center">
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
                <div className="mb-3">{React.cloneElement(slide.icon as React.ReactElement, { className: 'w-12 h-12 text-[#ffcc00]' })}</div>
                <h2 className="text-2xl font-bold mb-2">{slide.title}</h2>
                <p className="text-base max-w-xl mx-auto leading-relaxed text-gray-700">
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
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-8 bg-[#ffcc00]'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex justify-center mt-6">
            <button 
              onClick={onOpenSimpleSignup}
              className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-semibold text-base px-6 py-2.5 rounded transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Get Started Free
            </button>
          </div>
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