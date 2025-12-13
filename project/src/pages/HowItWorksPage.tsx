import React from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
    <div className="space-y-2 text-gray-700 leading-relaxed">{children}</div>
  </section>
);

const HowItWorksPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold text-amber-700 uppercase tracking-[0.2em]">How it works</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">What is Beezio?</h1>
          <p className="text-gray-700 leading-relaxed max-w-3xl">
            Beezio is not a supplier or a dropshipping company. It's a marketplace and earning platform that sits on top of suppliers like CJ,
            print-on-demand partners, and regular sellers.
          </p>
        </header>

        <Section title="Think of it this way:">
          <ul className="list-disc list-inside space-y-2">
            <li>A supplier (like CJ) provides products and shipping.</li>
            <li>A seller chooses what to sell and sets their ask price.</li>
            <li>Beezio runs the marketplace, checkout, and payouts.</li>
            <li>Affiliates and referrers help bring buyers and new sellers to the platform.</li>
            <li>Beezio connects all of that in one place.</li>
          </ul>
        </Section>

        <Section title="How pricing works">
          <p className="text-gray-700">
            Sellers always enter the price they want to take home. We call this the ask price.
          </p>
          <p className="text-gray-700">Beezio then adds everything else on top:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Platform fee (Beezio's share)</li>
            <li>Affiliate commission (for people who promote the product)</li>
            <li>Referral rewards (for people who brought those affiliates to Beezio)</li>
            <li>Stripe payment processing fees</li>
          </ul>
          <p className="text-gray-700">
            The buyer sees one final price that already includes all of that. The result: the seller still receives their full ask price, affiliates
            and referrers get what they were promised, Beezio earns its platform fee, and buyers see a simple, honest price.
          </p>
        </Section>

        <Section title="For Sellers">
          <ul className="list-disc list-inside space-y-2">
            <li>Create a free store on Beezio.</li>
            <li>Add products (physical or digital) and set your ask price.</li>
            <li>Connect to a supplier like CJ Dropshipping or use your own inventory.</li>
            <li>Beezio automatically layers in its fees and affiliate rewards on top.</li>
            <li>You get paid your full ask when orders are completed.</li>
            <li>You don't have to build your own affiliate system, checkout, or marketplace. Beezio does that for you.</li>
          </ul>
        </Section>

        <Section title="For Affiliates">
          <p className="text-gray-700">Affiliates can:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Grab links for products, collections, and stores.</li>
            <li>Share them on social media, email, websites, and more.</li>
            <li>Earn commission every time someone buys through their link.</li>
            <li>Earn a lifetime 5% share of Beezio's platform earnings from any affiliate they refer.</li>
          </ul>
          <p className="text-gray-700">
            That means: you get paid for your direct sales and you also earn when the affiliates you brought in succeed.
          </p>
        </Section>

        <Section title="For Fundraisers and Causes">
          <p className="text-gray-700">Fundraisers can:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Launch campaigns with products instead of just asking for donations.</li>
            <li>Invite affiliates and supporters to promote those campaigns.</li>
            <li>Benefit from Beezio’s referral structure so more people have an incentive to help.</li>
          </ul>
          <p className="text-gray-700">
            Every sale helps your cause, and everyone involved can see how the money is split.
          </p>
        </Section>

        <Section title="How Beezio is different from suppliers">
          <p className="text-gray-700">
            Beezio is not a warehouse or shipping company. Suppliers store and ship products. Beezio is the place where sellers showcase what they
            want to sell, buyers come to shop, and affiliates and referrers earn from moving traffic and sales. Beezio is the hub that ties all of this
            together with transparent pricing and built-in earning.
          </p>
        </Section>
      </div>
    </PublicLayout>
  );
};

export default HowItWorksPage;
