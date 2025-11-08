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
      {/* HERO SECTION WITH VISUALS */}
      <section className="bg-gradient-to-br from-white via-yellow-50 to-white text-black px-5 py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Text Content with Slider */}
            <div className="text-center lg:text-left">
              <div className="inline-block bg-[#ffcc00] text-black text-xs font-bold px-3 py-1 rounded-full mb-4">
                🚀 Launch Your Store in Minutes
              </div>
              
              {/* Slider */}
              <div className="relative h-32 mb-6">
                {slides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ${
                      index === currentSlide
                        ? 'opacity-100 translate-x-0'
                        : index < currentSlide
                        ? 'opacity-0 -translate-x-full'
                        : 'opacity-0 translate-x-full'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {React.cloneElement(slide.icon as React.ReactElement, { className: 'w-11 h-11 text-[#ffcc00]' })}
                      <h2 className="text-3xl font-bold">{slide.title}</h2>
                    </div>
                    <p className="text-base text-gray-700 leading-relaxed">
                      {slide.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Slide Indicators */}
              <div className="flex justify-center lg:justify-start gap-2 mb-6">
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
              <button 
                onClick={onOpenSimpleSignup}
                className="bg-[#ffcc00] hover:bg-[#e6b800] text-black font-bold text-base px-8 py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                Start Selling Free →
              </button>
              
              {/* Trust Indicators */}
              <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✓</span> No Setup Fees
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✓</span> Instant Payouts
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✓</span> 24/7 Support
                </div>
              </div>
            </div>

            {/* Right: Dashboard Screenshot Mockup */}
            <div className="relative">
              {/* Browser Window Frame */}
              <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
                {/* Browser Chrome */}
                <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-500">
                    beezio.com/dashboard
                  </div>
                </div>
                
                {/* Dashboard Preview */}
                <div className="bg-gradient-to-br from-gray-50 to-white p-6">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-6 bg-gray-200 rounded w-32"></div>
                      <div className="h-8 bg-[#ffcc00] rounded w-24"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                        <div className="text-2xl font-bold text-gray-900">$2,847</div>
                        <div className="text-xs text-gray-500">Total Sales</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                        <div className="text-2xl font-bold text-gray-900">156</div>
                        <div className="text-xs text-gray-500">Products</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
                        <div className="text-2xl font-bold text-gray-900">89</div>
                        <div className="text-xs text-gray-500">Affiliates</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Product Cards Preview */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 shadow border border-gray-100">
                      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded h-24 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow border border-gray-100">
                      <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded h-24 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -top-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">
                Live Demo!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="bg-[#f9d900] text-center px-5 py-10 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-2xl font-bold mb-3">What is Beezio?</h2>
          <p className="text-base leading-relaxed">
            Beezio is an online marketplace that empowers sellers to build their own stores, list products, and manage affiliates — all in one platform. Affiliates earn lifetime commissions, fundraisers can raise money through custom stores, and buyers shop easily from verified sellers.
          </p>
        </div>
      </section>

      {/* VISUAL FEATURES SHOWCASE */}
      <section className="px-5 py-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">See How It Works</h2>
            <p className="text-gray-600">Everything you need to run your marketplace</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Feature 1: Seller Dashboard */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 shadow-lg border border-gray-100">
                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#ffcc00] rounded-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-32 mb-1"></div>
                      <div className="h-2 bg-gray-100 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-gradient-to-br from-yellow-100 to-orange-100 rounded"></div>
                    <div className="h-20 bg-gradient-to-br from-green-100 to-blue-100 rounded"></div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="inline-block bg-green-500 text-white px-3 py-1 rounded text-xs font-bold">
                    ✓ Product Added
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-bold mb-4">Add Products in Seconds</h3>
              <p className="text-gray-700 mb-4">
                Upload products with our simple form. Add images, set prices, and enable affiliate marketing with one click.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Drag & drop image uploads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Automatic pricing calculator</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">One-click affiliate toggle</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Feature 2: Affiliate Links */}
            <div>
              <h3 className="text-2xl font-bold mb-4">Generate Affiliate Links Instantly</h3>
              <p className="text-gray-700 mb-4">
                Affiliates can browse the marketplace, select products, and get unique tracking links in seconds.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Site-wide referral links</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Product-specific tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">QR code generation</span>
                </li>
              </ul>
            </div>
            <div>
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-8 shadow-lg border border-gray-100">
                <div className="bg-white rounded-lg p-4 mb-3">
                  <div className="text-xs text-gray-500 mb-2">Your Referral Link</div>
                  <div className="flex items-center gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                    <div className="flex-1 text-xs text-gray-700 font-mono truncate">
                      beezio.com?ref=YOURCODE
                    </div>
                    <div className="bg-[#ffcc00] px-3 py-1 rounded text-xs font-bold whitespace-nowrap">
                      Copy
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-xl font-bold text-gray-900">$847</div>
                    <div className="text-xs text-gray-500">Earned</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="text-xl font-bold text-gray-900">234</div>
                    <div className="text-xs text-gray-500">Clicks</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Feature 3: Store Customization */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-8 shadow-lg border border-gray-100">
                <div className="bg-white rounded-lg overflow-hidden">
                  <div className="bg-[#ffcc00] p-4 text-center">
                    <div className="text-lg font-bold">My Awesome Store</div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded"></div>
                      <div className="h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded"></div>
                      <div className="h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-bold mb-4">Customize Your Store</h3>
              <p className="text-gray-700 mb-4">
                Make your store unique with custom branding, themes, and your own domain.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">6 professional themes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Custom domain support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ffcc00] font-bold">✓</span>
                  <span className="text-sm">Logo & banner uploads</span>
                </li>
              </ul>
            </div>
          </div>
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