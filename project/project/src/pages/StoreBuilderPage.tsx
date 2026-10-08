import React from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Megaphone, PackagePlus, Store, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StoreCustomization from '../components/StoreCustomization';
import AffiliateStoreCustomization from '../components/AffiliateStoreCustomization';

/**
 * A dedicated, mobile-friendly entry point for Beezio's existing editors.
 * Keep storefront rendering separate: this page only changes the private builder.
 */
const StoreBuilderPage: React.FC = () => {
  const { user, profile, userRoles, loading } = useAuth();
  const [params] = useSearchParams();
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
  const isAdmin = roles.has('admin');
  const canBuildSeller = isAdmin || roles.has('seller');
  const canBuildAffiliate = isAdmin || roles.has('affiliate') || roles.has('partner');
  if (!canBuildSeller && !canBuildAffiliate) {
    return <Navigate to="/business" replace />;
  }

  const requested = params.get('type') === 'affiliate' ? 'affiliate' : 'seller';
  const editor = requested === 'affiliate' && canBuildAffiliate
    ? 'affiliate'
    : canBuildSeller ? 'seller' : 'affiliate';
  const ownerId = String(profile?.id || user.id);
  const previewHref = editor === 'seller'
    ? `/store/id/${encodeURIComponent(ownerId)}`
    : `/partner/${encodeURIComponent(ownerId)}`;

  return (
    <div className="min-h-screen bg-[#faf9f5] pb-16">
      <div className="mx-auto max-w-6xl px-3 pt-5 sm:px-6 lg:px-8">
        <Link to="/business" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to Business Center
        </Link>
        <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Your free Beezio website</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
            <Wand2 className="h-6 w-6 text-amber-600" /> Build My Store
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Pick a design, add a logo, organize products, create pages and save your changes. Your public mobile store keeps its familiar shopping layout.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canBuildSeller && (
              <Link to="/store-builder?type=seller" aria-current={editor === 'seller' ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${editor === 'seller' ? 'bg-[#101820] text-[#ffcb05]' : 'border border-slate-300 bg-white text-slate-800'}`}>
                <Store className="h-4 w-4" /> Seller website
              </Link>
            )}
            {canBuildAffiliate && (
              <Link to="/store-builder?type=affiliate" aria-current={editor === 'affiliate' ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${editor === 'affiliate' ? 'bg-[#101820] text-[#ffcb05]' : 'border border-slate-300 bg-white text-slate-800'}`}>
                <Store className="h-4 w-4" /> Affiliate website
              </Link>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link to={editor === 'seller' ? '/business/products/add' : '/marketplace'}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#ffcb05] px-3 py-3 text-sm font-bold text-[#101820]">
              <PackagePlus className="h-4 w-4" /> {editor === 'seller' ? 'Add my product' : 'Add marketplace products'}
            </Link>
            <Link to={previewHref} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-800">
              <ExternalLink className="h-4 w-4" /> View live store
            </Link>
            <Link to="/business?tab=influencer-promo"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-800">
              <Megaphone className="h-4 w-4" /> Invite & share
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Products you create are assigned to your seller store. Marketplace products you choose to promote appear in your affiliate store after they are successfully saved.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-2 pt-4 sm:px-6 lg:px-8">
        {editor === 'affiliate'
          ? <AffiliateStoreCustomization affiliateId={ownerId} />
          : <StoreCustomization userId={ownerId} role="seller" />}
      </div>
    </div>
  );
};

export default StoreBuilderPage;
