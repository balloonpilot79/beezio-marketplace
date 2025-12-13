import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';

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
            Beezio – Business Model Overview
          </p>
          <h1 className="text-4xl font-bold text-[#101820]">A multi-role marketplace that feels “unfair” in favor of people</h1>
          <p className="text-lg text-gray-600">
            Sellers keep 100% of what they ask for, affiliates run their own Beezio-powered storefronts, referral partners earn overrides,
            fundraisers sell products instead of relying on donation buttons, and Beezio bakes its fee into the price the buyer already expects.
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
          <Section title="1. One-Sentence Summary">
            <p>
              Beezio is a multi-role e-commerce marketplace where sellers, affiliates, referrers, and fundraisers share the same engine:
              sellers keep 100% of their ask price, affiliates earn clear commissions on every sale (including on their own curated storefronts),
              referral affiliates earn 5% overrides, and Beezio makes money by baking its platform fee plus payment processing into the final
              customer price.
            </p>
          </Section>

          <Section title="2. Core Idea & Mission">
            <p>
              Traditional marketplaces take a big cut from sellers and only give affiliates whatever is left. Beezio flips that script by protecting
              every promised payout and moving all fees upstream so buyers see an honest price.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Sellers keep 100% of what they ask for, whether it is a physical product, a dropship catalog, or a digital download.</li>
              <li>Affiliates earn predictable commissions and can run their own Beezio-powered storefronts without managing inventory.</li>
              <li>Referral affiliates earn a 5% override from Beezio’s 15% fee when they recruit other affiliates.</li>
              <li>Fundraisers sell the exact same catalog to raise money instead of pushing donation-only campaigns.</li>
              <li>Beezio earns 15% (before payment processing) on each sale and is transparent about it.</li>
            </ul>
          </Section>

          <Section title="3. The Main Roles in Beezio">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Buyers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Shop the main marketplace, a seller store, an affiliate storefront, or a fundraiser storefront.</li>
                  <li>Pay a single price that already includes all fees (tax and shipping are added at checkout).</li>
                  <li>Use a clean Stripe-powered checkout with status updates and receipts.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Sellers & Brands</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>List physical, digital, or dropship products on the marketplace or their own Beezio storefront.</li>
                  <li>Set their ask price and keep 100% of it on every sale—no platform cut from their share.</li>
                  <li>Tap into the affiliate/referral network without having to build their own program.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Affiliates</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Promote anything with links, codes, QR, or a full Beezio storefront they control.</li>
                  <li>Add products from any seller to their storefront and present it as “their” shop.</li>
                  <li>Earn commissions on every sale routed through their storefront or tracking links.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Referral Affiliates</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Onboard new affiliates and keep 5% of Beezio’s 15% platform fee on every sale that team member generates.</li>
                  <li>The override is paid out of Beezio’s share, so sellers and primary affiliates never lose margin.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">Fundraisers & Causes</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Use the exact commerce infrastructure to sell products instead of running donation-only campaigns.</li>
                  <li>Design a fundraiser storefront, set per-product amounts that go to the cause, and let affiliates promote it.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="4. How Money Flows on a Typical Sale">
            <p>
              Whether a buyer checks out on Beezio.com, a seller domain, an affiliate storefront, or a fundraiser page, the math stays consistent.
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>The customer sees a price that already includes the seller’s ask, affiliate commission, referral override, Beezio fee, and Stripe fees.</li>
              <li>Tax and shipping are added separately and passed through as-is.</li>
              <li>Stripe splits the payment so that sellers get their full ask, affiliates get the promised commission, referral partners get 5%, Stripe takes 2.9% + $0.60, and Beezio keeps the rest of the 15% fee.</li>
            </ol>
          </Section>

          <Section title="5. The Pricing Logic">
            <ul className="list-disc pl-5 space-y-1">
              <li>Sellers enter the amount they want to receive per sale.</li>
              <li>Each product defines an affiliate commission (percentage or fixed) plus any fundraiser amount.</li>
              <li>Beezio adds its 15% platform fee, reserves 5% of that for referral affiliates, and layers in payment processing.</li>
              <li>The buyer-facing price is auto-calculated so nobody has to do math or worry about hidden fees.</li>
            </ul>
            <p>
              Important rule: everything except tax and shipping is baked into the displayed price. That keeps the promise that the seller’s ask, the affiliate’s commission, and Beezio’s margin all stay intact.
            </p>
          </Section>

          <Section title="6. Example Sale">
            <p>
              On a $50 sale with a 10% affiliate commission and Beezio’s 15% platform fee: the affiliate earns $5, the referral affiliate earns $2.50,
              Beezio nets $5 before Stripe, Stripe keeps about $2.05, and the seller ends up with roughly $35.45—which is exactly what they asked for.
            </p>
          </Section>

          <Section title="7. Revenue Streams for Beezio">
            <ul className="list-disc pl-5 space-y-1">
              <li>Core revenue: 15% platform fee on every sale, with 5% of that going to referral affiliates.</li>
              <li>Applies to marketplace sales, seller storefronts, affiliate storefronts, and fundraiser storefronts.</li>
              <li>Future upside: paid boosts, featured listings, premium tooling, ads, and sponsorships—without forcing monthly fees to participate.</li>
            </ul>
          </Section>

          <Section title="8. Custom Storefronts & Domains">
            <div className="space-y-3">
              <p>Beezio powers multiple store types on the same infrastructure:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Sellers</strong> can launch branded shops, connect their own domain, and list endless products.</li>
                <li><strong>Affiliates</strong> can build curated storefronts that look like their own shop but still pay sellers, affiliates, and Beezio perfectly.</li>
                <li><strong>Fundraisers</strong> can design campaign stores, highlight causes, and earmark per-product payouts.</li>
              </ul>
              <p>
                Checkout always runs through Beezio’s Stripe setup, so orders, commissions, and fees are tracked the same way everywhere.
              </p>
            </div>
          </Section>

          <Section title="9. Product Types & Sourcing">
            <ul className="list-disc pl-5 space-y-1">
              <li>Dropship products from suppliers like CJdropshipping or Faire (Beezio sits on top of supplier catalogs).</li>
              <li>Physical inventory from brands or individuals shipping their own stock.</li>
              <li>Digital goods such as PDFs, planners, art, and downloads with instant delivery.</li>
              <li>Fundraising variants of any product type with per-sale payouts to the cause.</li>
            </ul>
          </Section>

          <Section title="10. Why Beezio Is Different (Value by Role)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">For Sellers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Keep 100% of your ask price—Beezio never dips into it.</li>
                  <li>No monthly fee required to participate.</li>
                  <li>Instant access to affiliates, fundraisers, and referral partners.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">For Affiliates</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Run curated storefronts, direct links, QR codes, or social campaigns.</li>
                  <li>Easily recruit other affiliates and bank 5% referral overrides.</li>
                  <li>Everything is tracked in one dashboard—no spreadsheets.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">For Fundraisers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Sell product kits or curated catalogs to raise money.</li>
                  <li>Supporters can become affiliates of the fundraiser instantly.</li>
                  <li>No need to set up merchant accounts or custom tech.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#101820]">For Buyers</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Support small sellers, creators, affiliates, and causes with every purchase.</li>
                  <li>See one honest price (plus tax and shipping) before checkout.</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="11. Technology & Future Roadmap">
            <ul className="list-disc pl-5 space-y-1">
              <li>A modern web app with a single Supabase/Stripe stack for users, products, orders, and payouts.</li>
              <li>Role-based dashboards for sellers, affiliates, fundraisers, and admins.</li>
              <li>Upcoming AI tools: product copy, pricing suggestions, promotional assets, and automated featuring of high-performing stores.</li>
              <li>Risk detection, fulfillment automation, and advanced analytics are built into the roadmap.</li>
            </ul>
          </Section>

          <Section title="12. Overall Vision">
            <p>
              Beezio wants to make commerce feel unfair (in the best way) toward regular people while still being profitable. More sellers mean more
              products. More affiliates mean more traffic. More fundraisers mean more meaningful reasons to shop. Every sale pays the people who made it
              happen, and Beezio scales by staying transparent about the math from day one.
            </p>
          </Section>
        </div>
      </div>
    </PublicLayout>
  );
};

export default AboutPage;
