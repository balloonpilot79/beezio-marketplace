import React from 'react';
import { Link as LinkIcon, Sparkles, Target, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  'Browse every product with upfront commission info.',
  'Generate your personal affiliate or storefront link.',
  'Share it anywhere—social, email, SMS, QR, or a custom domain.',
  'Get paid exactly what you were promised on every sale.',
];

const dashboardHighlights = [
  'Leaderboard + rankings',
  'Commission + payout tracking',
  'Campaign + storefront builder',
  'Performance analytics',
  'Referral overrides (5% lifetime)',
  'Messaging + seller access',
];

const trustSignals = [
  {
    title: 'Transparent payouts',
    detail:
      'Every commission, referral override, and bonus is calculated before you promote. No hidden math, no clawbacks.',
    icon: '💰',
  },
  {
    title: 'Storefront + link freedom',
    detail:
      'Spin up a Beezio storefront, use our QR/link tools, or connect a custom domain. All inventory is pre-approved for affiliates.',
    icon: '🛍️',
  },
  {
    title: 'Seller + fundraiser access',
    detail:
      'Chat directly with sellers, swap assets, and request custom drops. Fundraiser campaigns give you more story-driven launches.',
    icon: '🤝',
  },
  {
    title: 'Referral stacking',
    detail:
      'Invite other affiliates and collect 5% of Beezio’s platform fee on their sales forever. No caps and no minimums.',
    icon: '🔁',
  },
];

const proTips = [
  {
    title: 'Build a tight niche',
    detail:
      'Curate products you truly care about. Authentic stores convert up to 3x higher because audiences feel the curation.',
  },
  {
    title: 'Automate your promos',
    detail:
      'Use the built-in share buttons, QR codes, and scheduled drops so every product push feels intentional (not spammy).',
  },
  {
    title: 'Watch the dashboards',
    detail:
      'Check the live analytics for conversion, busiest hours, and best sellers. Adjust links in minutes and keep momentum.',
  },
  {
    title: 'Recruit other affiliates',
    detail:
      'Refer fellow promoters and earn 5% of Beezio’s platform fee from their sales forever. It’s the easiest second stream.',
  },
];

const AffiliatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <section className="border-b border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5b00]">Affiliates</p>
            <h1 className="text-4xl md:text-5xl font-bold text-[#101820]">Keep more of every promotion</h1>
            <p className="text-lg md:text-xl text-gray-600">
              Curate the Beezio catalog, run your own storefront, or just share links. Sellers still keep 100% of their ask,
              referral partners get 5%, and you get full commissions with no confusing math.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link
                to="/affiliate/signup"
                className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000] transition-colors"
              >
                Start as an affiliate
              </Link>
              <Link
                to="/affiliate-dashboard-preview"
                className="inline-flex items-center justify-center px-8 py-3 rounded-full border border-black text-black font-semibold hover:bg-black hover:text-[#ffcb05] transition-colors"
              >
                Preview the dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5b00]">How it works</p>
            <h2 className="text-3xl font-bold text-[#101820]">Simple steps. Transparent payouts.</h2>
            <p className="text-lg text-gray-600">
              Everything you need to go from zero to live commissions is pre-built. No merchant accounts, no sneaky fees, and no
              need to manage shipments.
            </p>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#ffcb05] text-black font-semibold flex items-center justify-center">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <p className="text-gray-800">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-black/10 rounded-2xl shadow-lg p-8 space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fff4c1] text-[#5a4300] text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              Built for speed
            </div>
            <h3 className="text-2xl font-bold text-[#101820]">Your affiliate HQ</h3>
            <p className="text-gray-600">
              The dashboard mirrors a pro marketing stack: store builder, live link tracking, referral splits, and direct access
              to sellers and fundraisers who want traffic.
            </p>
            <ul className="space-y-3">
              {dashboardHighlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#101820]" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/affiliate-dashboard-preview"
              className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg bg-[#101820] text-[#ffcb05] font-semibold hover:bg-black transition-colors"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Open the live preview
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f7f7f7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5b00]">Why affiliates trust us</p>
            <h2 className="text-3xl font-bold text-[#101820] mb-6">Real safeguards instead of hype</h2>
            <div className="space-y-5">
              {trustSignals.map((signal) => (
                <div key={signal.title} className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#fff4c1] text-[#5a4300] text-2xl flex items-center justify-center">
                      {signal.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#101820]">{signal.title}</h3>
                      <p className="text-gray-700 mt-2">{signal.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-white border border-dashed border-black/20 p-5 text-sm text-gray-700">
              <p className="font-semibold text-[#101820] mb-1">No falsified leaderboards</p>
              <p>
                We’ll surface community earnings and case studies once there’s verifiable volume. Until then, you get honest
                tooling and day-one transparency.
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7a5b00]">Playbook</p>
            <h2 className="text-3xl font-bold text-[#101820] mb-6">Tips from the top performers</h2>
            <div className="space-y-5">
              {proTips.map((tip) => (
                <div key={tip.title} className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-[#101820]" />
                    <h3 className="text-lg font-semibold text-[#101820]">{tip.title}</h3>
                  </div>
                  <p className="text-gray-700 mt-3">{tip.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 rounded-2xl bg-[#101820] text-[#ffcb05] space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em]">
                <Users className="w-4 h-4" />
                Community
              </div>
              <p className="text-xl font-bold">10,000+ affiliates and referring partners</p>
              <p className="text-sm text-[#ffcb05]/80">
                Every new teammate who joins with your link earns you 5% of Beezio’s platform fee on every sale they touch. No caps.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center bg-white border border-black/10 rounded-3xl shadow-lg p-10">
          <h2 className="text-3xl font-bold text-[#101820]">Ready to start your affiliate journey?</h2>
          <p className="text-lg text-gray-600 mt-4">
            Join a marketplace that protects sellers, pays affiliates first, and bakes every fee into the final price so customers
            know exactly what they’re supporting.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/affiliate/signup"
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000] transition-colors"
            >
              Join as affiliate — free
            </Link>
            <Link
              to="/affiliate-dashboard-preview"
              className="inline-flex items-center justify-center px-8 py-3 rounded-full border border-black text-black font-semibold hover:bg-black hover:text-[#ffcb05] transition-colors"
            >
              See the dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AffiliatePage;

