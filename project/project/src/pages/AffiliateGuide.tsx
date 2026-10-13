import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, DollarSign, Globe, Link2, QrCode, Share2, ShoppingBag, Users } from 'lucide-react';

const AffiliateGuide: React.FC = () => {
  const launchChannels = [
    { title: 'Physical Products', detail: 'Choose eligible products in the marketplace and review the commission offered for each completed sale.', icon: ShoppingBag },
    { title: 'Your Free Store', detail: 'Add marketplace products to your custom storefront alongside any products you sell yourself. One business account uses one shared store.', icon: Globe },
    { title: 'Tracked Links & QR Codes', detail: 'Open a product’s promotion tools to share its tracked link or QR code with your audience.', icon: QrCode },
    { title: 'Influencer Referrals', detail: 'Use your personal signup referral link to introduce sellers and affiliates. Earn on their eligible qualifying product sales, not their signups.', icon: Users },
  ];
  const promotionMethods = [
    'Your custom storefront with a curated product collection',
    'Product-specific tracked links from promotion tools',
    'QR codes for print, events, and offline promotion',
    'Social posts and content with accurate product details',
    'Clear disclosure when you may receive a commission',
    'Your influencer referral link for seller and affiliate signups',
  ];
  const launchRules = [
    'Sellers, affiliates, and influencers can join free. No inventory purchase is required for affiliate promotion.',
    'Affiliate commissions are set by the seller and already included in the selling price.',
    'Influencer earnings come from eligible, attributed product sales. Signups alone do not earn money; income is not guaranteed.',
    'Earnings have a 14-day hold from completed payment. Eligible balances of at least $5 are paid through PayPal on the 15th and last calendar day of each month.',
    'Refunds, disputes, verification, and payout policies apply. An order issue pauses only that order’s related funds.',
  ];
  const earningFlow = [
    'Create or sign in to your free business account.',
    'Choose eligible physical products and add them to your store, or open their promotion tools for tracked links and QR codes.',
    'Share through social content, community or local promotion, and disclose your commission relationship.',
    'Review attributed sales, referrals, held earnings, and payout status in your Business Center.',
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_#fff7cc,_#ffffff_40%,_#edf4ff_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm">
              <Share2 className="h-4 w-4 text-[#131921]" />
              Beezio Affiliate Guide
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">
              One partner account.
              <br />
              Promote products. Earn on sales.
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-slate-600">
              Build a free store around eligible physical products, share tracked links, and earn when your recommendations generate qualifying sales. You can also use your influencer referral link to introduce sellers and affiliates.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/business/promote" className="rounded-full bg-slate-900 px-5 py-3 font-semibold" style={{ color: '#ffffff' }}>Open promotion tools</Link>
              <Link to="/signup" className="rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900">Create a business account</Link>
              <Link to="/marketplace" className="rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900">Browse products</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
              <div className="rounded-full bg-[#131921] px-4 py-2 text-white">Free to join</div>
              <div className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">Real-time tracking</div>
              <div className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">Physical products</div>
              <div className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">Influencer referrals</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {launchChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Icon className="h-6 w-6 text-slate-900" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">{channel.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{channel.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-emerald-600" />
            <h2 className="text-2xl font-bold text-slate-900">How Beezio pays partners</h2>
          </div>
          <div className="mt-5 space-y-3">
            {launchRules.map((rule) => (
              <div key={rule} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {rule}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-[#131921]" />
            <h2 className="text-2xl font-bold text-slate-900">Launch workflow</h2>
          </div>
          <div className="mt-5 space-y-3">
            {earningFlow.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#131921] text-xs font-bold text-white">
                  {index + 1}
                </div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Promotion methods</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {promotionMethods.map((method) => (
              <div key={method} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-800">
                {method}
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <QrCode className="h-5 w-5 text-amber-600" />
              <div className="mt-3 text-sm font-semibold text-slate-900">Offline works too</div>
              <p className="mt-2 text-sm text-slate-600">QR codes and local promotion are built in for events, cards, flyers, and direct outreach.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div className="mt-3 text-sm font-semibold text-slate-900">Track what is working</div>
              <p className="mt-2 text-sm text-slate-600">Use your Business Center to review attributed sales, held earnings, payouts, and eligible referrals.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Users className="h-5 w-5 text-violet-600" />
              <div className="mt-3 text-sm font-semibold text-slate-900">Build a network layer</div>
              <p className="mt-2 text-sm text-slate-600">Affiliates earn product commissions from their promotions and may also earn fixed influencer bonuses for eligible seller and affiliate referrals.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AffiliateGuide;
