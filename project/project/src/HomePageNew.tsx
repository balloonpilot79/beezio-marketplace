import React from 'react';
import { Link } from 'react-router-dom';

interface HomePageProps {
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onOpenAuthModal }) => {
  const openRegister = () => onOpenAuthModal({ isOpen: true, mode: 'register' });
  const openLogin = () => onOpenAuthModal({ isOpen: true, mode: 'login' });

  return (
    <div className="min-h-screen bg-gradient-bg text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-yellow-200/40 blur-3xl" />
          <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-purple-200/40 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span>🐝</span>
              <span>Sell. Promote. Earn.</span>
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight tracking-tight text-gray-900 lg:text-7xl">
              One platform for people who want to
              <span className="block text-gradient">sell, promote, and grow.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              Beezio connects sellers, affiliates, influencers, and buyers in one marketplace.
              Sellers build stores. Promoters choose what they want to promote. Buyers shop through a simple checkout.
              Everyone gets clear tracking of the activity that belongs to them.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <button onClick={openRegister} className="btn-primary px-8 py-4 text-lg">
                Get Started Free
              </button>
              <Link to="/products" className="btn-secondary px-8 py-4 text-center text-lg">
                Browse the Marketplace
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">No subscription required to start. Earnings are based on qualifying sales and referrals.</p>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              ['🏪', 'Sellers', 'Create products and build a branded storefront.'],
              ['🤝', 'Affiliates', 'Choose products, create promotions, and earn from attributed sales.'],
              ['📣', 'Influencers', 'Promote products and refer sellers or affiliates for ongoing qualifying earnings.'],
              ['🛒', 'Buyers', 'Shop products from Beezio and independent storefronts.'],
            ].map(([icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-white/80 bg-white/85 p-6 text-center shadow-lg backdrop-blur">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-3xl">{icon}</div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-purple-600">How Beezio works</p>
            <h2 className="mt-2 text-4xl font-bold">A simple path from product to promotion to purchase.</h2>
            <p className="mt-4 text-lg text-gray-600">We handle the commerce infrastructure while each participant focuses on what they do best.</p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              ['01', 'A product is listed', 'Sellers can create products and manage their own storefronts.'],
              ['02', 'Someone promotes it', 'Affiliates can add products to their stores or create a single-product promotion.'],
              ['03', 'A buyer purchases', 'The customer shops through Beezio checkout and the sale is attributed to the correct participants.'],
              ['04', 'The sale is tracked', 'Earnings, holds, payouts, and transaction history are recorded for the people who earned them.'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                <div className="text-sm font-bold text-purple-600">{number}</div>
                <h3 className="mt-3 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role paths */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-purple-600">Choose your path</p>
            <h2 className="mt-2 text-4xl font-bold">Beezio works differently for every role.</h2>
          </div>
          <div className="mt-12 grid gap-7 lg:grid-cols-3">
            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <div className="text-3xl">🏪</div>
              <h3 className="mt-5 text-2xl font-bold">For Sellers</h3>
              <ul className="mt-5 space-y-3 text-gray-600">
                <li>✓ Create and manage products</li>
                <li>✓ Build a custom storefront</li>
                <li>✓ Manage variants, inventory, orders, and customers</li>
                <li>✓ Set the amount you want to receive from a sale</li>
                <li>✓ Track sales and earnings from your private dashboard</li>
              </ul>
              <Link to="/sellers" className="mt-7 block rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white transition hover:bg-slate-800">Learn About Selling</Link>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <div className="text-3xl">🤝</div>
              <h3 className="mt-5 text-2xl font-bold">For Affiliates</h3>
              <ul className="mt-5 space-y-3 text-gray-600">
                <li>✓ Browse the marketplace for products to promote</li>
                <li>✓ Add products to your custom store</li>
                <li>✓ Create single-product promotions</li>
                <li>✓ Use tracked links and promotional tools</li>
                <li>✓ Track clicks, sales, commissions, holds, and payouts</li>
              </ul>
              <Link to="/affiliates" className="mt-7 block rounded-xl bg-green-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-green-700">Explore Affiliate Opportunities</Link>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <div className="text-3xl">📣</div>
              <h3 className="mt-5 text-2xl font-bold">For Influencers & Referrers</h3>
              <ul className="mt-5 space-y-3 text-gray-600">
                <li>✓ Promote products with tracked attribution</li>
                <li>✓ Refer sellers and affiliates</li>
                <li>✓ Earn the applicable referral reward on qualifying sales</li>
                <li>✓ Keep your referral relationship connected to the people you bring in</li>
                <li>✓ See earnings, holds, available funds, and payout history</li>
              </ul>
              <button onClick={openRegister} className="mt-7 block w-full rounded-xl bg-purple-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-purple-700">Join Beezio</button>
            </div>
          </div>
        </div>
      </section>

      {/* Economics without trade secrets */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-purple-600">Clear economics</p>
              <h2 className="mt-2 text-4xl font-bold">Simple for users. Powerful behind the scenes.</h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Beezio keeps the complicated commerce, attribution, accounting, and payout infrastructure behind the scenes.
                Users see the information that matters to them without exposing private platform logic.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  ['Seller-first payouts', 'The seller payout they establish is protected by Beezio pricing rules.'],
                  ['Promotion earnings', 'Affiliate and referral earnings are tracked separately from seller earnings.'],
                  ['Transparent status', 'Dashboards show earnings, money on hold, available funds, and payout history.'],
                  ['Protected checkout', 'Orders and attribution are recorded through one checkout and ledger system.'],
                ].map(([title, text]) => (
                  <div key={title} className="flex gap-4 rounded-2xl bg-slate-50 p-5">
                    <div className="mt-1 text-green-600">✓</div>
                    <div><h4 className="font-bold">{title}</h4><p className="mt-1 text-sm text-gray-600">{text}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 p-8 text-white shadow-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/70">The Beezio promise</p>
              <h3 className="mt-3 text-3xl font-bold">You focus on selling or promoting. Beezio handles the machinery.</h3>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {['Marketplace', 'Custom storefronts', 'Promotion tools', 'Tracked attribution', 'Order records', 'Earnings ledgers', '14-day holds', 'PayPal payouts'].map((item) => (
                  <div key={item} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium">✓ {item}</div>
                ))}
              </div>
              <p className="mt-7 text-sm leading-relaxed text-white/70">
                Beezio does not promise guaranteed income. Earnings depend on actual qualifying sales and referral activity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / privacy */}
      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold">Built to be clear without exposing the machinery.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-gray-600">
            Beezio explains what participants can do, how earnings are created, and how orders and payouts are tracked.
            Proprietary pricing logic, fraud controls, internal platform operations, and other confidential implementation details stay behind the platform.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/faq" className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-100">Read the FAQs</Link>
            <button onClick={openLogin} className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-100">Sign In</button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center text-white">
          <div className="text-5xl">🐝</div>
          <h2 className="mt-5 text-4xl font-bold">Ready to build your Beezio income stream?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/90">
            Sell your products, promote products you believe in, build a storefront, or refer people into the ecosystem.
            Start free and let qualifying sales create the earnings.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
            <button onClick={openRegister} className="rounded-xl bg-white px-8 py-4 text-lg font-bold text-purple-700 transition hover:bg-gray-100">Create Your Free Account</button>
            <Link to="/products" className="rounded-xl border-2 border-white px-8 py-4 text-center text-lg font-bold text-white transition hover:bg-white hover:text-purple-700">Shop the Marketplace</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
