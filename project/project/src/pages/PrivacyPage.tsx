import React from 'react';
import { Shield, Lock, Eye, Users, Database, Cookie, Globe, Mail } from 'lucide-react';

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Shield className="h-16 w-16 text-amber-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information on Beezio.
          </p>
          <p className="text-sm text-gray-500 mt-4">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Quick Overview */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-amber-800 mb-3 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Privacy at a Glance
          </h2>
          <ul className="text-amber-700 space-y-2">
            <li>• We only collect information necessary to operate our marketplace</li>
            <li>• Your payment information is securely handled by Stripe</li>
            <li>• We never sell your personal data to third parties</li>
            <li>• You have full control over your account and data</li>
          </ul>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Database className="h-6 w-6 mr-2 text-amber-600" />
              Information We Collect
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Information</h3>
                <p className="text-gray-600 mb-2">When you create an account, we collect:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Full name and email address</li>
                  <li>Profile information you choose to share</li>
                  <li>Role preferences (buyer, seller, affiliate)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Transaction Information</h3>
                <p className="text-gray-600 mb-2">For marketplace transactions, we collect:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Product purchases and sales history</li>
                  <li>Shipping addresses for order fulfillment</li>
                  <li>Commission and earning records (for sellers/affiliates)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Usage Information</h3>
                <p className="text-gray-600 mb-2">We automatically collect:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                  <li>Device and browser information</li>
                  <li>IP address and location data</li>
                  <li>Pages visited and time spent on our platform</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-6 w-6 mr-2 text-amber-600" />
              How We Use Your Information
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Essential Services</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Process transactions and payments</li>
                  <li>• Manage your account and preferences</li>
                  <li>• Provide customer support</li>
                  <li>• Send transactional emails</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Platform Improvement</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Analyze usage patterns</li>
                  <li>• Improve user experience</li>
                  <li>• Develop new features</li>
                  <li>• Prevent fraud and abuse</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Payment Security */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Lock className="h-6 w-6 mr-2 text-amber-600" />
              Payment Security
            </h2>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-3">Stripe Payment Processing</h3>
              <p className="text-green-700 mb-3">
                All payment processing is handled by Stripe, a PCI DSS compliant payment processor. We never store your credit card information on our servers.
              </p>
              <ul className="text-green-700 space-y-1">
                <li>• End-to-end encryption for all transactions</li>
                <li>• Advanced fraud detection and prevention</li>
                <li>• Secure tokenization of payment methods</li>
                <li>• Regular security audits and compliance checks</li>
              </ul>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Globe className="h-6 w-6 mr-2 text-amber-600" />
              Data Sharing and Third Parties
            </h2>
            
            <p className="text-gray-600 mb-4">We only share your information in these limited circumstances:</p>
            
            <div className="space-y-3">
              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="font-semibold text-gray-800">Service Providers</h3>
                <p className="text-gray-600">Trusted partners who help us operate the platform (Supabase for data storage, Stripe for payments, email providers).</p>
              </div>
              
              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="font-semibold text-gray-800">Legal Requirements</h3>
                <p className="text-gray-600">When required by law or to protect our rights and the safety of our users.</p>
              </div>
              
              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="font-semibold text-gray-800">Business Transfers</h3>
                <p className="text-gray-600">In the event of a merger, sale, or transfer of assets, with prior notice to users.</p>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Cookie className="h-6 w-6 mr-2 text-amber-600" />
              Cookies and Tracking
            </h2>
            
            <p className="text-gray-600 mb-4">We use cookies and similar technologies to:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4 mb-4">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze how you use our platform</li>
              <li>Show you relevant content and features</li>
            </ul>
            <p className="text-gray-600">You can control cookies through your browser settings, though some features may not work properly if cookies are disabled.</p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-6 w-6 mr-2 text-amber-600" />
              Your Privacy Rights
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Access and Control</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• View and update your profile information</li>
                  <li>• Download your data</li>
                  <li>• Delete your account</li>
                  <li>• Control email preferences</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Data Portability</h3>
                <ul className="text-gray-600 space-y-1">
                  <li>• Export your transaction history</li>
                  <li>• Transfer data to other platforms</li>
                  <li>• Request data corrections</li>
                  <li>• Opt out of data processing</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Mail className="h-6 w-6 mr-2 text-amber-600" />
              Contact Us About Privacy
            </h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800 mb-4">
                If you have questions about this privacy policy or how we handle your data, please contact us:
              </p>
              <div className="space-y-2 text-blue-700">
                <p>📧 <strong>Email:</strong> privacy@beezio.co</p>
                <p>📧 <strong>General Support:</strong> support@beezio.co</p>
                <p>📍 <strong>Mail:</strong> Beezio Privacy Team, [Your Business Address]</p>
              </div>
            </div>
          </section>

          {/* Policy Updates */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Policy Updates</h2>
            <p className="text-gray-600 mb-4">
              We may update this privacy policy from time to time. When we do, we'll notify you by:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4 mb-4">
              <li>Posting the updated policy on this page</li>
              <li>Sending an email notification for significant changes</li>
              <li>Displaying a notice on our platform</li>
            </ul>
            <p className="text-gray-600">
              Your continued use of Beezio after any changes constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-600 mb-4">
            Questions about our privacy practices? We're here to help.
          </p>
          <a 
            href="/contact" 
            className="inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold"
          >
            <Mail className="h-5 w-5 mr-2" />
            Contact Our Privacy Team
          </a>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
