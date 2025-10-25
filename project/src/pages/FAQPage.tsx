import React from 'react';

const faqs = [
  // General Platform Questions
  {
    question: 'What is Beezio?',
    answer:
      'Beezio is a transparent marketplace connecting sellers, affiliates, and buyers. We make it easy to sell, promote, and buy products with clear commissions and no hidden fees. We also support fundraising through commerce for causes and nonprofits.'
  },
  {
    question: 'How do I sign up as a seller, affiliate, or buyer?',
    answer:
      'Simply click Sign Up in the top right corner and select your account type. You can start selling, promoting, or shopping right away. Organizations can also register as causes to do fundraising through commerce.'
  },
  {
    question: 'Is Beezio secure?',
    answer:
      'Yes! We use bank-level security and Stripe for payment processing. Your data and transactions are protected with industry-standard encryption.'
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach our support team at support@beezio.co for any questions or issues. We typically respond within 24 hours.'
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Click Login, then use the "Forgot Password" link to reset your password via email.'
  },

  // Seller Questions
  {
    question: 'How do I add products to the marketplace?',
    answer:
      'Sellers can add products from their dashboard. Fill out the product form, select a category, upload images, set your price and commission rate. You can also import products from 10+ platforms like Shopify, Etsy, Amazon, and more.'
  },
  {
    question: 'How does the transparent pricing work?',
    answer:
      'You set your desired profit amount (e.g., $100). Choose an affiliate commission rate (e.g., 30%). We automatically calculate the final customer price including platform fees and processing. You always get your full desired profit!'
  },
  {
    question: 'Can I connect my existing store?',
    answer:
      'Yes! We support integrations with Shopify, Etsy, Amazon Seller, eBay, WooCommerce, Printify, Printful, Square, BigCommerce, and CSV imports. You can bulk import your entire catalog.'
  },
  {
    question: 'Can I sell locally?',
    answer:
      'Yes, Beezio supports local businesses. You can filter for local products and add your business location when listing products. Create a custom storefront with your branding.'
  },
  {
    question: 'How do I customize my store?',
    answer:
      'Access Store Customization in your dashboard to add banners, logos, themes, business hours, social links, and more. You get a professional storefront at your own URL.'
  },

  // Affiliate Questions
  {
    question: 'How do affiliates earn commissions?',
    answer:
      'Affiliates can promote products with their unique tracking links. When someone buys through your link, you earn a commission automatically. Commissions range from 15% to 50% depending on the product.'
  },
  {
    question: 'How do I generate affiliate links?',
    answer:
      'Browse products in your affiliate dashboard, click on any product to generate a unique tracking link. You can create product-specific links or site-wide links. QR codes are also available for offline marketing.'
  },
  {
    question: 'Can I import products to promote?',
    answer:
      'Yes! Affiliates can import products from Printify, Printful, Etsy, and other platforms to promote. Set your commission expectations and generate tracking links for imported products.'
  },
  {
    question: 'How do affiliate QR codes work?',
    answer:
      'Generate QR codes for any product or your entire affiliate store. Perfect for flyers, business cards, or offline marketing. When someone scans the code and makes a purchase, you earn the commission.'
  },
  {
    question: 'What is the affiliate gamification system?',
    answer:
      'Earn points, badges, and level up from Bronze to Silver to Gold based on your sales performance. Higher levels unlock bonus commissions, advanced tools, and exclusive perks.'
  },

  // Buyer Questions
  {
    question: 'How do I find the hottest or newest products?',
    answer:
      'The homepage features the newest and hottest selling items. You can also search and filter products in the marketplace by category, price, commission rate, and local availability.'
  },
  {
    question: 'Why do I see commission amounts on product pages?',
    answer:
      'Beezio is built around affiliate marketing. When you see commission amounts, it means you could earn that much by becoming an affiliate and promoting the product to others.'
  },
  {
    question: 'Can I track purchases made through affiliate links?',
    answer:
      'Yes! If you purchase through an affiliate link, you can see which affiliate you supported in your order history. This helps you support friends, causes, or influencers you follow.'
  },

  // Payment Questions
  {
    question: 'How do I get paid as a seller or affiliate?',
    answer:
      'Sellers and affiliates must connect their Stripe account in their dashboard to receive payments. Stripe securely handles all payouts and commissions with bank-level security.'
  },
  {
    question: 'How often are payments made?',
    answer:
      'Standard payouts are made within 2-7 business days after a sale. Express same-day payouts are available through Stripe for faster access to your earnings.'
  },
  {
    question: 'Are there any fees to join?',
    answer:
      'No! There are no signup fees, monthly fees, or hidden costs to join as a seller, affiliate, or buyer. We only take a small percentage when you make sales.'
  },

  // Fundraising Questions
  {
    question: 'How does fundraising through commerce work?',
    answer:
      'Organizations register as causes and recruit supporters to become affiliates. When supporters sell products, a percentage of their commissions goes to the cause while they keep the rest. This creates sustainable funding while providing value to supporters.'
  },
  {
    question: 'What types of organizations can do fundraising through commerce?',
    answer:
      'Nonprofits, schools, sports teams, community organizations, religious institutions, medical fundraising campaigns, environmental causes, and other mission-driven groups can participate.'
  },
  {
    question: 'How much can causes earn through commerce fundraising?',
    answer:
      'Causes typically receive 30-50% of affiliate commissions earned by their supporters. With 100 active supporters making an average of 10 sales per month, causes can generate $10,000-30,000+ monthly.'
  },
  {
    question: 'What products work best for fundraising?',
    answer:
      'Products that align with your cause (eco-friendly for environmental causes, health products for medical causes) or everyday essentials that appeal to your supporter base work best. High-commission products in health, beauty, and home categories perform well.'
  },
  {
    question: 'How do we train our supporters to be effective fundraisers?',
    answer:
      'We provide complete onboarding materials, training webinars, marketing resources, and ongoing support. Supporters get personalized affiliate links, QR codes, and social sharing tools to make fundraising easy.'
  },
  {
    question: 'Do you need 501(c)(3) status to fundraise?',
    answer:
      'While nonprofit status is preferred, we also work with schools, sports teams, community causes, and other mission-driven organizations. Each application is reviewed individually based on your mission and community impact.'
  },

  // Technical Questions
  {
    question: 'Can I use my own domain for my store?',
    answer:
      'Yes! Custom domain support is available for sellers who want to use their own branded domain for their Beezio storefront.'
  },
  {
    question: 'Is there a mobile app?',
    answer:
      'Currently, Beezio is a responsive web application that works great on all devices. A dedicated mobile app is in development and will be available soon.'
  },
  {
    question: 'Do you support international sellers and affiliates?',
    answer:
      'Yes! Through Stripe, we support sellers and affiliates in 40+ countries. International sellers can sell globally and receive payments in their local currency.'
  },
  {
    question: 'How do I track my performance?',
    answer:
      'Both sellers and affiliates get comprehensive analytics dashboards showing real-time sales, commissions, click-through rates, conversion rates, top-performing products, and more.'
  }
];

const FAQPage: React.FC = () => {
  const categories = [
    { name: 'General', start: 0, end: 4 },
    { name: 'For Sellers', start: 5, end: 9 },
    { name: 'For Affiliates', start: 10, end: 14 },
    { name: 'For Buyers', start: 15, end: 17 },
    { name: 'Payments', start: 18, end: 20 },
    { name: 'Fundraising', start: 21, end: 26 },
    { name: 'Technical', start: 27, end: 30 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6">Frequently Asked Questions</h1>
          <p className="text-base sm:text-xl md:text-2xl opacity-90">
            Everything you need to know about selling, affiliate marketing, and fundraising on Beezio
          </p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-8 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
                {category.name}
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {faqs.slice(category.start, category.end + 1).map((faq, idx) => (
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
