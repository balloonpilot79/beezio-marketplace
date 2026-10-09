import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, QrCode, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import SingleProductPromoStudio from '../components/affiliate/SingleProductPromoStudio';

/** One product promotion hub for the unified seller + affiliate account. */
export default function PromoteProductToolsPage() {
  const { profile, user } = useAuth();
  const [params] = useSearchParams();
  const productId = String(params.get('product') || '').trim();
  const ownerId = String(profile?.id || user?.id || '').trim();

  return (
    <main className="min-h-screen bg-[#faf9f5] px-3 pb-16 pt-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link to="/business?tab=products" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to Business Center
        </Link>
        <div className="mb-5 mt-2 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm sm:p-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
            <QrCode className="h-6 w-6 text-amber-700" /> Product Sharing Toolkit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Pick a product from your store to create its tracked selling link, printable QR code, posts, messages, flyers, and share-ready copy. Your own products and the marketplace products you promote are both here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#101820] px-4 text-sm font-bold text-[#ffcb05]"><Link2 className="h-4 w-4" /> Find products</Link>
            <Link to="/store-builder" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"><Store className="h-4 w-4" /> Customize My Store</Link>
          </div>
        </div>
        <SingleProductPromoStudio products={[]} ownerId={ownerId} promoterRole="seller" title={productId ? 'Share this product' : 'Choose a product to promote'} />
      </div>
    </main>
  );
}
