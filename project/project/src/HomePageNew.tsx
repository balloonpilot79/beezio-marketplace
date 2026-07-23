import React from 'react';
import { Link } from 'react-router-dom';

interface HomePageProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  return (
    <div className="min-h-screen bg-gradient-bg">
      
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            
            {/* Main Hero Content */}
            <div className="animate-fadeInUp">
              <h1 className="text-5xl lg:text-7xl font-display font-bold text-gray-900 mb-6 leading-tight">
                The Platform Where
                <span className="block text-gradient">Everyone Wins</span>
              </h1>
              <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
                Launch a custom store, set the amount you want to earn, and let Beezio handle the rest.<br/>
                <span className="text-lg text-gray-500">Sellers sell, affiliates and influencers earn, and buyers check out through one platform.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button 
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="btn-primary text-lg px-8 py-4"
                >
                  Start Making Money Today
                </button>
                <button 
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="btn-secondary text-lg px-8 py-4"
                >
                  Explore The Platform
                </button>
              </div>
              
              {/* What Beezio Is All About */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-5xl mx-auto">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">🏪</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Sellers Profit</h4>
                    <p className="text-sm text-gray-600">Custom storefronts with seller-owned products</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">🤝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Partners Earn</h4>
                    <p className="text-sm text-gray-600">Free to join and earn through tracked sales</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">💝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Campaigns Grow</h4>
                    <p className="text-sm text-gray-600">Commerce-powered support</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">🛒</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Buyers Save</h4>
                    <p className="text-sm text-gray-600">Discounts while supporting causes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Built To Be Clear, Not Hype-Heavy</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The strongest trust signal is specificity. Beezio explains how storefronts, pricing, and payouts actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-2">No Monthly Fee To Start</div>
              <p className="text-sm text-slate-600">
                Sellers, affiliates, and influencers can create accounts and start using the platform without a subscription wall.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-2">Seller-Owned Storefronts</div>
              <p className="text-sm text-slate-600">
                Every seller gets a custom storefront they can brand, manage, and share.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-2">Automatic Product Population</div>
              <p className="text-sm text-slate-600">
                When a seller adds their own product, it appears in that seller’s storefront automatically.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-2">Payout-First Pricing</div>
              <p className="text-sm text-slate-600">
                Sellers set the amount they want to earn first. Beezio adds platform and payment costs on top of that target.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-2">Trackable Orders And Earnings</div>
              <p className="text-sm text-slate-600">
                Storefronts, checkout, links, and earnings reporting all run through the same system.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Beezio Different */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Makes Beezio Different?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Unlike other platforms that only serve one type of user, Beezio is designed for everyone to succeed together
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏪</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Sellers Make Money</h3>
              <p className="text-gray-600">Every seller gets a custom storefront, and products you add populate into that store automatically.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Partners Earn Big</h3>
              <p className="text-gray-600">Join free, share storefronts and product links, and earn on tracked activity without a subscription fee.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Campaigns Powered by Commerce</h3>
              <p className="text-gray-600">Generate support from attributed purchases instead of direct asks. Higher conversion.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛒</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Buyers Save Money</h3>
              <p className="text-gray-600">Buy through partner links and get cashback while shopping smart.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How Everyone Wins */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How Everyone Wins on Beezio</h2>
            <p className="text-xl text-gray-600">An ecosystem where every participant benefits</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            
            {/* Sellers Section */}
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🏪</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Sellers</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Printful Integration:</strong> Seamlessly connect your print-on-demand business</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Shopify Store Import:</strong> Bring your existing store over in minutes</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Custom Storefront Included:</strong> Every seller gets a store they can brand and share</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Automatic Store Population:</strong> Add your own product and it appears in your storefront automatically</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Keep What You Set:</strong> If you want $25, you get $25. Platform and payment costs are added on top.</span>
                </div>
              </div>
              
              <Link
                to="/sellers"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 block text-center"
              >
                Start Selling
              </Link>
            </div>

            {/* Partners Section */}
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Partners</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Free To Join:</strong> Start promoting without paying a monthly subscription</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Self-Purchase Rewards:</strong> Buy products and get your commission back</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Trackable Earnings:</strong> Use storefronts, links, and reporting to see what your activity generates</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Built For Real Selling:</strong> Promote active marketplace products inside a live checkout flow</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Multiple Earning Paths:</strong> Affiliates and influencers can both start free and earn from attributed activity</span>
                </div>
              </div>
              
              <Link
                to="/affiliates"
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 block text-center"
              >
                Become Partner
              </Link>
            </div>

            {/* Campaigns Section */}
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">💝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Campaigns</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Commerce-Powered:</strong> Earn support from attributed product purchases</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Higher Success:</strong> People prefer getting value for their money</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Transparent Fees:</strong> Support is derived from commerce and attribution</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Built-in Promotion:</strong> Our partners help spread your products</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Global Reach:</strong> Supporters worldwide can help</span>
                </div>
              </div>
              
              <Link
                to="/campaigns"
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200 block text-center"
              >
                Launch a Campaign
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Smart Shopping Revolution */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Why The Model Is Different</h2>
              <p className="text-xl text-gray-600 mb-8">
                Beezio works best when the economics are clear up front instead of hidden behind vague promises.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-orange-600 font-bold">💰</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Sellers Choose Their Earnings First</h4>
                    <p className="text-gray-600">Beezio is built so the seller payout target stays intact and required costs are layered on top of that number.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-blue-600 font-bold">🎯</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Storefronts Stay Seller-Owned</h4>
                    <p className="text-gray-600">Each seller gets a custom store, and each seller-added product is automatically available inside that store.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-green-600 font-bold">🔄</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Specific Beats Hype</h4>
                    <p className="text-gray-600">No subscription required to start. Clear payouts, live products, trackable activity, and one checkout path.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-purple-50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Example: Seller Sets The Payout</h3>
              
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                  <h5 className="font-semibold">📱 Seller wants to earn $25</h5>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div>• Seller payout target: $25.00</div>
                    <div>• Platform fee is added on top</div>
                    <div>• Payment processing is added on top</div>
                    <div>• Buyer sees the final checkout price before paying</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                  <h5 className="font-semibold">🤝 What affiliates and influencers see</h5>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div>• Free account creation</div>
                    <div>• Share storefronts and tracked links</div>
                    <div>• <strong>Earn on attributed activity without paying a subscription fee</strong></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-lg text-center">
                <strong>Clear storefronts, clear payouts, clear tracking</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-display font-bold text-white mb-6">
            Ready to Join the Beezio Ecosystem?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Whether you want to sell, promote, or launch a storefront, Beezio is built to make the economics clear.
            Start without a subscription and grow with seller-owned storefronts, tracked promotion, and live checkout.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
              className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-8 py-4 rounded-lg text-lg transition-colors duration-200 transform hover:-translate-y-1"
            >
              🚀 Get Started Now
            </button>
            <Link
              to="/products"
              className="border-2 border-white text-white hover:bg-white hover:text-purple-600 font-semibold px-8 py-4 rounded-lg text-lg transition-colors duration-200 text-center"
            >
              Browse Products
            </Link>
          </div>
          
          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Everyone</div>
              <div className="text-white/80 text-sm">Wins Together</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">$0</div>
              <div className="text-white/80 text-sm">To Start</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Global</div>
              <div className="text-white/80 text-sm">Platform</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
