import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, ShoppingBag, Store } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import { getPartnerLabel, getPartnerProgramLabel } from '../utils/processorSafeCopy';

const steps = [
  {
    title: '1. Sellers publish products',
    detail: 'Sellers create product pages, set pricing, and manage availability from one dashboard.',
  },
  {
    title: '2. Affiliates and influencers share',
    detail: 'Affiliates share products through their storefronts and campaigns, while influencers refer sellers and affiliates.',
  },
  {
    title: '3. Buyers checkout on Beezio',
    detail: 'Customers purchase in one checkout flow while orders route to sellers for fulfillment and updates.',
  },
];

const HowItWorksPage: React.FC = () => {
  return (
    <PublicLayout className="bzo-marketing-shell">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-6 py-10 md:px-10 md:py-14">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">How it works</p>
              <h1 className="text-3xl font-semibold text-gray-900 md:text-5xl" style={{ fontFamily: 'Fraunces, serif' }}>
                One visual flow for sellers, {getPartnerLabel().toLowerCase()}, and influencers.
              </h1>
              <p className="max-w-3xl text-base text-gray-700 md:text-lg">
                Beezio is designed so all three groups can win together. Sellers list products, {getPartnerLabel().toLowerCase()} and influencers share, and buyers checkout in a clean experience.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl backdrop-blur lg:justify-self-end">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-600">At a glance</p>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="rounded-xl border border-amber-100 bg-white px-4 py-3">Store setup and product publishing</div>
                <div className="rounded-xl border border-amber-100 bg-white px-4 py-3">Influencer and {getPartnerLabel().toLowerCase()} sharing</div>
                <div className="rounded-xl border border-amber-100 bg-white px-4 py-3">Checkout, routing, and support</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/85 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Free to join</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900 md:text-3xl">Sellers, affiliates, and influencers are free — buyers pay one clear price.</h2>
          <p className="mt-3 text-sm text-gray-700 md:text-base">
            Beezio is free for sellers, affiliates, and influencers. Instead of monthly fees, Beezio’s platform fees and commissions are built into product pricing. Buyers see one all-in price, and earnings are distributed automatically after purchase.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-gray-800 md:grid-cols-2">
            <li>✅ Free seller accounts</li>
            <li>✅ Free affiliate + influencer accounts</li>
            <li>✅ No monthly fees / no listing fees</li>
            <li>✅ One clear buyer price (fees + commissions included)</li>
            <li>✅ Automated payout splits after checkout</li>
          </ul>
        </section>

        <section className="bzo-marketing-band rounded-3xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">The simple flow</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.title} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bzo-marketing-band rounded-3xl p-6 md:p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Three roles</p>
            <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">Pick the path that fits you</h2>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/85 p-5 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <Store size={18} />
              </div>
              <h3 className="mt-3 text-xl font-semibold text-gray-900">Sellers</h3>
              <p className="mt-2 text-sm text-gray-700">Launch your catalog, manage inventory, and fulfill orders from one place.</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>Publish products and set pricing.</li>
                <li>Control shipping and fulfillment details.</li>
                <li>Track order updates and customer support.</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-amber-50/85 p-5 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                <Megaphone size={18} />
              </div>
              <h3 className="mt-3 text-xl font-semibold text-gray-900">{getPartnerLabel()}</h3>
              <p className="mt-2 text-sm text-gray-700">Join {getPartnerProgramLabel()} to pick products and share store links with your audience.</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>Pick products for your storefront.</li>
                <li>Share links and campaign assets.</li>
                <li>Track performance in your dashboard.</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/95 p-5 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <ShoppingBag size={18} />
              </div>
              <h3 className="mt-3 text-xl font-semibold text-gray-900">Influencers</h3>
              <p className="mt-2 text-sm text-gray-700">Influencers are a core part of the model, sharing product drops and storefront picks across social channels.</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>Share product links in social posts and livestreams.</li>
                <li>Use campaign assets and QR links.</li>
                <li>Collaborate with sellers and {getPartnerLabel().toLowerCase()} on launches.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="bzo-marketing-band rounded-3xl p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Ready to explore Beezio?</h2>
              <p className="text-sm text-gray-700">Apply early to join the first wave of sellers, {getPartnerLabel().toLowerCase()}, and influencers.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/auth/signup?role=seller"
                className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-amber-600"
              >
                Join as a seller
              </Link>
              <Link
                to="/affiliate/signup"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:border-amber-400 hover:text-amber-700"
              >
                Join as a {getPartnerLabel().toLowerCase()}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default HowItWorksPage;
