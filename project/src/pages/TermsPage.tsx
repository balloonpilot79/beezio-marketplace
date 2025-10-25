import React from 'react';
import { FileText, Shield, DollarSign, Users, AlertCircle, CheckCircle, Scale, Ban } from 'lucide-react';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white py-8 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-amber-600 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Please read these terms carefully before using Beezio.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-4">Last updated: October 25, 2025</p>
        </div>

        {/* Quick Overview */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-6 mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-amber-800 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Terms at a Glance
          </h2>
          <ul className="text-xs sm:text-sm text-amber-700 space-y-2">
            <li>• By using Beezio, you agree to these terms</li>
            <li>• You must be 18+ to create an account</li>
            <li>• Sellers keep 100% of their desired profit</li>
            <li>• All sales are final unless otherwise stated</li>
            <li>• We reserve the right to remove inappropriate content</li>
          </ul>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Acceptance of Terms */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Scale className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              1. Acceptance of Terms
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                By accessing or using Beezio ("the Platform"), you agree to be bound by these Terms of Service 
                and all applicable laws and regulations. If you do not agree with any of these terms, you are 
                prohibited from using or accessing this site.
              </p>
              <p>
                We reserve the right to modify these terms at any time. Your continued use of the Platform 
                following any changes indicates your acceptance of the new terms.
              </p>
            </div>
          </section>

          {/* Account Registration */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              2. Account Registration
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p><strong>Eligibility:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must be at least 18 years old to create an account</li>
                <li>You must provide accurate and complete information</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You may not share your account credentials with others</li>
              </ul>
              
              <p className="mt-4"><strong>Account Types:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Buyer:</strong> Purchase products from sellers and affiliates</li>
                <li><strong>Seller:</strong> List and sell products on the marketplace</li>
                <li><strong>Affiliate:</strong> Promote products and earn commissions</li>
                <li><strong>Fundraiser:</strong> Raise funds for causes by selling products</li>
              </ul>
            </div>
          </section>

          {/* For Sellers */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              3. Seller Terms
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p><strong>Product Listings:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must own or have rights to sell all products you list</li>
                <li>Product descriptions must be accurate and not misleading</li>
                <li>You are responsible for setting your desired profit amount</li>
                <li>All images must be your own or properly licensed</li>
              </ul>

              <p className="mt-4"><strong>Pricing & Fees:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Platform fee: 15% of listing price (fixed)</li>
                <li>Sellers receive 100% of their desired profit amount</li>
                <li>You set affiliate commission rates (percentage or flat rate)</li>
                <li>Referral commissions (5%) come from platform fee, not seller profit</li>
                <li>Payment processing fees handled by Stripe (2.9% + $0.30)</li>
              </ul>

              <p className="mt-4"><strong>Order Fulfillment:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must fulfill orders within the timeframe specified in your listing</li>
                <li>You are responsible for shipping and handling</li>
                <li>You must provide tracking information when available</li>
                <li>Dropshipping is allowed if properly disclosed</li>
              </ul>
            </div>
          </section>

          {/* For Affiliates */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              4. Affiliate Terms
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p><strong>Commission Structure:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Affiliates earn commission rates set by sellers (varies by product)</li>
                <li>Commission rates can be percentage-based or flat rate</li>
                <li>Affiliates do NOT pay the affiliate commission when purchasing (5% discount)</li>
                <li>Commissions paid weekly via Stripe Connect (minimum $25 balance)</li>
              </ul>

              <p className="mt-4"><strong>Referral Program:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Earn 5% of platform fee on sales made by affiliates you recruit</li>
                <li>Referral commission is passive income for life</li>
                <li>Must use unique referral code or link to track relationships</li>
                <li>Referral earnings paid weekly with regular commissions</li>
              </ul>

              <p className="mt-4"><strong>Promotion Guidelines:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must disclose affiliate relationships when promoting</li>
                <li>No spam or unsolicited marketing</li>
                <li>No misleading or false advertising</li>
                <li>Follow FTC guidelines for affiliate marketing</li>
              </ul>
            </div>
          </section>

          {/* Payments & Refunds */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              5. Payments & Refunds
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p><strong>Payment Processing:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All payments processed securely through Stripe</li>
                <li>We do not store your payment information</li>
                <li>Buyers are charged at time of purchase</li>
                <li>Sellers receive payouts weekly (minimum $25)</li>
              </ul>

              <p className="mt-4"><strong>Refund Policy:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All sales are final unless otherwise stated by seller</li>
                <li>Refunds for defective or misrepresented products handled case-by-case</li>
                <li>Disputes resolved through Beezio support team</li>
                <li>Chargebacks may result in account suspension</li>
              </ul>
            </div>
          </section>

          {/* Prohibited Activities */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Ban className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-red-600" />
              6. Prohibited Activities
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6">
              <p className="text-sm sm:text-base text-red-800 font-semibold mb-3">
                The following activities are strictly prohibited:
              </p>
              <ul className="text-xs sm:text-sm text-red-700 space-y-2">
                <li>• Selling counterfeit, stolen, or illegal products</li>
                <li>• Fraudulent transactions or payment manipulation</li>
                <li>• Harassment, abuse, or discrimination</li>
                <li>• Spam, phishing, or malicious content</li>
                <li>• Circumventing the platform to avoid fees</li>
                <li>• Manipulating reviews or ratings</li>
                <li>• Using bots or automated systems without permission</li>
                <li>• Selling restricted items (weapons, drugs, adult content)</li>
              </ul>
              <p className="text-xs sm:text-sm text-red-700 mt-4">
                <strong>Violation of these terms may result in immediate account termination and legal action.</strong>
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              7. Intellectual Property
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                All content on Beezio, including but not limited to text, graphics, logos, images, and software, 
                is the property of Beezio or its content suppliers and is protected by copyright and trademark laws.
              </p>
              <p>
                Sellers retain ownership of their product listings and content but grant Beezio a license to 
                display, distribute, and promote such content on the platform.
              </p>
              <p>
                If you believe your intellectual property has been infringed, please contact us at 
                <a href="mailto:legal@beezio.co" className="text-amber-600 hover:text-amber-700 font-medium"> legal@beezio.co</a>
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              8. Limitation of Liability
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                Beezio acts as a marketplace platform connecting buyers and sellers. We are not responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Quality, safety, or legality of products sold</li>
                <li>Accuracy of seller or affiliate representations</li>
                <li>Ability of sellers to complete transactions</li>
                <li>Ability of buyers to pay for items</li>
                <li>Disputes between users</li>
              </ul>
              <p className="mt-4">
                <strong>The platform is provided "as is" without warranties of any kind, either express or implied.</strong>
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Ban className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              9. Account Termination
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                We reserve the right to suspend or terminate your account at any time for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Multiple buyer/seller complaints</li>
                <li>Abuse of the platform or other users</li>
                <li>Non-payment of fees owed to Beezio</li>
              </ul>
              <p className="mt-4">
                You may close your account at any time by contacting support. Outstanding balances must be 
                settled before account closure.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Scale className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              10. Governing Law
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                These Terms of Service are governed by and construed in accordance with the laws of the United States. 
                Any disputes arising from these terms will be resolved through binding arbitration in accordance with 
                the rules of the American Arbitration Association.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Questions About These Terms?</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="text-gray-700">
                  <strong>Email:</strong> <a href="mailto:legal@beezio.co" className="text-amber-600 hover:text-amber-700">legal@beezio.co</a>
                </p>
                <p className="text-gray-700">
                  <strong>Support:</strong> <a href="mailto:support@beezio.co" className="text-amber-600 hover:text-amber-700">support@beezio.co</a>
                </p>
                <p className="text-gray-700">
                  <strong>General:</strong> <a href="mailto:info@beezio.co" className="text-amber-600 hover:text-amber-700">info@beezio.co</a>
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Agreement Notice */}
        <div className="mt-12 p-6 bg-amber-50 border-2 border-amber-300 rounded-lg text-center">
          <p className="text-sm sm:text-base text-gray-800">
            By using Beezio, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
