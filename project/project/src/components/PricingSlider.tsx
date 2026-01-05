import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, CreditCard, Gift } from 'lucide-react';

interface PricingSlide {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  highlight: string;
  bgGradient: string;
}

const PricingSlider: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const slides: PricingSlide[] = [
    {
      id: 5,
      title: "Site-Wide Affiliate Links",
      description:
        "Share one link, earn from every sale! Affiliates get a universal homepage link that tracks all purchases automatically.",
      icon: <TrendingUp className="h-8 w-8 text-white" />,
      features: [
        "One link for everything",
        "Automatic commission tracking",
        "No need for individual product links",
        "Simple sharing, maximum earnings"
      ],
      highlight: "Example: yourdomain.com/?ref=YOUR_ID",
      bgGradient: "from-yellow-500 to-amber-600"
    },
    {
      id: 0,
      title: "The Future of Affiliate Marketing",
      description: "The ultimate marketplace connecting products and affiliates. Join our community of sellers and affiliates building successful partnerships.",
      icon: <TrendingUp className="h-8 w-8 text-white" />,
      features: [
        "Connect products with affiliates globally",
        "Build successful partnerships",
        "Join a thriving community",
        "Start shopping or become an affiliate"
      ],
      highlight: "Welcome to Beezio!",
      bgGradient: "from-amber-400 to-orange-500"
    },
    {
      id: 1,
      title: "Sellers Pay Nothing",
      description: "Join Beezio completely free - no upfront costs, no monthly fees, no listing fees. You only pay when you sell!",
      icon: <Gift className="h-8 w-8 text-white" />,
      features: [
        "Zero upfront costs to start selling",
        "No monthly subscription fees",
        "No listing fees - list unlimited products",
        "Only pay when you make a sale"
      ],
      highlight: "100% Free to start selling!",
      bgGradient: "from-green-500 to-emerald-600"
    },
    {
      id: 2,
      title: "Transparent 10% Platform Fee",
      description: "We only succeed when you do. Beezio adds a 10% platform fee to your desired profit, plus Stripe processing fees.",
      icon: <DollarSign className="h-8 w-8 text-white" />,
      features: [
        "You set your desired profit amount",
        "We add 10% platform fee on top",
        "Stripe fees included in final price",
        "Transparent pricing - no hidden costs"
      ],
      highlight: "You get 100% of your desired profit!",
      bgGradient: "from-blue-500 to-indigo-600"
    },
    {
      id: 3,
      title: "Secure Stripe Payments",
      description: "All transactions are processed securely through Stripe, ensuring safe payments for everyone.",
      icon: <CreditCard className="h-8 w-8 text-white" />,
      features: [
        "Industry-leading payment security",
        "Instant payment processing",
        "Multiple payment methods accepted",
        "Automatic payout to your account"
      ],
      highlight: "Bank-level security",
      bgGradient: "from-purple-500 to-pink-600"
    },
    {
      id: 4,
      title: "Affiliate Earnings",
      description: "Earn 15% to 75% commission on every sale, or choose flat-rate commissions set by sellers.",
      icon: <TrendingUp className="h-8 w-8 text-white" />,
      features: [
        "Earn 15% - 75% on each sale",
        "Flat-rate commission options",
        "Unique tracking links for every product",
        "Real-time earnings dashboard"
      ],
      highlight: "High earning potential",
      bgGradient: "from-amber-500 to-orange-600"
    }
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, slides.length]);

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentSlide(index);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const currentSlideData = slides[currentSlide];

  return (
    <section className="relative py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Main Slider Container */}
          <div className={`relative h-96 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-gradient-to-br ${currentSlideData.bgGradient}`}>
            <div className="text-center text-white max-w-4xl w-full">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white bg-opacity-20 rounded-full backdrop-blur-sm">
                  {currentSlideData.icon}
                </div>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold mb-4">
                {currentSlideData.title}
              </h3>
              <p className="text-lg md:text-xl mb-6 opacity-90">
                {currentSlideData.description}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentSlideData.features.map((feature, index) => (
                  <div key={index} className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-sm md:text-base">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="inline-block bg-white bg-opacity-20 backdrop-blur-sm px-6 py-3 rounded-full">
                <span className="font-bold text-lg">{currentSlideData.highlight}</span>
              </div>
            </div>
          </div>
          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-opacity-30 transition-all duration-300 z-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-opacity-30 transition-all duration-300 z-10"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          {/* Slide Indicators */}
          <div className="flex justify-center mt-8 space-x-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-amber-500 scale-125'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
          {/* Auto-play Progress Bar */}
          {isAutoPlaying && (
            <div className="mt-4 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-100 ease-linear"
                style={{
                  width: '100%',
                  animation: 'progress 6s linear infinite'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PricingSlider;