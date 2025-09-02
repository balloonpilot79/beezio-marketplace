import React, { useState } from 'react';
import { Zap, Bot, TrendingUp, DollarSign, Star, CheckCircle, ArrowRight, Play } from 'lucide-react';

interface AutomationPromoProps {
  variant?: 'hero' | 'sidebar' | 'modal' | 'banner';
  sellerId?: string;
  showDemo?: boolean;
  className?: string;
}

const AutomationPromo: React.FC<AutomationPromoProps> = ({
  variant = 'hero',
  sellerId,
  showDemo = false,
  className = ''
}) => {
  const [showDemoVideo, setShowDemoVideo] = useState(false);

  const handleEnableAutomation = () => {
    // Redirect to seller dashboard automation tab
    window.location.href = '/seller-dashboard?tab=automation';
  };

  const handleWatchDemo = () => {
    setShowDemoVideo(true);
  };

  if (variant === 'hero') {
    return (
      <div className={`bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden ${className}`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
          <div className="absolute top-20 right-10 w-20 h-20 bg-white rounded-full"></div>
          <div className="absolute bottom-10 left-20 w-16 h-16 bg-white rounded-full"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">🚀 Automate Your Business</h2>
                <p className="text-blue-100">Join 10,000+ sellers saving 20+ hours/week</p>
              </div>
            </div>
            <div className="hidden md:block">
              <Zap className="w-16 h-16 text-yellow-300 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4">Stop Working IN Your Business</h3>
              <p className="text-blue-100 text-lg mb-6">
                Let AI handle order fulfillment, shipping, and customer service while you focus on growth.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span>Zero manual order processing</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span>24/7 automated customer support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span>Real-time shipping & tracking</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span>Scale to 10x orders without extra staff</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleEnableAutomation}
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <Zap className="w-5 h-5" />
                  <span>Enable Automation Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {showDemo && (
                  <button
                    onClick={handleWatchDemo}
                    className="border-2 border-white/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-all flex items-center justify-center space-x-2"
                  >
                    <Play className="w-5 h-5" />
                    <span>Watch Demo</span>
                  </button>
                )}
              </div>

              <p className="text-blue-200 text-sm mt-4">
                ✨ <strong>100% FREE</strong> - No setup fees • No monthly charges • Free forever!
              </p>
            </div>

            <div className="lg:text-right">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <h4 className="text-xl font-bold mb-4">Your Results Could Be:</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-100">Time Saved:</span>
                    <span className="font-bold text-2xl">85%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-100">Monthly Savings:</span>
                    <span className="font-bold text-2xl">$2,500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-100">Order Capacity:</span>
                    <span className="font-bold text-2xl">10x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-100">Customer Satisfaction:</span>
                    <span className="font-bold text-2xl">95%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Automate Your Business</h3>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Save 20+ hours per week with automated order fulfillment and customer service.
        </p>

        <div className="space-y-2 mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Auto order processing</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Smart shipping labels</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>24/7 customer support</span>
          </div>
        </div>

        <button
          onClick={handleEnableAutomation}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <Zap className="w-4 h-4" />
          <span>Enable Now</span>
        </button>

        <p className="text-xs text-gray-500 text-center mt-2">
          <strong>100% FREE</strong> - No setup costs
        </p>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6" />
            <div>
              <h4 className="font-semibold">🚀 Ready to Automate Your Business?</h4>
              <p className="text-sm text-blue-100">Save 20+ hours/week with AI-powered fulfillment • <strong>100% FREE!</strong></p>
            </div>
          </div>
          <button
            onClick={handleEnableAutomation}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm"
          >
            Enable Now
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Automate Your Business</h2>
              <p className="text-gray-600">Join thousands of sellers who have transformed their workflow</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <TrendingUp className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Scale Effortlessly</h3>
                <p className="text-sm text-gray-600">Handle 10x more orders without extra staff</p>
              </div>

              <div className="text-center p-6 bg-green-50 rounded-xl">
                <DollarSign className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Save Thousands</h3>
                <p className="text-sm text-gray-600">$2,500+ monthly savings on average</p>
              </div>

              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <Star className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Happy Customers</h3>
                <p className="text-sm text-gray-600">95% customer satisfaction rate</p>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleEnableAutomation}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
              >
                🚀 Enable Automation Now - It's Free!
              </button>
              <p className="text-sm text-gray-500 mt-2">Free for first 100 orders • No credit card required • <strong>100% FREE forever!</strong></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AutomationPromo;
