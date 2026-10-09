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
        <InfluencerDashboard />
      </div>
    </main>
  );
}
