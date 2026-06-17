import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import { getPartnerLabel, getPartnerProgramLabel } from '../utils/processorSafeCopy';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white border border-black/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
    <h2 className="text-2xl font-semibold text-[#101820]">{title}</h2>
    <div className="text-gray-700 leading-relaxed space-y-3">{children}</div>
  </section>
);

const AboutPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="space-y-10">
        <div className="space-y-5 text-center max-w-4xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5b00]">
            About Beezio
          </p>
          <h1 className="text-4xl font-bold text-[#101820]">A modern marketplace for physical goods</h1>
          <p className="text-lg text-gray-600">
            Beezio brings sellers, customers, and approved marketing partners together in a single, retail-first shopping experience.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/marketplace"
              className="inline-flex items-center px-6 py-3 rounded-full bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000]"
            >
              Browse the marketplace
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex items-center px-6 py-3 rounded-full border border-black text-black font-semibold hover:bg-black hover:text-[#ffcb05]"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="What Beezio does">
            <p>
              Beezio is an online retail platform where sellers list physical products, customers buy through a secure checkout,
              and orders are fulfilled with tracking and support.
            </p>
            <p>
              Beezio is a marketplace platform that facilitates transactions between buyers and independent sellers. Partners are
              independent contractors who market products using Beezio tools.
            </p>
          </Section>

          <Section title="Who Beezio is for">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Buyers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Shop trusted products from independent sellers and brands.</li>
                  <li>See clear pricing and shipping details before checkout.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Sellers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Independent sellers launch storefronts, upload products, and manage fulfillment.</li>
                  <li>Reach customers through marketplace discovery and partner promotions.</li>
                </ul>
              </div>
              <div id="partners">
                <h3 className="text-lg font-semibold text-[#101820]">{getPartnerLabel()}</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Approved members can join the {getPartnerProgramLabel()}.</li>
                  <li>Share curated product links and storefronts using Beezio tools.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Pricing transparency">
            <p>
              Buyers see a single retail price before checkout. Taxes and shipping are calculated at checkout based on the
              seller's settings and destination.
            </p>
          </Section>

          <Section title="Payments and checkout">
            <p>
              Purchases are completed through Beezio checkout, which provides order confirmations, receipts, and support contact
              information in one place.
            </p>
          </Section>
        </div>
      </div>
    </PublicLayout>
  );
};

export default AboutPage;
