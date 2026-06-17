import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeDollarSign, Megaphone, ShieldCheck, Store, Users } from 'lucide-react';
import PublicLayout from '../components/layout/PublicLayout';

export default function InfluencerRecruitPromoPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const recruitCode = String(code || searchParams.get('recruit') || '').trim();
  const [referrerName, setReferrerName] = useState('your Beezio contact');

  useEffect(() => {
    if (!recruitCode) return;
    let alive = true;
    fetch(`/api/public/recruit/resolve?code=${encodeURIComponent(recruitCode)}`)
      .then((res) => res.json())
      .then((payload) => {
        if (!alive) return;
        if (payload?.valid && payload?.referrerName) {
          setReferrerName(String(payload.referrerName));
        }
      })
      .catch(() => {
        // keep fallback
      });
    return () => {
      alive = false;
    };
  }, [recruitCode]);

  const links = useMemo(() => {
    const params = new URLSearchParams();
    if (recruitCode) params.set('recruit', recruitCode);
    const base = params.toString();
    return {
      influencer: recruitCode ? `/i/${encodeURIComponent(recruitCode)}` : '',
      business: `/signup${base ? `?${base}` : ''}`,
    };
  }, [recruitCode]);

  return (
    <PublicLayout>
      <div className="bg-white">
        <section className="border-b border-gray-200 bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                <Users className="w-4 h-4" />
                Invited by {referrerName}
              </div>
              <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-gray-950">
                Build on Beezio with a real seller or affiliate path from day one.
              </h1>
              <p className="mt-4 text-lg text-gray-700 max-w-2xl">
                Join through {referrerName} and step into one platform where sellers can launch a storefront and affiliates can start sharing products without piecing together a broken stack.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link
                  to={links.business}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Sign up now
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-emerald-900">Why people join</div>
                <p className="mt-1 text-sm text-gray-600">
                  Beezio gives one account access to storefront tools, affiliate sharing, recruiter growth, and payout tracking so the next step feels like building a business, not just creating another account.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex gap-4">
                  <div className="h-11 w-11 flex-none rounded-lg bg-amber-100 text-amber-800 grid place-items-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-950">Keep your growth connected</h2>
                    <p className="mt-1 text-sm text-gray-600">Joining through a trusted connection gives you a cleaner start and keeps the long-term relationship tied correctly from day one.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-11 w-11 flex-none rounded-lg bg-blue-100 text-blue-800 grid place-items-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-950">Sellers get a real storefront, not just a profile page</h2>
                    <p className="mt-1 text-sm text-gray-600">Launch a branded store with built-in cart and checkout so products can actually be sold in a way that looks professional.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-11 w-11 flex-none rounded-lg bg-emerald-100 text-emerald-800 grid place-items-center">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-950">Affiliates get tracked links and a cleaner way to promote</h2>
                    <p className="mt-1 text-sm text-gray-600">Share products people actually want, keep the tracking attached, and build income without needing inventory or fulfillment.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-11 w-11 flex-none rounded-lg bg-slate-100 text-slate-800 grid place-items-center">
                    <BadgeDollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-950">One platform gives both paths room to grow</h2>
                    <p className="mt-1 text-sm text-gray-600">Beezio is built so sellers can grow with promotion behind them and affiliates can grow with real stores behind their traffic.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
