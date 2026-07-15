import React from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare2 } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';

interface HomePageProps {
  onOpenSimpleSignup?: () => void;
}

const freeToJoinPoints = [
  'One free business account includes seller, affiliate, and influencer tools',
  'No monthly fees or listing fees',
  'One branded storefront for your products and marketplace products',
  'Single-product links, QR codes, social copy, and promotional assets',
  'Lifetime influencer attribution when a referred business makes eligible sales',
  'Automated seller, affiliate, and influencer payout tracking',
];

const roleExplainers = [
  {
    title: 'Sell',
    detail: 'List your own products and manage fulfillment',
  },
  {
    title: 'Promote',
    detail: 'Add marketplace products and share tracked promotions',
  },
  {
    title: 'Recruit',
    detail: 'Invite businesses and track lifetime influencer earnings',
  },
];

const HomePageBZO: React.FC<HomePageProps> = ({ onOpenSimpleSignup }) => {
  return (
    <PublicLayout className="bzo-marketing-shell">
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-6 py-10 md:px-10 md:py-14">
          <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-gray-900 md:text-5xl" style={{ fontFamily: 'Fraunces, serif' }}>
                  Build your store, promote products, and grow a business network from one Beezio account.
                </h2>
                <p className="max-w-3xl text-base leading-7 text-gray-700 md:text-lg">
                  Beezio is the business platform behind independent seller and affiliate storefronts. Every business account includes seller, affiliate, and influencer tools together—without forcing you to choose only one way to earn.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-sm leading-6 text-gray-800 md:text-base">
                  Add your own products, choose products from the business marketplace, organize them in one branded storefront, and promote any single item with tracked links, QR codes, ready-to-paste copy, posters, email, SMS, and embeds.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {roleExplainers.map((role) => (
                  <div key={role.title} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-4 shadow-sm backdrop-blur">
                    <p className="text-sm font-semibold text-gray-900">{role.title}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-700">{role.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 text-sm text-gray-800 md:grid-cols-2 md:gap-x-8 md:gap-y-3">
                {freeToJoinPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <CheckSquare2 className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
                    <span className="leading-6">{point}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to="/signup"
                  onClick={(event) => {
                    if (onOpenSimpleSignup) {
                      event.preventDefault();
                      onOpenSimpleSignup();
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-amber-600"
                >
                  Create Business Account
                </Link>
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:border-emerald-400 hover:text-emerald-700"
                >
                  Explore Products to Promote
                </Link>
              </div>
            </div>

            <div className="flex justify-center self-center lg:justify-end">
              <img
                src="/bzobee.png"
                alt="BZO the Bee mascot"
                className="h-auto w-40 drop-shadow-xl sm:w-48 md:w-52 lg:w-60"
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-8 md:py-10">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-100/50 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="relative">
            <div className="mx-auto max-w-4xl space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Built with Beezio storefront tools</p>
              <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-5xl" style={{ fontFamily: 'Fraunces, serif' }}>
                Meet MareBelle—an example of the branded store you can build on Beezio.
              </h2>
              <p className="mx-auto max-w-3xl text-sm leading-7 text-gray-700 md:text-base">
                This sample uses the same Beezio storefront tools available to every business account: one store slug, custom branding, your own products, and marketplace products you choose to promote.
              </p>
            </div>

            <div className="relative mt-8">
              <div className="rounded-[30px] border border-amber-200 bg-gradient-to-br from-slate-100 via-white to-amber-50 p-3 shadow-[0_28px_70px_rgba(15,23,42,0.16)] md:p-4">
                <img
                  src="/marebelle-storefront-example.png"
                  alt="MareBelle example Beezio slug storefront mixing brand-owned and marketplace products"
                  className="w-full rounded-[22px] border border-slate-200 object-cover"
                />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-200 bg-white px-5 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-amber-800 shadow-lg">
                Beezio storefront example
              </div>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-gray-800 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="font-semibold text-gray-900">Your products</p>
                <p className="mt-1 text-gray-600">List your own items, control pricing, and build recognition for your brand.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="font-semibold text-gray-900">Marketplace products</p>
                <p className="mt-1 text-gray-600">Choose products from other sellers and place them where they fit your store.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="font-semibold text-gray-900">One branded destination</p>
                <p className="mt-1 text-gray-600">Keep one store URL, one look, and one dashboard while selling both.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Build your Beezio storefront
              </Link>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-white via-amber-50 to-orange-50 px-6 py-8 shadow-sm md:px-8 md:py-10">
          <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Why advertise on Beezio</p>
              <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl" style={{ fontFamily: 'Fraunces, serif' }}>
                Most sellers give away 10% to 30% in discounts. Put that same percentage into affiliate marketing and reach more buyers instead.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-gray-700 md:text-base">
                Deep discounts shrink your margin and end after one order. Beezio lets you use that same budget to reward affiliates who keep pushing your product across a wider audience. The money goes toward distribution, not just a lower price tag.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-gray-800">
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="font-semibold text-gray-900">Keep the value of your product</p>
                <p className="mt-1 text-gray-600">Protect your brand instead of training buyers to wait for markdowns.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="font-semibold text-gray-900">Turn the budget into reach</p>
                <p className="mt-1 text-gray-600">Affiliates take your offer farther than a silent discount banner ever will.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="font-semibold text-gray-900">Create repeatable growth</p>
                <p className="mt-1 text-gray-600">Use Beezio to build a promotion engine that keeps sending traffic instead of one short-lived sale spike.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bzo-marketing-band rounded-3xl p-6 md:p-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">How Beezio works</p>
            <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">One business account with three connected ways to grow</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Influencers grow</p>
              <p className="mt-2 text-sm text-gray-700">Influencers refer new business accounts and receive the applicable lifetime bonus whenever those recruited sellers or affiliates make eligible sales.</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Affiliates promote</p>
              <p className="mt-2 text-sm text-gray-700">Affiliates choose marketplace products, add them to their branded storefront, and share tracked store or single-product promotions.</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Sellers fulfill</p>
              <p className="mt-2 text-sm text-gray-700">Sellers add products, choose affiliate terms, receive orders from storefront shoppers, and manage fulfillment and tracking.</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-gray-600">
            Shoppers enter through a seller or affiliate storefront or a tracked single-product promotion. Beezio provides the business tools and attribution behind that experience.
          </p>
        </section>

        <section className="bzo-marketing-band rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Influencer earnings</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900 md:text-3xl">Influencer attribution stays attached to the business account</h2>
          <p className="mt-3 text-sm text-gray-700 md:text-base">
            Share your influencer signup link with a business. When that account joins under your code, Beezio permanently records the relationship for its seller and affiliate activity and credits eligible future sales under the published payout rules.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Bring in sellers</p>
              <p className="mt-2 text-sm text-gray-700">A seller recruited under your code stays connected when products from that business sell.</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Bring in affiliates</p>
              <p className="mt-2 text-sm text-gray-700">An affiliate recruited under your code stays connected when that affiliate drives eligible sales.</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Track every result</p>
              <p className="mt-2 text-sm text-gray-700">See invite tools, recruited-account totals, held earnings, available payouts, and paid history in your dashboard.</p>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default HomePageBZO;
