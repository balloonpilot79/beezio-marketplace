import React, { useEffect, useState } from 'react';
import {
  Store,
  Users,
  TrendingUp,
  Globe,
  Package,
  Zap,
  Sparkles,
  Bot,
  Wand2,
  MessageSquare,
  Brain
} from 'lucide-react';

const HomePage: React.FC<{
  onOpenSimpleSignup: () => void;
}> = ({ onOpenSimpleSignup }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: <Store className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Sell Anything, Anywhere',
      description: 'Launch your custom storefront in minutes. Stripe checkout, your domain, zero inventory required.',
      badge: 'For Sellers'
    },
    {
      icon: <Users className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Earn 5% Lifetime Commissions',
      description: 'Share products, earn forever. One link gets you 5% on every sale + seller bonuses.',
      badge: 'For Affiliates'
    },
    {
      icon: <TrendingUp className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Fundraise with Zero Effort',
      description: 'Turn supporters into salespeople. Launch a cause-based store and earn while they share.',
      badge: 'For Fundraisers'
    },
    {
      icon: <Globe className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Your Brand, Your Domain',
      description: 'Bring your own domain or use ours. Full customization, no tech skills needed.',
      badge: 'Custom Stores'
    },
    {
      icon: <Package className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Dropship-Ready Marketplace',
      description: 'Opt products into affiliate promotion or keep them private. You control the distribution.',
      badge: 'Smart Inventory'
    },
    {
      icon: <Zap className="w-11 h-11 text-[#ffcc00]" />,
      title: 'Transparent, All-In Pricing',
      description: 'No hidden costs. We bake in platform, referrer, and Stripe fees so everyone keeps their full share.',
      badge: 'Transparent Pricing'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4200);

    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="min-h-screen bg-[#050915] text-white">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f9fbff] via-[#eef2ff] to-[#e5e7eb]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,215,0,0.12),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(17,24,39,0.08),transparent_26%)]" />
        <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
          <div className="grid lg:grid-cols-[1.05fr,0.95fr] gap-12 items-center">
            {/* Copy + slider + CTA */}
            <div className="space-y-6 w-full text-gray-900">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-semibold shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Free to join - Keep what you earn
                </div>
                <h1 className="text-4xl sm:text-5xl font-black leading-tight">
                  A marketplace that feels familiar, and pays everyone fairly.
                </h1>
                <p className="text-base sm:text-lg text-gray-700 max-w-3xl">
                  Add products in minutes, let affiliates and fundraisers promote them, and use your own domain or a simple Beezio link. No hidden cuts - just clean payouts.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative h-[320px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 px-6 sm:px-10">
                  {slides.map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 flex flex-col justify-center gap-3 px-8 sm:px-12 transition-all duration-700 ${
                        index === currentSlide
                          ? 'opacity-100 translate-x-0'
                          : index < currentSlide
                          ? 'opacity-0 -translate-x-10'
                          : 'opacity-0 translate-x-10'
                      }`}
                    >
                      <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-800">
                        {React.cloneElement(slide.icon as React.ReactElement, { className: 'w-4 h-4 text-gray-800' })}
                        {slide.badge}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{slide.title}</h2>
                      <p className="text-gray-700 text-sm sm:text-base leading-relaxed max-w-2xl">{slide.description}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        index === currentSlide ? 'w-8 bg-gray-900' : 'w-2 bg-gray-300 hover:bg-gray-500'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={onOpenSimpleSignup}
                    className="bg-black text-white font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    Start Free Today
                  </button>
                  <button
                    onClick={() => window.location.assign('/marketplace')}
                    className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-full border border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
                  >
                    Browse Marketplace
                  </button>
                </div>
              </div>
            </div>

            {/* Product collage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-4 shadow-2xl border border-gray-100">
                <img
                  src="https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=900&q=80"
                  alt="Merchandise ready to ship"
                  className="w-full h-44 object-cover rounded-2xl"
                />
                <p className="text-gray-900 font-semibold mt-3">Curated products</p>
                <p className="text-gray-600 text-sm">Ready to list, price, and promote.</p>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-2xl border border-gray-100">
                <img
                  src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80"
                  alt="Affiliate planning content"
                  className="w-full h-44 object-cover rounded-2xl"
                />
                <p className="text-gray-900 font-semibold mt-3">Affiliate-ready</p>
                <p className="text-gray-600 text-sm">One click to let affiliates promote.</p>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-2xl border border-gray-100 col-span-2">
                <img
                  src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80"
                  alt="Custom storefront on laptop"
                  className="w-full h-52 object-cover rounded-2xl"
                />
                <p className="text-gray-900 font-semibold mt-3">Build your storefront</p>
                <p className="text-gray-600 text-sm">Use your domain or beezio.co/yourstore.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
{/* FEATURES GRID */}
      <section className="bg-gradient-to-b from-[#0b1026] via-[#0f1735] to-[#0b132b] px-5 py-12">
        <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <h2 className="text-3xl font-bold text-white">Everything you need to launch, earn, and fundraise</h2>
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-full text-xs font-semibold text-white/90">
            <Zap className="w-4 h-4 text-[#f6d243]" />
            No monthly fees - Fees baked into pricing
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Sellers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Custom storefronts on your domain</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Stripe checkout with automated payouts</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Opt into affiliates or keep products private</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Affiliates</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Earn 5% lifetime on every sale</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Bonus rates when sellers opt in</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Fundraisers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> 5% bonus paid by Beezio every sale</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Ready-made store templates for causes</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Buyers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Trusted sellers and verified fundraisers</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Transparent pricing (includes Stripe 2.9% + $0.60)</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Custom Stores & Domains</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Use beezio.co/yourstore or bring your own domain</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Guided onboarding with smart tips</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">API Integrations</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Import supplier products through adapters</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">-</span> Automated fulfillment hooks are ready</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
