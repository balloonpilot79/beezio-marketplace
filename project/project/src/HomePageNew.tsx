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
                Make Money • Save Money • Raise Money<br/>
                <span className="text-lg text-gray-500">Sellers, Affiliates, Buyers, and Fundraisers all thrive together on Beezio</span>
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
                    <p className="text-sm text-gray-600">Printful, Printify, Shopify integration</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">🤝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Affiliates Earn</h4>
                    <p className="text-sm text-gray-600">Up to 50% commissions + cashback</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-3xl">💝</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">Fundraisers Raise</h4>
                    <p className="text-sm text-gray-600">Commerce-powered fundraising</p>
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
              <p className="text-gray-600">Integrate Printful, Printify, import Shopify stores, or sell anything. Keep 95% of profits.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🤝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Affiliates Earn Big</h3>
              <p className="text-gray-600">Earn 10-50% commissions. Buy products and get your commission back - making everything cheaper.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💝</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Fundraisers Powered by Commerce</h3>
              <p className="text-gray-600">Raise money by selling products instead of just asking for donations. Higher success rates.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛒</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Buyers Save Money</h3>
              <p className="text-gray-600">Buy through affiliate links and get cashback. Support causes while shopping smart.</p>
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
                  <span className="text-gray-700"><strong>Printful & Printify Integration:</strong> Seamlessly connect your print-on-demand business</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Shopify Store Import:</strong> Bring your existing store over in minutes</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Global Sourcing:</strong> Access worldwide suppliers and automation</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Built-in Affiliates:</strong> Our network promotes your products</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Keep Everything You Want:</strong> You get 100% of your desired profit - all fees added on top</span>
                </div>
              </div>
              
              <Link
                to="/sellers"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 block text-center"
              >
                Start Selling
              </Link>
            </div>

            {/* Affiliates Section */}
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Affiliates</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>High Commissions:</strong> Earn 10-50% on every sale you generate</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Self-Purchase Rewards:</strong> Buy products and get your commission back</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Weekly Payouts:</strong> Fast payments, low minimum ($25)</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Marketing Support:</strong> We provide content and training</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Global Products:</strong> Thousands of products to promote</span>
                </div>
              </div>
              
              <Link
                to="/affiliates"
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 block text-center"
              >
                Become Affiliate
              </Link>
            </div>

            {/* Fundraisers Section */}
            <div className="bg-white p-8 rounded-lg shadow-sm border">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">💝</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Fundraisers</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Commerce-Powered:</strong> Sell products instead of just asking for donations</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Higher Success:</strong> People prefer getting value for their money</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>No Platform Fees:</strong> Keep more money than GoFundMe</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Built-in Promotion:</strong> Our affiliates help spread your cause</span>
                </div>
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3"></div>
                  <span className="text-gray-700"><strong>Global Reach:</strong> Supporters worldwide can help</span>
                </div>
              </div>
              
              <Link
                to="/fundraisers"
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors duration-200 block text-center"
              >
                Start Fundraising
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
              <h2 className="text-4xl font-bold text-gray-900 mb-6">The Smart Shopping Revolution</h2>
              <p className="text-xl text-gray-600 mb-8">
                Why just shop when you can shop smart? Beezio rewards everyone in the transaction.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-orange-600 font-bold">💰</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Affiliates Get Cashback</h4>
                    <p className="text-gray-600">Buy products through your own affiliate link and get your commission back - instant discount!</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-blue-600 font-bold">🎯</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Buyers Support Causes</h4>
                    <p className="text-gray-600">Every purchase can support a fundraiser or cause you care about while getting great products.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1">
                    <span className="text-green-600 font-bold">🔄</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Money Flows Everywhere</h4>
                    <p className="text-gray-600">Sellers profit, affiliates earn, fundraisers raise money, buyers save money - everyone wins!</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-purple-50 p-8 rounded-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Example: How Everyone Wins</h3>
              
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                  <h5 className="font-semibold">📱 $100 Phone Case Sale</h5>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div>• Seller keeps: $81.80 (after fees)</div>
                    <div>• Affiliate earns: $15 commission</div>
                    <div>• Fundraiser gets: $5 donation</div>
                    <div>• Buyer supports cause + gets product</div>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                  <h5 className="font-semibold">🤝 Affiliate Buying for Themselves</h5>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div>• Product price: $100</div>
                    <div>• Their commission back: $15</div>
                    <div>• <strong>Effective price: $85</strong></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-lg text-center">
                <strong>Everyone Wins • No One Loses</strong>
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
            Whether you want to sell, promote, fundraise, or just shop smart - there's a place for you here. 
            Join thousands already making money, saving money, and raising money together.
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
