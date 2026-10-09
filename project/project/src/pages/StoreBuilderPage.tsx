import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Megaphone, PackagePlus, Store, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StoreCustomization from '../components/StoreCustomization';

/**
 * One account, one member website: seller merchandise and marketplace picks
 * are simply two sources for the same storefront, not two store identities.
 * Dedicated admin brand storefronts remain independent.
 */
const StoreBuilderPage: React.FC = () => {
  const { user, profile, userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading && !user) {
    return <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-600">Loading your website builder...</div>;
  }
  if (!user) {
    return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  const roles = new Set(
    [...(userRoles || []), profile?.primary_role, profile?.role]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
  );
  const canBuild = roles.has('admin') || roles.has('seller') || roles.has('affiliate') || roles.has('partner');
  if (!canBuild) return <Navigate to="/account" replace />;

  const ownerId = String(profile?.id || user.id);
  const previewHref = `/store/id/${encodeURIComponent(ownerId)}`;

  return (
    <div className="min-h-screen bg-[#faf9f5] pb-16">
      <div className="mx-auto max-w-6xl px-3 pt-5 sm:px-6 lg:px-8">
        <Link to="/business" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to Business Center
        </Link>
        <div className="mt-3 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Your free Beezio website</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
            <Wand2 className="h-6 w-6 text-amber-600" /> Customize My Store
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            One website for everything you sell. Choose your design once, add your own products, and include products you promote from the Beezio marketplace.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link to="/business/products/add"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ffcb05] px-3 py-3 text-sm font-bold text-[#101820]">
              <PackagePlus className="h-4 w-4" /> Sell My Own Product
            </Link>
            <Link to="/marketplace"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-3 text-sm font-bold text-slate-800">
              <PackagePlus className="h-4 w-4" /> Add Affiliate Products
            </Link>
            <Link to={previewHref} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-800">
              <ExternalLink className="h-4 w-4" /> View My Store
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-2xl text-xs leading-5 text-slate-600">
              All products appear in the same store. Shoppers can see the original seller of each item; payouts still follow the correct seller and affiliate.
            </p>
            <Link to="/business/invites" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-700">
              <Megaphone className="h-4 w-4" /> Influencer sharing tools
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-2 pt-4 sm:px-6 lg:px-8">
        <StoreCustomization userId={ownerId} role="seller" />
      </div>
    </div>
  );
};

export default StoreBuilderPage;
