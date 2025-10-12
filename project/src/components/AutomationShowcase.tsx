import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Bot,
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  CheckCircle,
  ArrowRight,
  Star,
  Shield,
  Globe,
  BarChart3,
  Truck,
  Mail,
  Settings,
  Play,
  X
} from 'lucide-react';

const AutomationShowcase: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleEnableAutomation = () => {
    if (user) {
      navigate('/dashboard?tab=automation');
    } else {
      navigate('/login?seller=true');
    }
  };

  const demoVideos = {
    orderProcessing: {
      title: "Automated Order Processing",
      description: "Watch how orders are processed instantly without manual intervention",
      duration: "2:30"
    },
    shippingAutomation: {
      title: "Smart Shipping Labels",
      description: "See how shipping labels are generated and tracking is automated",
      duration: "1:45"
    },
    customerService: {
      title: "24/7 Customer Support",
      description: "AI-powered customer service that never sleeps",
      duration: "3:15"
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              Powered by AI & Automation
            </div>

            <div className="inline-flex items-center px-6 py-3 bg-green-100 text-green-800 rounded-full text-lg font-bold mb-6 border-2 border-green-200">
              <span className="mr-2">🎉</span>
              100% FREE - No Hidden Costs!
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Automate Your
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Business</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Stop working IN your business. Let AI handle order fulfillment, shipping, and customer service
              while you focus on growth. <strong>Join 10,000+ sellers saving 20+ hours per week - 100% FREE!</strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={handleEnableAutomation}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center space-x-2"
              >
                <Zap className="w-6 h-6" />
                <span>Enable Automation Now - FREE!</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setActiveDemo('orderProcessing')}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all flex items-center space-x-2"
              >
                <Play className="w-6 h-6" />
                <span>Watch Demo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">85%</div>
                <p className="text-gray-600">Time Saved</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">$2,500</div>
                <p className="text-gray-600">Monthly Savings</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">10x</div>
                <p className="text-gray-600">Order Capacity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-purple-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-indigo-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How Automation Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From order to delivery, everything happens automatically with zero manual intervention
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Order Received</h3>
              <p className="text-gray-600">Customer places order through your store</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Auto Processing</h3>
              <p className="text-gray-600">AI automatically orders from your vendors</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Smart Shipping</h3>
              <p className="text-gray-600">Shipping labels generated automatically</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">4. Delivered</h3>
              <p className="text-gray-600">Customer receives package with tracking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need to Automate</h2>
            <p className="text-xl text-gray-600">Comprehensive automation that handles every aspect of your business</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Order Processing</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Automatic vendor ordering</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Smart inventory management</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Order status tracking</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Shipping & Delivery</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Auto shipping label generation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Real-time tracking updates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Delivery confirmations</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Customer Communication</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Order confirmations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Shipping updates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Delivery notifications</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Analytics & Insights</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Performance tracking</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Time savings reports</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Cost reduction metrics</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Security & Compliance</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Bank-level encryption</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>GDPR compliant</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Data privacy protection</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                <Globe className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Global Integration</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Multi-vendor support</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>International shipping</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Multi-currency support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Sellers Are Saying</h2>
            <p className="text-xl text-gray-600">Real results from real businesses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "Automation transformed my business overnight. I'm now processing 10x more orders
                without any additional staff. The time savings are incredible!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-semibold">SM</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Sarah Martinez</p>
                  <p className="text-gray-600 text-sm">Fashion Store Owner</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "I was spending 30+ hours per week on order fulfillment. Now it's completely automated.
                My profit margins have increased by 40% and I actually have time for my family."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-green-600 font-semibold">JD</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">James Davis</p>
                  <p className="text-gray-600 text-sm">Electronics Retailer</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-6">
                "The customer service automation is a game-changer. My customers get instant responses
                24/7, and satisfaction scores have never been higher. Highly recommend!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-semibold">LW</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Lisa Wong</p>
                  <p className="text-gray-600 text-sm">Home Decor Store</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Start free, scale as you grow</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-blue-200 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">FREE</div>
                <p className="text-gray-600">For your first 100 orders</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>100 automated orders/month</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Basic order processing</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Email notifications</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Basic analytics</span>
                </li>
              </ul>
              <button
                onClick={handleEnableAutomation}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Professional</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">$49</div>
                <p className="text-gray-600">Per month</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Unlimited orders</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Advanced automation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Advanced analytics</span>
                </li>
              </ul>
              <button className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                Upgrade to Pro
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">$199</div>
                <p className="text-gray-600">Per month</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>SLA guarantee</span>
                </li>
              </ul>
              <button className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of sellers who have automated their businesses and reclaimed their time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleEnableAutomation}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-all transform hover:scale-105"
            >
              🚀 Enable Automation Now - FREE!
            </button>
            <button
              onClick={() => setActiveDemo('orderProcessing')}
              className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all"
            >
              📹 Watch Demo
            </button>
          </div>
          <p className="text-blue-200 mt-4">Free for first 100 orders • No credit card required • Cancel anytime</p>
        </div>
      </section>

      {/* Demo Modal */}
      {activeDemo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">
                {demoVideos[activeDemo as keyof typeof demoVideos]?.title}
              </h3>
              <button
                onClick={() => setActiveDemo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center mb-6">
                <div className="text-center">
                  <Play className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Demo video: {demoVideos[activeDemo as keyof typeof demoVideos]?.description}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Duration: {demoVideos[activeDemo as keyof typeof demoVideos]?.duration}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <button
                  onClick={handleEnableAutomation}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Enable Automation to See Real Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationShowcase;
