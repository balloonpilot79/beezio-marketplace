import React from 'react';
import { getPartnerLabel, getPartnerProgramLabel } from '../utils/processorSafeCopy';
import PayoutTimingNotice from '../components/PayoutTimingNotice';

const faqSections = [
  {
    title: 'General',
    faqs: [
      {
        question: 'What is Beezio?',
        answer:
          'Beezio is a marketplace where sellers list products and buyers shop. Approved partners can share listings using Beezio tools.'
      },
      {
        question: 'How do I create an account?',
        answer:
          'Click Sign Up, choose your role (seller, partner, or buyer), and complete the profile prompts. You can switch roles later.'
      },
      {
        question: 'Is Beezio secure?',
        answer:
          'We use encrypted connections and trusted payment processors. Your data and payments are handled with standard industry safeguards.'
      },
      {
        question: 'How do I contact support?',
        answer:
          'Email support@beezio.co and we will get back to you as quickly as possible.'
      },
      {
        question: 'How do I reset my password?',
        answer:
          'Use the Forgot Password link on the login screen to reset via email.'
      }
    ]
  },
  {
    title: 'For Sellers',
    faqs: [
      {
        question: 'How do I list products?',
        answer:
          'Use the seller dashboard to add products, upload images, and set pricing. You can manage inventory and listings from the same place.'
      },
      {
        question: 'How does pricing work?',
        answer:
          'You set the amount you want to receive per sale. The customer price includes processing and platform fees.'
      },
      {
        question: 'What fees do I pay?',
        answer:
          'Platform and processing fees are built into the customer price so your seller payout stays protected.'
      },
      {
        question: 'Does tax or shipping come out of my payout?',
        answer:
          'No. Taxes and shipping are calculated at checkout and do not reduce your seller payout.'
      }
    ]
  },
  {
    title: 'For Partners',
    faqs: [
      {
        question: `What is the ${getPartnerProgramLabel()}?`,
        answer:
          `The ${getPartnerProgramLabel()} lets approved ${getPartnerLabel().toLowerCase()} share curated storefronts and product links using Beezio tools.`
      },
      {
        question: 'How do I share products?',
        answer:
          'Use the partner tools area to generate shareable links or QR codes for products and stores.'
      },
      {
        question: `Is the ${getPartnerProgramLabel()} active?`,
        answer:
          'Yes. Access is approved based on account status and program availability.'
      }
    ]
  },
  {
    title: 'For Buyers',
    faqs: [
      {
        question: 'How do I find products?',
        answer:
          'Use the marketplace search and filters, or browse curated sections on the homepage.'
      },
      {
        question: 'Do I need an account to shop?',
        answer:
          'You can browse without an account. Creating an account lets you track orders, save favorites, and contact support faster.'
      }
    ]
  },
  {
    title: 'Payments',
    faqs: [
      {
        question: 'How do sellers get paid?',
        answer:
          'Payouts are handled through the payment processor connected in the seller dashboard.'
      },
      {
        question: 'How long do payouts take?',
        answer:
          'Most payouts land within a few business days once an order is confirmed.'
      },
      {
        question: 'Do sellers or affiliates pay monthly fees?',
        answer:
          'No. Joining is free. Beezio earns from fees included in the product price when a sale happens.'
      },
      {
        question: 'Are there any signup fees?',
        answer:
          'No. Creating an account is free.'
      }
    ]
  },
  {
    title: 'Technical',
    faqs: [
      {
        question: 'Do you offer an API?',
        answer:
          'Not at the moment. We are focused on the core marketplace experience and will share updates if an API becomes available.'
      },
      {
        question: 'Can I use a custom domain?',
        answer:
          'Yes, sellers can connect a custom domain to their storefront.'
      },
      {
        question: 'Is there a mobile app?',
        answer:
          'Beezio runs as a responsive web app that works well on mobile. A dedicated app is not available yet.'
      }
    ]
  }
];

const FAQPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6">Frequently Asked Questions</h1>
          <p className="text-base sm:text-xl md:text-2xl opacity-90">
            Practical answers for building, promoting, and operating your Beezio business
          </p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-8 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <h2 className="text-2xl font-black text-slate-950">Want your storefront to look as polished as MareBelle or RedTail?</h2>
            <p className="mt-2 text-slate-700">Use the beginner-friendly storefront guide for branding, layouts, product placement, custom domains, social media, and the final launch checklist.</p>
            <a href="/faq/storefronts" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Open the storefront setup guide</a>
          </div>
          {faqSections.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                {category.title}
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {category.faqs.map((faq, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">{faq.question}</h3>
                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-8 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <PayoutTimingNotice />
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-8 sm:py-16 bg-gradient-to-r from-gray-100 to-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Still Have Questions?</h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
            Our support team is here to help you succeed
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Email Support</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Get detailed answers to your questions</p>
              <a href="mailto:support@beezio.co" className="text-sm sm:text-base text-blue-600 font-semibold hover:text-blue-700 break-all">
                support@beezio.co
              </a>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Contact Us</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">View all contact options</p>
              <a href="/contact" className="text-sm sm:text-base text-blue-600 font-semibold hover:text-blue-700">
                Contact Page
              </a>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">How It Works</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Learn about our platform</p>
              <a href="/how-it-works" className="text-sm sm:text-base text-blue-600 font-semibold hover:text-blue-700">
                View Guide
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQPage;
