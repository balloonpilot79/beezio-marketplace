import React from 'react';
import { 
  Heart, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target,
  BarChart3,
  Globe,
  Zap,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  PieChart,
  Gift,
  Handshake,
  Award,
  Building,
  Megaphone
} from 'lucide-react';

const FundraisingGuide: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Heart className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Fundraising Through Commerce</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Revolutionary approach to fundraising that creates sustainable income for causes while providing value to supporters
          </p>
          <div className="mt-8 inline-flex items-center bg-white/20 rounded-full px-6 py-3">
            <Gift className="h-5 w-5 mr-2" />
            <span className="font-semibold">Turn every purchase into a donation that keeps giving!</span>
          </div>
        </div>
      </section>

      {/* Why This Works */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🌟 Why Commerce-Based Fundraising Works</h2>
            <p className="text-xl text-gray-600">A sustainable model that benefits everyone</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Gift className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Supporters Get Value</h3>
              <p className="text-gray-600">
                Instead of just donating, supporters receive products they actually want and need. 
                This creates a win-win scenario where giving feels rewarding.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Recurring Revenue</h3>
              <p className="text-gray-600">
                Unlike one-time donations, commerce creates ongoing revenue streams. 
                Affiliates continue earning commissions, providing sustainable funding.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Community Building</h3>
              <p className="text-gray-600">
                Supporters become advocates who share products with their networks, 
                expanding your reach organically and building a community around your cause.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🚀 How Fundraising Through Commerce Works</h2>
            <p className="text-xl text-gray-600">Simple steps to start generating sustainable funding</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-emerald-600 font-bold text-2xl">1</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Register Your Cause</h3>
              <p className="text-gray-600">Set up your organization's profile and verify your nonprofit status or community cause</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-blue-600 font-bold text-2xl">2</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Choose Products</h3>
              <p className="text-gray-600">Select products that align with your cause or appeal to your supporter base</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-purple-600 font-bold text-2xl">3</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Recruit Supporters</h3>
              <p className="text-gray-600">Turn supporters into affiliate partners who earn commissions while supporting your cause</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-green-600 font-bold text-2xl">4</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Earn Ongoing Revenue</h3>
              <p className="text-gray-600">Receive a percentage of all commissions earned by your supporter network</p>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <DollarSign className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💰 Revenue Model</h2>
            <p className="text-xl text-gray-600">How funds flow to your cause</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Example: $100 Product Sale</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Product Price:</span>
                  <span className="font-bold text-gray-900">$100.00</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Affiliate Commission (30%):</span>
                  <span className="font-bold text-purple-600">$30.00</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Cause Share (50% of commission):</span>
                  <span className="font-bold text-emerald-600">$15.00</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-700">Supporter Keeps:</span>
                  <span className="font-bold text-blue-600">$15.00</span>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg mt-4">
                  <p className="text-emerald-800 font-medium">✅ Your cause earns $15 per sale, plus the supporter is incentivized to sell more!</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Scaling Potential</h3>
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">10 Active Supporters</h4>
                  <p className="text-blue-700">5 sales each per month = $750/month</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-bold text-purple-800 mb-2">50 Active Supporters</h4>
                  <p className="text-purple-700">10 sales each per month = $7,500/month</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">100 Active Supporters</h4>
                  <p className="text-green-700">15 sales each per month = $22,500/month</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-bold text-yellow-800 mb-2">500 Active Supporters</h4>
                  <p className="text-yellow-700">20 sales each per month = $150,000/month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Types of Fundraising */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Target className="h-12 w-12 mx-auto text-orange-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🎯 Types of Causes That Thrive</h2>
            <p className="text-xl text-gray-600">Perfect for various types of organizations and causes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
              <Building className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Nonprofit Organizations</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Established 501(c)(3) charities</li>
                <li>• Local community organizations</li>
                <li>• Religious institutions</li>
                <li>• Educational foundations</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
              <Heart className="h-10 w-10 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Health & Medical</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Medical fundraising campaigns</li>
                <li>• Cancer research initiatives</li>
                <li>• Mental health awareness</li>
                <li>• Medical equipment funding</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <Users className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Community Causes</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• School fundraising programs</li>
                <li>• Sports teams and clubs</li>
                <li>• Community center projects</li>
                <li>• Local disaster relief</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6">
              <Globe className="h-10 w-10 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Environmental</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Climate change initiatives</li>
                <li>• Wildlife conservation</li>
                <li>• Sustainable living projects</li>
                <li>• Clean energy campaigns</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-6">
              <Handshake className="h-10 w-10 text-red-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Social Justice</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Civil rights organizations</li>
                <li>• Homeless shelter support</li>
                <li>• Food bank initiatives</li>
                <li>• Legal aid foundations</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
              <Award className="h-10 w-10 text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Arts & Culture</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Museum and gallery funding</li>
                <li>• Music and theater programs</li>
                <li>• Artist grant initiatives</li>
                <li>• Cultural preservation projects</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Product Selection Strategy */}
      <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Lightbulb className="h-12 w-12 mx-auto text-amber-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💡 Product Selection Strategy</h2>
            <p className="text-xl text-gray-600">Choosing products that resonate with your cause and supporters</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Cause-Aligned Products</h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">Environmental Causes</h4>
                  <p className="text-green-700 text-sm">Eco-friendly products, sustainable goods, solar panels, reusable items</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">Health Organizations</h4>
                  <p className="text-blue-700 text-sm">Fitness equipment, health supplements, wellness products, medical devices</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-bold text-purple-800 mb-2">Educational Causes</h4>
                  <p className="text-purple-700 text-sm">Books, learning materials, technology, online courses, educational toys</p>
                </div>
                <div className="p-4 bg-pink-50 rounded-lg">
                  <h4 className="font-bold text-pink-800 mb-2">Community Programs</h4>
                  <p className="text-pink-700 text-sm">Local artisan products, community-made goods, seasonal items</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">High-Converting Categories</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Health & Wellness</span>
                  <div className="text-right">
                    <div className="font-bold text-green-600">25-45%</div>
                    <div className="text-sm text-gray-600">Commission Range</div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Home & Garden</span>
                  <div className="text-right">
                    <div className="font-bold text-green-600">20-35%</div>
                    <div className="text-sm text-gray-600">Commission Range</div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Technology</span>
                  <div className="text-right">
                    <div className="font-bold text-green-600">15-25%</div>
                    <div className="text-sm text-gray-600">Commission Range</div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Fashion & Beauty</span>
                  <div className="text-right">
                    <div className="font-bold text-green-600">30-50%</div>
                    <div className="text-sm text-gray-600">Commission Range</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supporter Engagement */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Megaphone className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📢 Engaging Your Supporters</h2>
            <p className="text-xl text-gray-600">Turn supporters into active fundraising partners</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
              <Users className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Onboarding Program</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Welcome video explaining the program</li>
                <li>• Step-by-step setup guide</li>
                <li>• Personalized affiliate links</li>
                <li>• Marketing materials provided</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
              <Award className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Recognition Program</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Monthly top fundraiser awards</li>
                <li>• Social media shout-outs</li>
                <li>• Exclusive supporter events</li>
                <li>• Impact reports showing their contribution</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <BarChart3 className="h-8 w-8 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Performance Tracking</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Real-time dashboard access</li>
                <li>• Sales and commission tracking</li>
                <li>• Impact visualization</li>
                <li>• Goal setting and progress</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6">
              <Zap className="h-8 w-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Incentives & Bonuses</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Tiered commission structures</li>
                <li>• Volume bonuses for top performers</li>
                <li>• Special cause-related rewards</li>
                <li>• Early access to new products</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-6">
              <Target className="h-8 w-8 text-red-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Training & Support</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Sales training webinars</li>
                <li>• Product knowledge sessions</li>
                <li>• Marketing best practices</li>
                <li>• Dedicated support channel</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
              <Globe className="h-8 w-8 text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Community Building</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Private supporter Facebook group</li>
                <li>• Monthly virtual meetups</li>
                <li>• Peer-to-peer learning</li>
                <li>• Success story sharing</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Success Metrics */}
      <section className="py-16 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <PieChart className="h-12 w-12 mx-auto text-slate-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📊 Measuring Success</h2>
            <p className="text-xl text-gray-600">Key metrics to track your fundraising performance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Key Performance Indicators</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-gray-700">Active Supporters</span>
                  <span className="font-bold text-blue-600">Growth Month/Month</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Monthly Revenue</span>
                  <span className="font-bold text-green-600">Total Commissions</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="text-gray-700">Average Commission/Supporter</span>
                  <span className="font-bold text-purple-600">Per Person Impact</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="text-gray-700">Conversion Rate</span>
                  <span className="font-bold text-orange-600">Sales Efficiency</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Success Benchmarks</h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">Month 1-3: Foundation</h4>
                  <ul className="text-green-700 text-sm space-y-1">
                    <li>• Recruit 25-50 active supporters</li>
                    <li>• Generate $500-2,000 monthly</li>
                    <li>• Establish core product lineup</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">Month 4-6: Growth</h4>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>• Scale to 100-200 supporters</li>
                    <li>• Reach $2,000-8,000 monthly</li>
                    <li>• Optimize top-performing products</li>
                  </ul>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-bold text-purple-800 mb-2">Month 7-12: Scale</h4>
                  <ul className="text-purple-700 text-sm space-y-1">
                    <li>• Build 300-500+ supporter network</li>
                    <li>• Generate $10,000-30,000+ monthly</li>
                    <li>• Develop automated systems</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🏆 Success Stories</h2>
            <p className="text-xl text-gray-600">Real causes, real results</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-green-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Heart className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900">Local Animal Shelter</h3>
                <p className="text-gray-600 text-sm">Pet rescue and adoption center</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 mb-1">$12,500</p>
                <p className="text-gray-600 text-sm">Monthly sustainable funding</p>
                <p className="text-green-700 text-sm mt-2">"150 supporters selling pet supplies helped us save 200+ animals!"</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Building className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900">Community Youth Center</h3>
                <p className="text-gray-600 text-sm">After-school programs & sports</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 mb-1">$8,200</p>
                <p className="text-gray-600 text-sm">Monthly program funding</p>
                <p className="text-blue-700 text-sm mt-2">"Parents became our best fundraising partners!"</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Globe className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-900">Environmental Initiative</h3>
                <p className="text-gray-600 text-sm">Ocean cleanup project</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 mb-1">$18,700</p>
                <p className="text-gray-600 text-sm">Monthly conservation funding</p>
                <p className="text-purple-700 text-sm mt-2">"Eco-friendly products aligned perfectly with our mission!"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">❓ Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600">Common questions about commerce-based fundraising</p>
          </div>

          <div className="space-y-6">
            {[
              {
                question: "How is this different from traditional fundraising?",
                answer: "Instead of asking for donations, supporters purchase products they want while generating funds for your cause. This creates value for supporters and sustainable recurring revenue for your organization."
              },
              {
                question: "What percentage of commissions do causes receive?",
                answer: "Causes typically receive 30-50% of affiliate commissions, with supporters keeping the remainder. The exact split can be customized based on your organization's needs and supporter incentive structure."
              },
              {
                question: "How do we recruit and train supporters?",
                answer: "We provide complete onboarding materials, training webinars, marketing resources, and ongoing support. Most causes start by engaging their existing supporter base through email and social media."
              },
              {
                question: "What types of products work best?",
                answer: "Products that align with your cause or appeal to your supporter demographic perform best. Health products, eco-friendly items, educational materials, and everyday essentials all convert well."
              },
              {
                question: "How quickly can we start seeing revenue?",
                answer: "Most causes see their first commissions within 2-4 weeks of launch. Significant monthly revenue ($2,000+) typically develops within 3-6 months with active supporter engagement."
              },
              {
                question: "Do we need nonprofit status to participate?",
                answer: "While 501(c)(3) status is preferred, we also work with community causes, schools, sports teams, and other mission-driven organizations. Each application is reviewed individually."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-700">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Heart className="h-12 w-12 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-6">Ready to Start Sustainable Fundraising?</h2>
          <p className="text-xl opacity-90 mb-8">
            Transform your supporters into fundraising partners and create lasting impact
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-emerald-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Register Your Cause
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-emerald-600 transition-colors">
              Schedule Demo Call
            </button>
          </div>
          <p className="text-sm opacity-75 mt-4">
            No setup fees • 30-day trial • Dedicated success manager • Risk-free guarantee
          </p>
        </div>
      </section>
    </div>
  );
};

export default FundraisingGuide;
