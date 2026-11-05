import { Link } from 'react-router-dom';
import { ArrowRight, Share2, Users, Wallet, ShieldCheck } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';
import { useAuth } from '../contexts/AuthContextMultiRole';

const steps = [
  { icon: Users, title: 'Join free', text: 'Create your Beezio account. No inventory purchase or membership fee is required to participate as an influencer.' },
  { icon: Share2, title: 'Invite sellers and affiliates', text: 'Use your tracked referral link to introduce people who want to sell products or promote stores.' },
  { icon: Wallet, title: 'Earn from qualifying sales', text: 'When eligible referred accounts generate qualifying sales, you may receive influencer earnings under the program terms.' },
];

export default function InfluencerNetworkPage() {
  const { user } = useAuth();
  return (
    <PublicLayout>
      <main className="mx-auto max-w-6xl px-3 pb-16 pt-8 sm:px-6">
        <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-12 sm:py-16">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-amber-300">Beezio Influencer Network</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">You bring the people. They make the sales. You earn.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">Introduce sellers and affiliates to Beezio. Earn from their qualifying sales while the accounts, referrals and program remain eligible.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-400 px-6 font-bold text-slate-950 hover:bg-amber-300" to={user ? '/business/invites' : '/signup'}>{user ? 'Get your referral link' : 'Join Beezio free'}<ArrowRight className="h-5 w-5" /></Link>
            <Link className="inline-flex min-h-12 items-center rounded-xl border border-slate-400 px-6 font-semibold text-white hover:bg-slate-800" to="/legal/influencer-terms">Read influencer terms</Link>
          </div>
          <p className="mt-5 text-sm text-slate-300">No guaranteed earnings. Bonuses depend on actual qualifying sales, not signups alone.</p>
        </section>
        <section className="py-12">
          <h2 className="text-3xl font-bold text-slate-950">How it works</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="h-8 w-8 text-amber-600" /><h3 className="mt-4 text-xl font-bold text-slate-950">{title}</h3><p className="mt-3 leading-7 text-slate-700">{text}</p></article>)}
          </div>
        </section>
        <section className="rounded-2xl bg-amber-50 p-7 sm:p-10">
          <h2 className="text-2xl font-bold text-slate-950">Affiliate or influencer?</h2>
          <p className="mt-4 text-lg text-slate-800"><strong>Affiliates</strong> promote products and earn on eligible product sales. <strong>Influencers</strong> introduce sellers and affiliates and may earn on qualifying sales attributed to those referrals.</p>
          <p className="mt-3 text-slate-700">You can participate in more than one role when eligible. Influencers do not have to stock a product catalog to invite people.</p>
        </section>
        <section className="py-12">
          <h2 className="text-2xl font-bold text-slate-950">Your first 72 hours</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            <li className="rounded-xl border p-5"><strong>Day 1</strong><p className="mt-2 text-slate-700">Get your referral link and choose a message from your sharing tools.</p></li>
            <li className="rounded-xl border p-5"><strong>Day 2</strong><p className="mt-2 text-slate-700">Share with people who may genuinely benefit, following each community's rules.</p></li>
            <li className="rounded-xl border p-5"><strong>Day 3</strong><p className="mt-2 text-slate-700">Check your referral activity and try another helpful post or personal invitation.</p></li>
          </ol>
          <Link to={user ? '/business/invites' : '/signup'} className="mt-7 inline-flex min-h-11 items-center gap-2 font-bold text-amber-800">{user ? 'Open your sharing tools' : 'Create your free account'}<ArrowRight className="h-4 w-4" /></Link>
        </section>
        <p className="flex items-start gap-2 border-t pt-6 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-1 h-5 w-5 shrink-0" />Influencers must clearly disclose their financial relationship when promoting Beezio. Eligibility, refunds, disputes, and payouts are governed by the <Link className="font-semibold underline" to="/legal/influencer-terms">Influencer Terms</Link>.</p>
      </main>
    </PublicLayout>
  );
}
