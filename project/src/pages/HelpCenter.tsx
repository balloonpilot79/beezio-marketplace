import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  Heart, 
  DollarSign, 
  HelpCircle, 
  FileText,
  Video,
  MessageCircle,
  ArrowRight,
  Store,
  Share2,
  Gift,
  BarChart3,
  Settings,
  Shield
} from 'lucide-react';

const HelpCenter: React.FC = () => {
  
  const quickLinks = [
    {
      title: 'Complete Seller Guide',
      description: 'Everything you need to know about selling on Beezio',
      icon: Store,
      color: 'purple',
      link: '/seller-guide'
    },
    {
      title: 'Complete Affiliate Guide', 
      description: 'Master affiliate marketing and start earning commissions',
      icon: Share2,
      color: 'pink',
      link: '/affiliate-guide'
    },
    {
      title: 'Fundraising Guide',
      description: 'Learn how to fundraise through commerce for your cause',
      icon: Heart,
      color: 'emerald',
      link: '/fundraising-guide'
    },
    {
      title: 'Frequently Asked Questions',
      description: 'Quick answers to common questions',
      icon: HelpCircle,
      color: 'blue',
      link: '/faq'
    }
  ];

  const resources = [
    {
      category: 'Getting Started',
      icon: BookOpen,
      color: 'green',
      items: [
        { title: 'Creating Your Account', desc: 'Sign up and set up your profile' },
        { title: 'Choosing Your Account Type', desc: 'Seller, Affiliate, or Buyer - what\'s right for you?' },
        { title: 'Dashboard Overview', desc: 'Navigate your dashboard like a pro' },
        { title: 'Profile Setup', desc: 'Complete your profile for maximum success' }
      ]
    },
    {
      category: 'For Sellers',
      icon: Store,
      color: 'purple',
      items: [
        { title: 'Adding Your First Product', desc: 'Step-by-step product upload guide' },
        { title: 'Store Customization', desc: 'Brand your store and make it unique' }, 
        { title: 'Pricing Strategy', desc: 'How transparent pricing works' },
        { title: 'Store Integrations', desc: 'Connect Shopify, Etsy, Amazon and more' },
        { title: 'Managing Orders', desc: 'Process and fulfill customer orders' },
        { title: 'Analytics & Insights', desc: 'Track your store performance' }
      ]
    },
    {
      category: 'For Affiliates',
      icon: Share2,
      color: 'pink',
      items: [
        { title: 'Generating Affiliate Links', desc: 'Create tracking links that earn commissions' },
        { title: 'QR Code Marketing', desc: 'Use QR codes for offline promotion' },
        { title: 'Social Media Strategies', desc: 'Promote products on social platforms' },
        { title: 'Import Products', desc: 'Import from external platforms to promote' },
        { title: 'Performance Tracking', desc: 'Monitor clicks, conversions, and earnings' },
        { title: 'Gamification System', desc: 'Level up and earn badges' }
      ]
    },
    {
      category: 'Fundraising',
      icon: Heart,
      color: 'emerald',
      items: [
        { title: 'Setting Up Your Cause', desc: 'Register your organization or cause' },
        { title: 'Recruiting Supporters', desc: 'Turn supporters into fundraising partners' },
        { title: 'Product Selection', desc: 'Choose products that align with your cause' },
        { title: 'Training Materials', desc: 'Help your supporters become effective fundraisers' },
        { title: 'Tracking Impact', desc: 'Monitor fundraising performance and results' },
        { title: 'Success Stories', desc: 'Learn from successful fundraising campaigns' }
      ]
    },
    {
      category: 'Payments & Earnings',
      icon: DollarSign,
      color: 'yellow',
      items: [
        { title: 'Setting Up Stripe', desc: 'Connect your payment account' },
        { title: 'Understanding Commissions', desc: 'How commission rates work' },
        { title: 'Payment Schedules', desc: 'When and how you get paid' },
        { title: 'Tax Information', desc: 'Important tax considerations' },
        { title: 'International Payments', desc: 'Getting paid in other countries' },
        { title: 'Payment Troubleshooting', desc: 'Resolve payment issues' }
      ]
    },
    {
      category: 'Technical Support',
      icon: Settings,
      color: 'gray',
      items: [
        { title: 'Account Security', desc: 'Keep your account safe and secure' },
        { title: 'API Integrations', desc: 'Connect external platforms' },
        { title: 'Mobile Optimization', desc: 'Using Beezio on mobile devices' },
        { title: 'Browser Compatibility', desc: 'Supported browsers and requirements' },
        { title: 'Troubleshooting', desc: 'Fix common technical issues' },
        { title: 'Data Export', desc: 'Export your data and analytics' }
      ]
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      pink: 'bg-pink-100 text-pink-600 border-pink-200',
      emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
      gray: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-optimized Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12 md:py-16 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <BookOpen className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 md:mb-6" />
          <h1 className="text-3xl md:text-4xl lg:text-6xl font-bold mb-4 md:mb-6">Help Center</h1>
          <p className="text-lg md:text-xl lg:text-2xl opacity-90 max-w-3xl mx-auto px-2">
            Your comprehensive guide to succeeding on Beezio as a seller, affiliate, or fundraiser
          </p>
        </div>
      </section>

      {/* Quick Access Guides */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📚 Complete Guides</h2>
            <p className="text-xl text-gray-600">In-depth guides for every aspect of the platform</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {quickLinks.map((guide, index) => {
              const Icon = guide.icon;
              return (
                <Link
                  key={index}
                  to={guide.link}
                  className="bg-white rounded-lg shadow-lg p-4 md:p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group touch-action-manipulation tap-highlight-none"
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center mb-3 md:mb-4 ${getColorClasses(guide.color)}`}>
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">{guide.description}</p>
                  <div className="flex items-center text-indigo-600 font-semibold text-sm">
                    Read Guide <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Resource Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">📖 Help Topics</h2>
            <p className="text-xl text-gray-600">Browse by category to find what you need</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {resources.map((category, index) => {
              const Icon = category.icon;
              return (
                <div key={index} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center mb-6">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${getColorClasses(category.color)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{category.category}</h3>
                  </div>
                  <div className="space-y-3">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-gray-600 text-sm">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Video Tutorials */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Video className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🎥 Video Tutorials</h2>
            <p className="text-xl text-gray-600">Learn by watching step-by-step video guides</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Getting Started on Beezio', duration: '5:30', views: '2.1K' },
              { title: 'Upload Your First Product', duration: '8:15', views: '1.8K' },
              { title: 'Generate Affiliate Links', duration: '6:45', views: '3.2K' },
              { title: 'Set Up Fundraising Campaign', duration: '12:30', views: '956' },
              { title: 'Customize Your Store', duration: '9:20', views: '1.4K' },
              { title: 'Track Your Performance', duration: '7:10', views: '1.1K' }
            ].map((video, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">
                <div className="h-48 bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                  <Video className="h-16 w-16 text-white opacity-80" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-2">{video.title}</h3>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{video.duration}</span>
                    <span>{video.views} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <MessageCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">💬 Need Personal Help?</h2>
            <p className="text-xl text-gray-600">Our support team is here for you</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-8 text-center">
              <MessageCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Live Chat</h3>
              <p className="text-gray-600 mb-6">Quick answers during business hours (9 AM - 6 PM EST)</p>
              <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                Start Chat
              </button>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Email Support</h3>
              <p className="text-gray-600 mb-6">Detailed support for complex questions (24-48 hour response)</p>
              <a 
                href="mailto:support@beezio.co"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                Email Us
              </a>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-8 text-center">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Community Forum</h3>
              <p className="text-gray-600 mb-6">Connect with other users and share experiences</p>
              <button className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
                Join Community
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">🔥 Popular Help Articles</h2>
            <p className="text-xl text-gray-600">Most viewed help topics this week</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: 'How to increase your commission earnings', views: '5.2K', category: 'Affiliates' },
              { title: 'Setting up your Stripe account for payments', views: '4.8K', category: 'Payments' },
              { title: 'Best practices for product photography', views: '3.9K', category: 'Sellers' },
              { title: 'Recruiting supporters for your cause', views: '3.1K', category: 'Fundraising' },
              { title: 'Understanding the transparent pricing model', views: '2.7K', category: 'General' },
              { title: 'Integrating your existing Shopify store', views: '2.4K', category: 'Sellers' },
              { title: 'Creating effective QR code campaigns', views: '2.1K', category: 'Affiliates' },
              { title: 'Tax implications for affiliate earnings', views: '1.9K', category: 'Payments' }
            ].map((article, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 flex-1">{article.title}</h3>
                  <span className="text-sm text-gray-500 ml-4">{article.views}</span>
                </div>
                <span className="inline-block bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-medium">
                  {article.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Trust */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-green-600 mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🔒 Security & Trust</h2>
          <p className="text-xl text-gray-600 mb-8">
            Your data and transactions are protected with bank-level security
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-green-50 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-2">SSL Encryption</h3>
              <p className="text-gray-600 text-sm">All data transmitted is encrypted with 256-bit SSL</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-2">Stripe Payments</h3>
              <p className="text-gray-600 text-sm">Secure payment processing by industry leader Stripe</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-2">GDPR Compliant</h3>
              <p className="text-gray-600 text-sm">Full compliance with international data protection laws</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpCenter;
