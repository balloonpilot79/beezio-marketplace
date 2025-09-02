import React, { useState, useEffect } from 'react';
import { X, Zap, TrendingUp, Clock, DollarSign, Users } from 'lucide-react';
import AutomationPromo from './AutomationPromo';

interface AutomationBannerProps {
  sellerId?: string;
  onDismiss?: () => void;
  variant?: 'top' | 'sidebar' | 'floating';
  autoHide?: boolean;
  className?: string;
}

const AutomationBanner: React.FC<AutomationBannerProps> = ({
  sellerId,
  onDismiss,
  variant = 'top',
  autoHide = false,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showFullPromo, setShowFullPromo] = useState(false);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 10000); // Auto-hide after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [autoHide]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleLearnMore = () => {
    setShowFullPromo(true);
  };

  if (!isVisible) return null;

  if (showFullPromo) {
    return (
      <AutomationPromo
        variant="modal"
        sellerId={sellerId}
        onClose={() => setShowFullPromo(false)}
      />
    );
  }

  if (variant === 'top') {
    return (
      <div className={`bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white p-4 relative ${className}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-6 h-6 animate-pulse" />
              <div>
                <h3 className="font-bold text-lg">🚀 Automate Your Business Today!</h3>
                <p className="text-blue-100 text-sm">
                  Save 20+ hours/week with AI-powered order fulfillment. Join 10,000+ sellers!
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>85% Time Saved</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="w-4 h-4" />
                <span>$2.5k Monthly Savings</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>10x Order Capacity</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleLearnMore}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-all text-sm"
              >
                Enable Now - FREE!
              </button>

              {onDismiss && (
                <button
                  onClick={handleDismiss}
                  className="text-blue-200 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-white rounded-full animate-ping opacity-20"></div>
          <div className="absolute top-2 right-1/3 w-1 h-1 bg-white rounded-full animate-ping opacity-30" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-1 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-25" style={{ animationDelay: '1s' }}></div>
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Automation Available</h4>
          </div>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Automate your order fulfillment and save 20+ hours per week. Free for your first 100 orders!
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>Auto order processing</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            <span>Smart shipping labels</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
            <span>24/7 customer support</span>
          </div>
        </div>

        <button
          onClick={handleLearnMore}
          className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          Enable Automation
        </button>
      </div>
    );
  }

  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-4 right-4 z-50 max-w-sm ${className}`}>
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Zap className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Automate Your Business</h4>
                <p className="text-xs text-gray-600">Save 20+ hours/week</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <div className="text-xs font-semibold text-blue-600">85%</div>
              <div className="text-xs text-gray-600">Time Saved</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <div className="text-xs font-semibold text-green-600">$2.5k</div>
              <div className="text-xs text-gray-600">Monthly</div>
            </div>
          </div>

          <button
            onClick={handleLearnMore}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all text-sm"
          >
            🚀 Enable Now - FREE!
          </button>

          <p className="text-xs text-gray-500 text-center mt-2">
            Free for 100 orders
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AutomationBanner;
