import React from 'react';
import { 
  Share2, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Link2, 
  QrCode, 
  Target,
  BarChart3,
  Award,
  Zap,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Globe,
  Trophy,
  GamepadIcon
} from 'lucide-react';

const AffiliateGuide: React.FC = () => {
  console.log('AffiliateGuide component rendering');
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '20px', background: 'red', color: 'white', fontSize: '24px' }}>
        TEST - If you see this, the component is rendering!
      </div>
      {/* Hero Section */}
      <section style={{ background: 'linear-gradient(to right, #9333ea, #ec4899)', color: 'white', padding: '4rem 0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Share2 className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Complete Affiliate Guide</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Master affiliate marketing on Beezio and build a thriving income stream
          </p>
          <div className="mt-8 inline-flex items-center bg-white/20 rounded-full px-6 py-3">
            <Trophy className="h-5 w-5 mr-2" />
            <span className="font-semibold">Earn commission on every sale you generate!</span>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">Varies</div>
              <p className="text-gray-600">Commission Rate by Product</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">$0</div>
              <p className="text-gray-600">Startup Cost</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">Weekly</div>
              <p className="text-gray-600">Payout Schedule</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">10+</div>
              <p className="text-gray-600">Store Integrations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🚀 Getting Started</h2>
            <p className="text-xl text-gray-600">Start earning commissions in under 5 minutes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-purple-600 font-bold text-2xl">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Sign Up Free</h3>
              <ul className="text-gray-600 space-y-2 text-left">
                <li>• Create your affiliate account</li>
                <li>• No fees or upfront costs</li>
                <li>• Instant approval</li>
                <li>• Get your unique affiliate ID</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-blue-600 font-bold text-2xl">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Products</h3>
              <ul className="text-gray-600 space-y-2 text-left">
                <li>• Browse thousands of products</li>
                <li>• See commission rates upfront</li>
                <li>• Filter by category & commission</li>
                <li>• Import from other platforms</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-green-600 font-bold text-2xl">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Start Promoting</h3>
              <ul className="text-gray-600 space-y-2 text-left">
                <li>• Generate affiliate links</li>
                <li>• Create QR codes for offline</li>
                <li>• Share on social media</li>
                <li>• Track your earnings</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Promotion Methods */}
      <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Target className="h-12 w-12 mx-auto text-orange-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🎯 Promotion Methods</h2>
            <p className="text-xl text-gray-600">Multiple ways to earn commissions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <Link2 className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Product Links</h3>
              <p className="text-gray-600 mb-4">Generate unique tracking links for specific products</p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <code className="text-sm text-gray-700">beezio.co/product/123?ref=ABC123</code>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Globe className="h-10 w-10 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Site-Wide Links</h3>
              <p className="text-gray-600 mb-4">Earn on any purchase made through your general link</p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <code className="text-sm text-gray-700">beezio.co?ref=ABC123</code>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <QrCode className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">QR Codes</h3>
              <p className="text-gray-600 mb-4">Perfect for flyers, business cards, and offline marketing</p>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="inline-block p-2 bg-white border-2 border-gray-300 rounded">
                  <div className="grid grid-cols-8 gap-1">
                    {[...Array(64)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 ${
                          Math.random() > 0.5 ? 'bg-black' : 'bg-white'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Example QR Code</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Share2 className="h-10 w-10 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Social Media</h3>
              <p className="text-gray-600 mb-4">Built-in sharing tools for all major platforms</p>
              <div className="flex space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded"></div>
                <div className="w-8 h-8 bg-pink-500 rounded"></div>
                <div className="w-8 h-8 bg-red-500 rounded"></div>
                <div className="w-8 h-8 bg-green-500 rounded"></div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Users className="h-10 w-10 text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Your Network</h3>
              <p className="text-gray-600 mb-4">Share with friends, family, and your professional network</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Email marketing</li>
                <li>• Word of mouth</li>
                <li>• Community groups</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Zap className="h-10 w-10 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Content Creation</h3>
              <p className="text-gray-600 mb-4">Create content around products you love</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Product reviews</li>
                <li>• Tutorial videos</li>
                <li>• Blog posts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <DollarSign className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💰 Commission Structure</h2>
            <p className="text-xl text-gray-600">Transparent earnings with industry-leading rates</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Sample Commission Rates</h3>
              <div className="space-y-4">
                {[
                  { product: 'Digital Marketing Course', rate: '45%', commission: '$89.10' },
                  { product: 'Fitness Equipment', rate: '35%', commission: '$52.50' },
                  { product: 'Leather Wallet', rate: '30%', commission: '$27.00' },
                  { product: 'Wireless Headphones', rate: '25%', commission: '$37.50' },
                  { product: 'Premium Supplements', rate: '20%', commission: '$11.00' }
                ].map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-700">{item.product}</span>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{item.rate}</div>
                      <div className="text-sm text-gray-600">{item.commission} per sale</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Earning Potential</h3>
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold text-purple-600 mb-2">Part-Time (10 sales/month)</h4>
                  <p className="text-2xl font-bold text-gray-900">$300 - $900</p>
                  <p className="text-gray-600 text-sm">5-10 hours per week</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold text-purple-600 mb-2">Active (50 sales/month)</h4>
                  <p className="text-2xl font-bold text-gray-900">$1,500 - $4,500</p>
                  <p className="text-gray-600 text-sm">20-30 hours per week</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-bold text-purple-600 mb-2">Full-Time (200+ sales/month)</h4>
                  <p className="text-2xl font-bold text-gray-900">$6,000 - $18,000+</p>
                  <p className="text-gray-600 text-sm">40+ hours per week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gamification System */}
      <section className="py-16 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <GamepadIcon className="h-12 w-12 mx-auto text-indigo-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🎮 Gamification & Rewards</h2>
            <p className="text-xl text-gray-600">Level up your affiliate game</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <Award className="h-12 w-12 text-bronze-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bronze Level</h3>
              <div className="text-sm text-gray-600 mb-4">0-10 sales</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Standard commission rates</li>
                <li>• Basic affiliate tools</li>
                <li>• Monthly progress reports</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center border-2 border-yellow-400">
              <Award className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Silver Level</h3>
              <div className="text-sm text-gray-600 mb-4">11-50 sales</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• +5% commission bonus</li>
                <li>• Advanced marketing tools</li>
                <li>• Priority support</li>
                <li>• Exclusive product previews</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center border-2 border-yellow-500">
              <Award className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Gold Level</h3>
              <div className="text-sm text-gray-600 mb-4">51+ sales</div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• +10% commission bonus</li>
                <li>• Custom landing pages</li>
                <li>• Dedicated account manager</li>
                <li>• Early access to new features</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">🏆 Achievement Badges</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'First Sale', desc: 'Make your first commission' },
                { name: 'Top Performer', desc: '100+ sales in a month' },
                { name: 'Social Sharer', desc: 'Share 50+ products' },
                { name: 'QR Master', desc: 'Generate 20+ QR codes' },
                { name: 'Loyal Partner', desc: '6 months active' },
                { name: 'Category Expert', desc: 'Focus on one category' },
                { name: 'High Converter', desc: '10%+ conversion rate' },
                { name: 'Community Builder', desc: 'Refer 10+ affiliates' }
              ].map((badge, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <Trophy className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm">{badge.name}</h4>
                  <p className="text-xs text-gray-600">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Dashboard */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <BarChart3 className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📊 Enhanced Analytics</h2>
            <p className="text-xl text-gray-600">Track your performance with detailed insights</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Real-Time Tracking</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Click-through rates for each link</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Conversion rates by product</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Commission earnings over time</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Top-performing products</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Traffic source analysis</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Performance Insights</h3>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">This Month's Earnings</span>
                    <span className="font-bold text-green-600">$1,247.50</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Total Clicks</span>
                    <span className="font-bold text-blue-600">2,134</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Conversion Rate</span>
                    <span className="font-bold text-purple-600">4.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Average Commission</span>
                    <span className="font-bold text-orange-600">$13.87</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store Integrations */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Link2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🔌 Import Products to Promote</h2>
            <p className="text-xl text-gray-600">Connect with popular platforms and import products you want to promote</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
            {[
              'Printify', 'Printful', 'Etsy', 'Amazon', 'eBay',
              'Shopify', 'WooCommerce', 'Square', 'BigCommerce', 'CSV Import'
            ].map((platform) => (
              <div key={platform} className="bg-white rounded-lg p-4 text-center shadow-sm">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded"></div>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{platform}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 font-bold">1</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Connect Platform</h4>
                <p className="text-gray-600">Link your account or use API keys from supported platforms</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 font-bold">2</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Import Products</h4>
                <p className="text-gray-600">Choose products you want to promote with preset commission rates</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 font-bold">3</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Start Earning</h4>
                <p className="text-gray-600">Generate affiliate links and start promoting imported products</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Lightbulb className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💡 Best Practices</h2>
            <p className="text-xl text-gray-600">Tips from top-earning affiliates</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
              <Target className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Choose Quality Products</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• High commission rates (25%+)</li>
                <li>• Positive customer reviews</li>
                <li>• Clear product descriptions</li>
                <li>• Professional product photos</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
              <Users className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Know Your Audience</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Understand their pain points</li>
                <li>• Recommend relevant products</li>
                <li>• Share honest reviews</li>
                <li>• Build trust through transparency</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <Share2 className="h-8 w-8 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Diversify Your Channels</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Social media platforms</li>
                <li>• Email marketing</li>
                <li>• Blog content</li>
                <li>• QR codes for offline</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6">
              <BarChart3 className="h-8 w-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Track Performance</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Monitor click-through rates</li>
                <li>• Test different approaches</li>
                <li>• Focus on converting products</li>
                <li>• Optimize based on data</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
              <Zap className="h-8 w-8 text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Create Engaging Content</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Product demonstration videos</li>
                <li>• Before/after comparisons</li>
                <li>• Personal success stories</li>
                <li>• How-to tutorials</li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-6">
              <TrendingUp className="h-8 w-8 text-pink-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Scale Your Success</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Build an email list</li>
                <li>• Create evergreen content</li>
                <li>• Develop partnerships</li>
                <li>• Automate where possible</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🌟 Affiliate Success Stories</h2>
            <p className="text-xl text-gray-600">Real affiliates, real earnings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
              <h3 className="font-bold text-gray-900 mb-2">Marketing Mike</h3>
              <p className="text-gray-600 text-sm mb-4">Digital Marketing Specialist</p>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-purple-600 mb-1">$8,500</p>
                <p className="text-gray-600 text-sm">Monthly commissions</p>
                <p className="text-purple-700 text-sm mt-2">"QR codes doubled my offline sales!"</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 bg-pink-200 rounded-full mx-auto mb-4"></div>
              <h3 className="font-bold text-gray-900 mb-2">Fitness Fiona</h3>
              <p className="text-gray-600 text-sm mb-4">Fitness Influencer</p>
              <div className="bg-pink-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-pink-600 mb-1">$12,300</p>
                <p className="text-gray-600 text-sm">Monthly commissions</p>
                <p className="text-pink-700 text-sm mt-2">"Health products convert amazingly!"</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 bg-green-200 rounded-full mx-auto mb-4"></div>
              <h3 className="font-bold text-gray-900 mb-2">Tech Tom</h3>
              <p className="text-gray-600 text-sm mb-4">YouTube Tech Reviewer</p>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-2xl font-bold text-green-600 mb-1">$15,700</p>
                <p className="text-gray-600 text-sm">Monthly commissions</p>
                <p className="text-green-700 text-sm mt-2">"Electronics have high-value commissions!"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Earning?</h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of successful affiliates earning commissions
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Become an Affiliate
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors">
              View Affiliate Dashboard Demo
            </button>
          </div>
          <p className="text-sm opacity-75 mt-4">
            $0 to start • No monthly fees • Weekly payouts • 30-day money-back guarantee
          </p>
        </div>
      </section>
    </div>
  );
};

export default AffiliateGuide;
