import React from 'react';
import { FileText, Shield, AlertCircle, CheckCircle, Ban } from 'lucide-react';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white py-8 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-amber-600 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Beezio is a commerce and promotion platform for products, digital offers, and vetted insurance storefronts.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-4">Last updated: June 13, 2026</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-6 mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-amber-800 mb-3 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Terms at a Glance
          </h2>
          <ul className="text-xs sm:text-sm text-amber-700 space-y-2">
            <li>- By using Beezio, you agree to these terms</li>
            <li>- You must be 18+ to create an account</li>
            <li>- Sellers may offer physical and approved digital products</li>
            <li>- Insurance storefronts are for vetted warm inbound requests only</li>
            <li>- Purchases are completed through Beezio checkout</li>
            <li>- Partner and influencer payouts are issued by Beezio</li>
          </ul>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              1. Platform Overview
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                Beezio provides a marketplace where sellers list products, creators offer approved digital items,
                affiliates and influencers promote offers, and insurance agents receive vetted warm inbound quote
                requests through Beezio storefronts.
              </p>
              <p>
                Purchases are completed through Beezio checkout. Insurance lead delivery is handled through Beezio's
                qualification, attribution, and moderation systems and is limited to consent-based warm inbound
                requests rather than cold lead lists.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              2. Account Registration
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You must be at least 18 years old to create an account.</li>
                <li>You must provide accurate and complete information.</li>
                <li>You are responsible for maintaining account security.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              3. Seller Responsibilities
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sellers must own or have rights to sell all listed products.</li>
                <li>Product descriptions and images must be accurate and properly licensed.</li>
                <li>Digital offers must be lawful, accurately described, and deliverable through the approved Beezio workflow.</li>
                <li>Insurance agents and partners may not market listings as cold leads, guaranteed approval, guaranteed coverage, or mass-agent distribution.</li>
                <li>Sellers are responsible for fulfillment, shipping, and customer support for their orders.</li>
                <li>Beezio administrators may remove, suspend, archive, or delete any listing at any time when we determine it is necessary or appropriate.</li>
                <li>Beezio may also decline or refuse to remove any listing when we determine removal is not necessary or appropriate.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              4. Payments and Fees
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All payments are processed securely through Beezio checkout using approved payment providers.</li>
                <li>Payments may be processed by PayPal or another provider chosen by Beezio.</li>
                <li>Buyers are charged at the time of purchase.</li>
                <li>Taxes and shipping are calculated at checkout based on seller settings.</li>
                <li>Insurance agents fund lead delivery through Beezio pricing and qualification rules before vetted leads are released.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Ban className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-red-600" />
              5. Refunds, Returns, and Chargebacks
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All sellers must follow Beezio's minimum standards: refunds within 14 days of delivery and exchanges within 30 days of delivery.</li>
                <li>Buyers should contact the seller first and follow the seller's return or exchange instructions.</li>
                <li>Beezio may assist with communication, but sellers remain responsible for fulfillment and refunds.</li>
                <li>Chargebacks or payment disputes may result in order suspension and reversal of payouts.</li>
                <li>When a seller approves a return for a shipped order, the buyer must provide return shipment tracking or other requested return-shipment proof.</li>
                <li>Refunds may be denied for misuse, fraud, or violations of these terms.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 id="seller-payouts" className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              6. Seller Payouts
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sellers are paid for completed orders according to Beezio's payout schedule.</li>
                <li>Orders that require shipping are not eligible for seller payout until a valid tracking number is on file.</li>
                <li>Sellers must maintain a valid PayPal account and complete any required verification.</li>
                <li>Sellers must follow PayPal acceptable use policies and all applicable laws.</li>
                <li>Payout timing may be affected by fraud review, disputes, or compliance checks.</li>
                <li>Beezio may withhold or delay payouts when required by law or payment providers.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 id="partner-commissions" className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              7. Partner Commissions
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Commissions are earned on orders that are properly tracked to a partner.</li>
                <li>Partners who sign up through an affiliate referral remain attributed to that affiliate; if this structure changes, Beezio will provide at least 30 days' advance notice.</li>
                <li>Attribution is determined by Beezio tracking links and system logs.</li>
                <li>Payouts are issued by Beezio from platform fees unless otherwise stated.</li>
                <li>Commissions are not guaranteed and may be reversed for refunds, chargebacks, fraud, or policy violations.</li>
                <li>Partners must complete tax and identity verification to receive payouts.</li>
                <li>Payouts are issued to the PayPal email on file.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 id="influencer-terms" className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              8. Influencer Terms
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Influencers must disclose paid or incentivized promotions and comply with FTC guidelines.</li>
                <li>Influencers may not use misleading claims, fake reviews, or prohibited content.</li>
                <li>Influencers must not purchase through their own links or engage in self-dealing.</li>
                <li>Beezio may remove or disable links that violate policies or provider requirements.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              9. Disputes and Resolution
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We encourage buyers and sellers to resolve issues directly and promptly.</li>
                <li>Beezio may request evidence such as tracking, delivery confirmation, return shipment tracking, or photos.</li>
                <li>We may suspend accounts or listings during an active dispute investigation.</li>
                <li>Our decision to assist with a dispute does not create liability for Beezio.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              10. Shipping and Delivery
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sellers are responsible for shipping timelines, packaging, and carrier selection.</li>
                <li>Estimated delivery windows are not guarantees unless stated by the seller.</li>
                <li>Risk of loss passes to the buyer upon delivery confirmation.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              11. Termination
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Beezio may suspend or terminate access for violations or illegal activity.</li>
                <li>Outstanding obligations, refunds, or disputes survive account closure.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-amber-600" />
              12. Governing Law and Venue
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-gray-600">
              <p>
                These Terms are governed by the laws of the State of Iowa, USA, without regard to conflict of law rules.
                Any disputes arising from these Terms or the use of Beezio will be resolved in the state or federal courts
                located in Iowa.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <Ban className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-red-600" />
              13. Prohibited Activities
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6">
              <ul className="text-xs sm:text-sm text-red-700 space-y-2">
                <li>- Selling counterfeit, stolen, or illegal products</li>
                <li>- Fraudulent transactions or payment manipulation</li>
                <li>- Spam, phishing, or malicious content</li>
                <li>- Circumventing the platform to avoid fees</li>
                <li>- Attempting to interfere with Beezio moderation or listing enforcement decisions</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Questions About These Terms?</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                If you have questions about these Terms of Service, contact us:
              </p>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="text-gray-700">
                  <strong>Email:</strong> <a href="mailto:legal@beezio.co" className="text-amber-600 hover:text-amber-700">legal@beezio.co</a>
                </p>
                <p className="text-gray-700">
                  <strong>Support:</strong> <a href="mailto:support@beezio.co" className="text-amber-600 hover:text-amber-700">support@beezio.co</a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
