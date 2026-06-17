import React from 'react';
import { Link } from 'react-router-dom';

const AffiliateCompletePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">🤝 Become a Beezio Partner</h1>
          <p className="text-xl opacity-90">
            Earn commissions by promoting products you love. No inventory, no customer service, just transparent payouts.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">How Partner Marketing Works</h2>
          
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Choose Products</h3>
              <p className="text-gray-600 text-sm">
                Browse our marketplace and select products that match your audience.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Get Your Link</h3>
              <p className="text-gray-600 text-sm">
                Generate unique partner links that track influencer attribution automatically.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">📢</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">3. Promote</h3>
              <p className="text-gray-600 text-sm">
                Share your links on social media, blogs, or websites. We provide marketing materials.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">4. Earn</h3>
              <p className="text-gray-600 text-sm">
                Get paid commissions for every sale made through your links.
              </p>
            </div>
          </div>
        </section>

        {/* Commission Structure */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">💵 Commission Structure</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm border p-8">
              <h3 className="text-2xl font-semibold text-green-600 mb-6">Earning Potential</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="font-medium">Standard Commission</span>
                  <span className="text-xl font-bold text-green-600">10-30%</span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="font-medium">High-Value Products</span>
                  <span className="text-xl font-bold text-green-600">Up to 50%</span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="font-medium">Recurring Products</span>
                  <span className="text-xl font-bold text-green-600">Monthly</span>
                </div>
                
                <div className="flex justify-between items-center py-3">
                  <span className="font-medium">Payment Schedule</span>
                  <span className="text-xl font-bold">Up to 14 days</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-blue-50 p-8 rounded-lg border">
              <h4 className="text-lg font-semibold mb-4">Real Examples</h4>
              
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <h5 className="font-semibold">Tech Product - $200</h5>
                  <p className="text-sm text-gray-600">25% Commission</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $50</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg">
                  <h5 className="font-semibold">Fashion Item - $80</h5>
                  <p className="text-sm text-gray-600">20% Commission</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $16</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg">
                  <h5 className="font-semibold">Monthly Service - $30</h5>
                  <p className="text-sm text-gray-600">30% Recurring</p>
                  <p className="text-lg font-bold text-green-600">You Earn: $9/month</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎯 Why Choose Beezio Partner Program?</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🚀 High Commissions</h3>
              <p className="text-gray-600">
                Earn 10-50% on every sale. Some of the highest rates in the industry with performance bonuses.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">📊 Real-Time Tracking</h3>
              <p className="text-gray-600">
                Monitor your clicks, conversions, and earnings in real-time with detailed analytics.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🎨 Marketing Materials</h3>
              <p className="text-gray-600">
                Professional banners, product images, and copy provided. Plus custom content creation tools.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🌍 Global Products</h3>
              <p className="text-gray-600">
                Promote products worldwide with multi-currency support and localized content.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">💳 Fast Payments</h3>
              <p className="text-gray-600">
                Payouts are issued after the standard review period to the PayPal email on file. Minimum payout is $25.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-3">🤝 Dedicated Support</h3>
              <p className="text-gray-600">
                Personal partner support, training resources, and 24/7 help to improve your results.
              </p>
            </div>
          </div>
        </section>

        {/* Strategies */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">📈 Success Strategies</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-4">Content Marketing</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Write product reviews on your blog</li>
                <li>• Create comparison articles</li>
                <li>• Share tutorial videos</li>
                <li>• Build email newsletters</li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-4">Social Media</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Instagram product showcases</li>
                <li>• YouTube unboxing videos</li>
                <li>• TikTok product demos</li>
                <li>• Facebook group recommendations</li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-4">Paid Advertising</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Google Ads campaigns</li>
                <li>• Facebook & Instagram ads</li>
                <li>• Influencer partnerships</li>
                <li>• Retargeting campaigns</li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold mb-4">Email Marketing</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Build targeted email lists</li>
                <li>• Send product recommendations</li>
                <li>• Share exclusive discounts</li>
                <li>• Automate follow-up sequences</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎯 Start Earning Today</h2>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-8 rounded-lg border">
            <h3 className="text-2xl font-semibold mb-4">Join Our Partner Program</h3>
            <p className="text-gray-700 mb-6">
              Start earning commissions today. It's free to join, and you can begin promoting products immediately.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all duration-200 text-center"
              >
                Join as Partner
              </Link>
              
              <Link
                to="/affiliate-dashboard-preview"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-200 text-center"
              >
                View Partner Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">❓ Partner FAQ</h2>
          
          <div className="space-y-4">
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">How much can I earn?</summary>
              <p className="mt-3 text-gray-600">
                Earnings vary based on your audience, engagement, and the products you promote. There are no guarantees.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">Is there a cost to join?</summary>
              <p className="mt-3 text-gray-600">
                No. Joining our partner program is free, and you can start promoting products right away.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">How do I get paid?</summary>
              <p className="mt-3 text-gray-600">
                Payouts are issued after the standard review period to the PayPal email on file. Minimum payout is $25.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">Can I promote on social media?</summary>
              <p className="mt-3 text-gray-600">
                Absolutely! We encourage social media promotion. We provide ready-made content and marketing materials for all major platforms.
              </p>
            </details>
            
            <details className="bg-white p-6 rounded-lg shadow-sm border">
              <summary className="font-semibold cursor-pointer">Do you provide training?</summary>
              <p className="mt-3 text-gray-600">
                Yes! We offer comprehensive training, webinars, marketing resources, and personal support to help you succeed.
              </p>
            </details>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AffiliateCompletePage;
