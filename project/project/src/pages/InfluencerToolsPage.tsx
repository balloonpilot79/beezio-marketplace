import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Megaphone, ShieldCheck, ShoppingBag } from 'lucide-react';
import InfluencerDashboard from '../components/InfluencerDashboard';

export default function InfluencerToolsPage() {
  return (
    <main className="min-h-screen bg-[#faf9f5] px-3 pb-16 pt-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link to="/business" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to Business Center
        </Link>
        <div className="mt-2 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Your Beezio network</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
            <Megaphone className="h-6 w-6 text-amber-700" /> Influencer Sharing Tools
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Invite people to start selling or promoting products through your tracked link. Share your invite and QR code, use ready-made messages, and see which accounts joined through you.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> No earnings just for signup; rewards come from qualifying sales</span>
            <Link to="/business/promote" className="inline-flex min-h-11 items-center gap-1 font-bold text-amber-800"><ShoppingBag className="h-4 w-4" /> Product promotion tools</Link>
          </div>
        </div>
        <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-bold text-slate-950">Your first 72 hours: sharing kit</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Use your personal tracked influencer link from the dashboard above. Replace [YOUR REFERRAL LINK] before posting. Only share in communities that permit promotions.</p>
          <div className="mt-4 rounded-xl bg-amber-50 p-4">
            <h3 className="font-bold text-slate-900">Day 1: Your first post</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{'Looking for a free way to start building an online income opportunity?\\n\\nBeezio lets sellers open online stores and affiliates promote products. As an influencer, I can also introduce sellers and affiliates and potentially earn from their qualifying sales. No inventory purchase is required for influencer participation. Earnings are not guaranteed.\\n\\nI may earn compensation from eligible referrals. Learn more: [YOUR REFERRAL LINK]'}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4"><h3 className="font-bold">Day 2: Personal invitation</h3><p className="mt-2 text-sm leading-6 text-slate-700">Know someone selling products or exploring a side hustle? Invite them personally, explain the difference between seller and affiliate roles, and include your tracked link and compensation disclosure.</p></div>
            <div className="rounded-xl border p-4"><h3 className="font-bold">Day 3: Follow up</h3><p className="mt-2 text-sm leading-6 text-slate-700">Check your referral activity in the dashboard, answer questions from interested people, and try a second helpful post. Do not promise income or mass-message strangers.</p></div>
          </div>
          <Link to="/influencers" className="mt-5 inline-flex min-h-11 items-center font-bold text-amber-800">View the public influencer program page</Link>
        </section>
        <InfluencerDashboard />
      </div>
    </main>
  );
}
