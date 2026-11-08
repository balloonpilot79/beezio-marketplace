import React, { useMemo } from 'react';
import { ArrowRight, Briefcase, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StorefrontBuyerAccountPage from './StorefrontBuyerAccountPage';
import { getNormalizedAccountRoles, hasBusinessAccountAccess } from '../utils/accountRoles';
import { canAccessCJImport } from '../utils/cjImportAccess';

const AccountHubPage: React.FC = () => {
  const { user, profile, userRoles, loading } = useAuth();
  const location = useLocation();
  const roles = useMemo(
    () => getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role),
    [profile?.primary_role, profile?.role, userRoles],
  );
  const hasBusiness = hasBusinessAccountAccess(roles)
    || roles.includes('admin')
    || canAccessCJImport(user?.email || profile?.email || '');

  // Existing order/support links keep opening the requested My Purchases tab.
  if (new URLSearchParams(location.search).has('tab')) {
    return <StorefrontBuyerAccountPage />;
  }

  if (loading) {
    return <p role="status" className="p-10 text-center text-slate-600">Loading your account…</p>;
  }

  if (!user || !hasBusiness) return <StorefrontBuyerAccountPage />;

  return (
    <main className="min-h-screen bg-[#faf9f5] px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Beezio Account Center</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your Beezio account</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Use this business login to sell, promote, refer, and shop.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">My Purchases</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your personal purchases, receipts, shipping status, returns, saved products, and order support.
            </p>
            <Link
              to="/account?tab=overview"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Open My Purchases <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="rounded-3xl border border-amber-300 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
              <Briefcase className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Business Account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Seller sales, affiliate sales, influencer commissions, customer order history, available earnings, next payout, and full payout history.
            </p>

            <Link
              to="/business"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
            >
              Open Business Center <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
};

export default AccountHubPage;
