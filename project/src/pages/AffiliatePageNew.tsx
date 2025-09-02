import React from 'react';
import { TrendingUp, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const AffiliatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">For Affiliates</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Earn high commissions promoting quality products you love
          </p>
        </div>
      </section>

      {/* How It Works for Affiliates */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple Affiliate Process</h2>
            <p className="text-xl text-gray-600">Sign up, promote, earn - it's that easy</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">How Affiliate Marketing Works</h3>
              <div className="space-y-4 text-left max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600">Browse products with clear commission rates</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600">Generate your unique affiliate link</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600">Share and promote products</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">4</span>
                  </div>
                  <p className="text-gray-600">Earn commission on every sale!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Affiliate Dashboard Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Experience Your Affiliate Dashboard</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See the gamified platform designed to maximize your earnings
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Affiliate Dashboard</h3>
                  <TrendingUp className="h-8 w-8" />
                </div>
                <p className="mt-2 opacity-90">Gamified promotion platform</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Leaderboard & Rankings
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Commission Tracking
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Link Management Tools
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Campaign Creation
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Performance Analytics
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Earnings Dashboard
                  </div>
                </div>
                <Link 
                  to="/affiliate-dashboard-preview"
                  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Preview Affiliate Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Affiliate Success Stories & Tips */}
      <section id="affiliate-success" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Affiliate Success on Beezio</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Learn how our top affiliates are building sustainable income streams
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Success Stories */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Success Stories</h3>
              
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      SJ
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Sarah J. - Diamond Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "I went from $0 to $5,000/month in just 6 months by focusing on eco-friendly products. 
                      The transparency and high commission rates make Beezio the best platform I've used."
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $5,000/month
                      </span>
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                        💎 Diamond Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      MR
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Mike R. - Gold Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "The gamification aspect keeps me motivated. Seeing my rank climb and competing 
                      with other affiliates has increased my earnings by 300%!"
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $2,800/month
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                        🥇 Gold Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      LK
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Lisa K. - Silver Affiliate</h4>
                    <p className="text-gray-700 mb-3">
                      "Started part-time while working my day job. The site-wide affiliate links 
                      mean I earn from every sale, not just specific products!"
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">
                        💰 $1,200/month
                      </span>
                      <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
                        🥈 Silver Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Affiliate Tips & Strategies */}
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">💡 Pro Tips for Success</h3>
              
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-lg p-6">
                  <h4 className="font-bold text-amber-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">🎯</span>
                    Choose Your Niche Wisely
                  </h4>
                  <p className="text-amber-700">
                    Focus on products you're passionate about. Authenticity drives sales. Our top affiliates 
                    average 3x higher conversion rates when promoting products they personally use and love.
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">📱</span>
                    Leverage Social Media
                  </h4>
                  <p className="text-blue-700">
                    Use our built-in social sharing tools and custom link generators. Instagram Stories, 
                    TikTok reviews, and YouTube demos consistently outperform generic ads.
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-6">
                  <h4 className="font-bold text-purple-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">📊</span>
                    Track Everything
                  </h4>
                  <p className="text-purple-700">
                    Use our analytics dashboard daily. Monitor which content performs best, what times 
                    your audience is most active, and which products have the highest conversion rates.
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="font-bold text-green-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">🤝</span>
                    Build Relationships
                  </h4>
                  <p className="text-green-700">
                    Connect with sellers directly through our platform. Many offer exclusive deals 
                    and higher commission rates to top-performing affiliates.
                  </p>
                </div>

                <div className="bg-red-50 rounded-lg p-6">
                  <h4 className="font-bold text-red-800 mb-3 flex items-center">
                    <span className="text-2xl mr-2">⚡</span>
                    Act Fast on Trends
                  </h4>
                  <p className="text-red-700">
                    Our trending products dashboard shows what's hot right now. Early adopters 
                    of trending products earn 5x more in the first month than those who wait.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-500 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Affiliate Journey?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join over 10,000 affiliates already earning with Beezio. Start promoting today and see 
            your first commission within 24 hours!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transition-colors">
              Start as Affiliate - FREE
            </button>
            <Link 
              to="/affiliate-dashboard-preview"
              className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-white hover:text-purple-600 transition-colors"
            >
              Preview Affiliate Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AffiliatePage;
