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
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1026] via-[#0f1735] to-[#162142]" />
        <div className="absolute -left-20 -top-24 w-80 h-80 bg-[#f5c800]/18 blur-3xl rounded-full" />
        <div className="absolute -right-14 top-10 w-72 h-72 bg-[#f5a300]/14 blur-3xl rounded-full" />
        <div className="max-w-7xl mx-auto px-5 py-14 relative z-10">
          <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-12 items-center">
            {/* Bee visual */}
            <div className="relative flex items-center justify-center lg:justify-start">
              <div className="absolute -left-10 -top-14 w-64 h-64 bg-[#f6d243]/18 rounded-full blur-3xl" />
              <div className="absolute -left-4 top-16 w-56 h-56 bg-[#f5a300]/14 rounded-full blur-3xl" />
              <img
                src="/bzobee.png"
                alt="Beezio Mascot"
                className="relative w-full max-w-[420px] drop-shadow-[0_30px_60px_rgba(245,194,0,0.35)] animate-float"
              />
            </div>

            {/* Copy + slider + CTA */}
            <div className="space-y-7 w-full">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-full text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Free to join ? Keep what you earn
                </div>
                <h1 className="text-4xl sm:text-5xl font-black leading-tight text-white">
                  Beezio makes sure everyone keeps what they earn ? no hidden cuts.
                </h1>
                <p className="text-base sm:text-lg text-white/80 max-w-3xl">
                  Sellers set their price and markup. Affiliates and fundraisers earn 5% for every sale. Beezio handles platform fees and payout math so everyone gets their full share.
                </p>
                <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-semibold text-white/90">
                  <Sparkles className="w-4 h-4 text-[#f6d243]" />
                  Everyone earns on Beezio ? sellers, affiliates, fundraisers.
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative h-[340px] bg-white/8 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md px-6 sm:px-10">
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
                      <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-[#f6d243]">
                        {React.cloneElement(slide.icon as React.ReactElement, { className: 'w-4 h-4 text-[#f6d243]' })}
                        {slide.badge}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white">{slide.title}</h2>
                      <p className="text-white/80 text-sm sm:text-base leading-relaxed max-w-2xl">{slide.description}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        index === currentSlide ? 'w-8 bg-[#f6d243]' : 'w-2 bg-white/30 hover:bg-white/60'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={onOpenSimpleSignup}
                    className="bg-black text-[#f6d243] font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    Start Free Today
                  </button>
                </div>
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
            No monthly fees • Fees baked into pricing
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Sellers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Custom storefronts on your domain</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Stripe checkout with automated payouts</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Opt into affiliates or keep products private</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Affiliates</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Earn 5% lifetime on every sale</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Bonus rates when sellers opt in</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Fundraisers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> 5% bonus paid by Beezio every sale</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Ready-made store templates for causes</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">For Buyers</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Trusted sellers and verified fundraisers</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Transparent pricing (includes Stripe 2.9% + $0.60)</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Custom Stores & Domains</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Use beezio.co/yourstore or bring your own domain</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Guided onboarding with smart tips</li>
              </ul>
            </div>

            <div className="group bg-white/5 border border-white/10 p-5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-11 h-11 bg-gradient-to-br from-[#f6d243] to-[#f5a300] rounded-xl flex items-center justify-center mb-3 text-black">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">API Integrations</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Import supplier products through adapters</li>
                <li className="flex items-start gap-2"><span className="text-[#f6d243] font-bold">•</span> Automated fulfillment hooks are ready</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
