import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  Target, 
  Star, 
  CheckCircle, 
  ArrowRight, 
  Zap, 
  Globe, 
  BarChart3,
  Crown,
  Shield,
  Clock
} from 'lucide-react';

const StartEarningPage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  const [selectedTab, setSelectedTab] = useState<'seller' | 'affiliate'>('affiliate');

  const sellerFeatures = [
    { icon: ShoppingCart, title: 'Zero Inventory Costs', desc: 'Sell digital products with no upfront investment' },
    { icon: Globe, title: 'Global Reach', desc: 'Access customers worldwide through our marketplace' },
    { icon: Target, title: 'High-Converting Affiliates', desc: 'Our affiliate network drives quality traffic to your products' },
    { icon: BarChart3, title: 'Real-Time Analytics', desc: 'Track sales, conversions, and earnings in real-time' },
    { icon: Zap, title: 'Automated Fulfillment', desc: 'Products are delivered automatically upon purchase' },
    { icon: Shield, title: 'Fraud Protection', desc: 'Built-in security and payment processing through Stripe' }
  ];

  const affiliateFeatures = [
    { icon: DollarSign, title: 'High Commission Rates', desc: 'Earn 10-50% commission on every sale you generate' },
    { icon: TrendingUp, title: 'Recurring Income', desc: 'Subscription products provide ongoing monthly earnings' },
    { icon: Users, title: 'Quality Products', desc: 'Promote vetted, high-converting products from top sellers' },
    { icon: Target, title: 'Advanced Tracking', desc: 'Real-time link tracking and conversion analytics' },
    { icon: Crown, title: 'Marketing Support', desc: 'Get banners, copy, and promotional materials' },
    { icon: Clock, title: 'Weekly Payouts', desc: 'Fast, reliable payments via Stripe every week' }
  ];

  const earningsExamples = {
    seller: [
      { product: 'Digital Course', price: '$297', sales: '50/month', earnings: '$14,850/month' },
      { product: 'Software Tool', price: '$49/month', subscribers: '200', earnings: '$9,800/month' },
      { product: 'eBook Bundle', price: '$39', sales: '100/month', earnings: '$3,900/month' }
    ],
    affiliate: [
      { product: 'High-Ticket Course', commission: '40%', sales: '5/month', earnings: '$594/month' },
      { product: 'SaaS Subscription', commission: '30%', recurring: '50 customers', earnings: '$735/month' },
      { product: 'Digital Products', commission: '25%', sales: '20/month', earnings: '$495/month' }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-amber-100 rounded-full text-amber-800 font-medium mb-6">
            <Star className="w-4 h-4 mr-2" />
            Join 10,000+ earning members
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-amber-500 bg-clip-text text-transparent">
              Start Earning
            </span>
            <br />
            <span className="text-gray-900">Today</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Whether you want to sell your own products or promote others', Beezio gives you 
            everything you need to build a profitable online business with zero upfront costs.
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-green-600">$2.3M+</div>
              <div className="text-sm text-gray-600">Total Earnings Paid</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">45%</div>
              <div className="text-sm text-gray-600">Average Commission</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">7 Days</div>
              <div className="text-sm text-gray-600">Average Payout Time</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="text-2xl font-bold text-amber-600">10,000+</div>
              <div className="text-sm text-gray-600">Active Members</div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center justify-center"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Start Earning Now - Free
            </button>
            <button
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full font-semibold text-lg hover:border-gray-400 transition-colors flex items-center justify-center"
            >
              I Already Have an Account
            </button>
          </div>
        </div>
      </section>

      {/* Seller vs Affiliate Toggle */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Path to Success</h2>
            <p className="text-xl text-gray-600">Both paths can lead to substantial income - pick what fits your skills and goals</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-100 p-1 rounded-full">
              <button
                onClick={() => setSelectedTab('affiliate')}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  selectedTab === 'affiliate'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🤝 Become an Affiliate
              </button>
              <button
                onClick={() => setSelectedTab('seller')}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${
                  selectedTab === 'seller'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🏪 Become a Seller
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left Side - Benefits */}
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">
                {selectedTab === 'affiliate' ? 'Why Affiliates Love Beezio' : 'Why Sellers Choose Beezio'}
              </h3>
              
              <div className="space-y-4">
                {(selectedTab === 'affiliate' ? affiliateFeatures : sellerFeatures).map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-sm border">
                    <div className={`p-2 rounded-lg ${
                      selectedTab === 'affiliate' ? 'bg-purple-100' : 'bg-green-100'
                    }`}>
                      <feature.icon className={`w-5 h-5 ${
                        selectedTab === 'affiliate' ? 'text-purple-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                      <p className="text-gray-600 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - Earnings Examples */}
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6">Real Earning Examples</h3>
              
              <div className="space-y-4">
                {earningsExamples[selectedTab].map((example, index) => (
                  <div key={index} className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-lg border-l-4 border-green-500">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {selectedTab === 'affiliate' ? example.product : example.product}
                      </h4>
                      <span className="text-2xl font-bold text-green-600">{example.earnings}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedTab === 'affiliate' ? (
                        <>
                          {example.commission} commission • {example.sales || example.recurring}
                        </>
                      ) : (
                        <>
                          {example.price} • {example.sales || `${example.subscribers} subscribers`}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-amber-800 font-medium">
                  💡 {selectedTab === 'affiliate' 
                    ? 'Top affiliates earn $10,000+ per month promoting multiple products'
                    : 'Top sellers scale to $50,000+ per month with multiple products and affiliates'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How {selectedTab === 'affiliate' ? 'Affiliate Marketing' : 'Selling'} Works
            </h2>
            <p className="text-xl text-gray-600">
              {selectedTab === 'affiliate' 
                ? 'Start earning commissions in 3 simple steps'
                : 'Start selling and earning in 3 simple steps'
              }
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {selectedTab === 'affiliate' ? (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-purple-600">1</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Sign Up & Browse</h3>
                  <p className="text-gray-600">
                    Create your free affiliate account and browse our marketplace of high-converting products.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-purple-600">2</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Your Links</h3>
                  <p className="text-gray-600">
                    Generate unique affiliate links for products you want to promote. Share on social media, blogs, or email.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-purple-600">3</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Earn Commissions</h3>
                  <p className="text-gray-600">
                    Get paid weekly for every sale made through your links. Track everything in your dashboard.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-green-600">1</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">List Your Products</h3>
                  <p className="text-gray-600">
                    Upload your digital products with descriptions, pricing, and commission rates for affiliates.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-green-600">2</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Affiliates Promote</h3>
                  <p className="text-gray-600">
                    Our network of affiliates will discover and promote your products to their audiences.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-green-600">3</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Paid</h3>
                  <p className="text-gray-600">
                    Receive automatic payments when orders are placed. Track sales and manage your business.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Success Stories</h2>
            <p className="text-xl text-gray-600">Real people earning real money on Beezio</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-purple-600 font-bold">SM</span>
                </div>
                <div>
                  <h4 className="font-semibold">Sarah M.</h4>
                  <p className="text-gray-600 text-sm">Affiliate Marketer</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                "Started with just social media posts. Now earning $3,200/month in commissions. 
                The tracking and payment system is incredible!"
              </p>
              <div className="text-green-600 font-semibold">$3,200/month in 6 months</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-green-600 font-bold">DJ</span>
                </div>
                <div>
                  <h4 className="font-semibold">David J.</h4>
                  <p className="text-gray-600 text-sm">Course Creator</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                "My photography course went from 10 sales to 200+ per month thanks to Beezio's 
                affiliate network. Game changer!"
              </p>
              <div className="text-green-600 font-semibold">$18,000/month revenue</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-blue-600 font-bold">ML</span>
                </div>
                <div>
                  <h4 className="font-semibold">Maria L.</h4>
                  <p className="text-gray-600 text-sm">Blogger & Affiliate</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                "Monetized my blog with Beezio affiliate links. The high commission rates 
                and quality products make it easy to recommend."
              </p>
              <div className="text-green-600 font-semibold">$1,850/month passive income</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-gradient-to-r from-purple-600 via-blue-600 to-amber-500">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of successful entrepreneurs earning on Beezio. 
            It's free to start and you could be earning your first commission this week.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-white text-purple-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Start Earning Today - Free
            </button>
            <button
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-purple-600 transition-colors"
            >
              I Have an Account
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-80" />
              <span className="text-sm opacity-90">Free to Join</span>
            </div>
            <div>
              <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-80" />
              <span className="text-sm opacity-90">No Hidden Fees</span>
            </div>
            <div>
              <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-80" />
              <span className="text-sm opacity-90">Weekly Payouts</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StartEarningPage;