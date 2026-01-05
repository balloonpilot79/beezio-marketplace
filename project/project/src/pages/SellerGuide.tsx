import React from 'react';
import { 
  Store, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Settings, 
  Upload, 
  Link,
  BarChart3,
  Globe,
  Palette,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Target,
  PieChart
} from 'lucide-react';

const SellerGuide: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Store className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Complete Seller Guide</h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Everything you need to know about selling on Beezio and building a successful business
          </p>
        </div>
      </section>

      {/* Quick Start Guide */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🚀 Quick Start Guide</h2>
            <p className="text-xl text-gray-600">Get selling in under 10 minutes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold text-xl">1</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Sign Up</h3>
              <p className="text-gray-600 text-sm">Create your seller account and complete your profile</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold text-xl">2</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Products</h3>
              <p className="text-gray-600 text-sm">Add your first product with photos and descriptions</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold text-xl">3</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Set Commissions</h3>
              <p className="text-gray-600 text-sm">Choose affiliate commission rates to drive sales</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold text-xl">4</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Start Earning</h3>
              <p className="text-gray-600 text-sm">Get paid automatically through Stripe</p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Selling Process */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">📝 How to Add Products</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Product Information</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Title & Description</p>
                    <p className="text-gray-600">Write compelling titles and detailed descriptions that sell</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">High-Quality Images</p>
                    <p className="text-gray-600">Add multiple photos showing different angles and use cases</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Video Content</p>
                    <p className="text-gray-600">Include YouTube or Vimeo videos to showcase your product</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">Categories & Tags</p>
                    <p className="text-gray-600">Help customers find your products with proper categorization</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">💰 Pricing Strategy</h3>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-bold text-gray-900 mb-4">How Beezio Pricing Works:</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-700">Your Desired Profit:</span>
                    <span className="font-bold text-green-600">$100.00</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-700">Affiliate Commission (30%):</span>
                    <span className="font-bold text-purple-600">$30.00</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-700">Platform Fee (10%):</span>
                    <span className="font-bold text-gray-600">$13.00</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-700">Processing Fee (3%):</span>
                    <span className="font-bold text-gray-600">$4.29</span>
                  </div>
                  <div className="flex justify-between items-center py-2 font-bold text-lg">
                    <span className="text-gray-900">Customer Pays:</span>
                    <span className="text-blue-600">$147.29</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-800 text-sm font-medium">✅ You always get your full desired profit amount!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store Customization */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Palette className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🎨 Customize Your Store</h2>
            <p className="text-xl text-gray-600">Create a professional brand that customers love</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <Settings className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Store Settings</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Custom store name & description</li>
                <li>• Business hours & contact info</li>
                <li>• Social media links</li>
                <li>• Custom policies</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Palette className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Visual Branding</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Upload custom banner image</li>
                <li>• Add your logo</li>
                <li>• Choose from 6 professional themes</li>
                <li>• Color scheme customization</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Globe className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Online Presence</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Dedicated store URL</li>
                <li>• Custom domain ready</li>
                <li>• SEO optimization</li>
                <li>• Social sharing tools</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Options */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Link className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🔌 Connect Existing Stores</h2>
            <p className="text-xl text-gray-600">Import products from your existing platforms</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              'Shopify', 'Etsy', 'Amazon', 'eBay', 'WooCommerce',
              'Printify', 'Printful', 'Square', 'BigCommerce', 'CSV Import'
            ].map((platform) => (
              <div key={platform} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{platform}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-green-800 mb-2">✨ Integration Benefits:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ul className="space-y-1 text-green-700">
                <li>• Bulk import hundreds of products</li>
                <li>• Automatic inventory sync</li>
                <li>• Set custom commission rates per platform</li>
              </ul>
              <ul className="space-y-1 text-green-700">
                <li>• Maintain original product information</li>
                <li>• Real-time price updates</li>
                <li>• Error handling and retry logic</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-16 bg-gradient-to-r from-yellow-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Lightbulb className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💡 Best Practices for Success</h2>
            <p className="text-xl text-gray-600">Tips from our most successful sellers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <Target className="h-8 w-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Optimize for Affiliates</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Set competitive commission rates (25-50%)</li>
                <li>• Create high-quality product images</li>
                <li>• Write compelling product descriptions</li>
                <li>• Provide marketing materials</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <TrendingUp className="h-8 w-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Drive Sales</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Use clear, benefit-focused titles</li>
                <li>• Add customer testimonials</li>
                <li>• Create urgency with limited offers</li>
                <li>• Update inventory regularly</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <Users className="h-8 w-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Build Community</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Engage with your affiliates</li>
                <li>• Provide excellent customer service</li>
                <li>• Share behind-the-scenes content</li>
                <li>• Build your email list</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics & Performance */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <BarChart3 className="h-12 w-12 mx-auto text-purple-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📊 Track Your Success</h2>
            <p className="text-xl text-gray-600">Use data to grow your business</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📈 Enhanced Seller Dashboard</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  <span className="text-gray-700">Real-time sales analytics</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-purple-600" />
                  <span className="text-gray-700">Customer insights & demographics</span>
                </div>
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <span className="text-gray-700">Product performance metrics</span>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="text-gray-700">Revenue & commission tracking</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">🎯 Key Metrics to Watch</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Conversion Rate</span>
                  <span className="font-bold text-green-600">2-5% (Good)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Affiliate Click-Through Rate</span>
                  <span className="font-bold text-green-600">3-8% (Good)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Average Order Value</span>
                  <span className="font-bold text-green-600">Track trends</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Customer Lifetime Value</span>
                  <span className="font-bold text-green-600">Optimize for repeat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment & Earnings */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <DollarSign className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💰 Getting Paid</h2>
            <p className="text-xl text-gray-600">Fast, secure payments through Stripe</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Payment Setup</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Connect Stripe Account</p>
                    <p className="text-gray-600">Set up your Stripe account in your seller dashboard</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Verify Information</p>
                    <p className="text-gray-600">Complete Stripe's verification process</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Start Receiving Payments</p>
                    <p className="text-gray-600">Automatic payouts within 2-7 business days</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Payout Schedule</h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">Standard Payouts</h4>
                  <p className="text-green-700">2-7 business days after sale completion</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">Express Payouts</h4>
                  <p className="text-blue-700">Same-day payouts available through Stripe</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-bold text-purple-800 mb-2">International</h4>
                  <p className="text-purple-700">Support for 40+ countries through Stripe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🌟 Success Stories</h2>
            <p className="text-xl text-gray-600">Real sellers, real results</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">Sarah's Handmade Crafts</h3>
                <p className="text-gray-600 text-sm">Artisan jewelry & home decor</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 mb-1">$15,000</p>
                <p className="text-gray-600 text-sm">Monthly revenue in first 6 months</p>
                <p className="text-purple-700 text-sm mt-2">"The affiliate network doubled my sales!"</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">TechGuru Mike</h3>
                <p className="text-gray-600 text-sm">Electronics & gadgets</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 mb-1">$45,000</p>
                <p className="text-gray-600 text-sm">First year revenue</p>
                <p className="text-blue-700 text-sm mt-2">"Store integrations saved me hours!"</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-green-200 rounded-full mx-auto mb-3"></div>
                <h3 className="font-bold text-gray-900">FitLife Nutrition</h3>
                <p className="text-gray-600 text-sm">Health & supplements</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 mb-1">$30,000</p>
                <p className="text-gray-600 text-sm">Monthly recurring revenue</p>
                <p className="text-green-700 text-sm mt-2">"Subscription products are amazing!"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Selling?</h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of successful sellers already earning on Beezio
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Create Seller Account
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors">
              View Demo Store
            </button>
          </div>
          <p className="text-sm opacity-75 mt-4">
            No setup fees • Start selling immediately • 30-day money-back guarantee
          </p>
        </div>
      </section>
    </div>
  );
};

export default SellerGuide;
