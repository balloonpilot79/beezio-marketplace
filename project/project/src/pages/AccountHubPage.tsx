import React, { useMemo, useState } from 'react';
import { ArrowRight, Briefcase, CheckCircle2, ShoppingBag, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import StorefrontBuyerAccountPage from './StorefrontBuyerAccountPage';
import { getNormalizedAccountRoles, hasBusinessAccountAccess } from '../utils/accountRoles';
import { canAccessCJImport } from '../utils/cjImportAccess';

const AccountHubPage: React.FC = () => {
  const { user, profile, userRoles, addRole, refreshProfile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

  const roles = useMemo(
    () => getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role),
    [profile?.primary_role, profile?.role, userRoles],
  );
  const hasBusiness = hasBusinessAccountAccess(roles)
    || roles.includes('admin')
    || canAccessCJImport(user?.email || profile?.email || '');

  // Existing order/support links keep opening the requested Buyer Account tab.
  if (new URLSearchParams(location.search).has('tab')) {
    return <StorefrontBuyerAccountPage />;
  }

  if (loading) {
    return <p role="status" className="p-10 text-center text-slate-600">Loading your account…</p>;
  }

  if (!user) return <StorefrontBuyerAccountPage />;

  const mergeBusinessAccount = async () => {
    setUpgrading(true);
    setError('');
    try {
      const fullName = String(
        profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Beezio Business',
      ).trim();
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          email: user.email,
          full_name: fullName,
          role: 'seller',
          primary_role: 'seller',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (profileError) throw profileError;

      // Influencer access intentionally grants the combined seller, affiliate,
      // and influencer business account while preserving the same user ID.
      const added = await addRole('influencer');
      if (!added) throw new Error('Business access could not be added to this account.');

      await refreshProfile();
      navigate('/onboarding', { replace: true });
    } catch (upgradeError: any) {
      setError(String(upgradeError?.message || 'Could not add Business Account. Please try again.'));
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f5] px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Beezio Account Center</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Choose where you want to go</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Buyer activity and business earnings stay separate on screen while remaining connected to one secure login.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Buyer Account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your personal purchases, receipts, shipping status, returns, saved products, and order support.
            </p>
            <Link
              to="/account?tab=overview"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Open Buyer Account <ArrowRight className="h-4 w-4" />
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

            {hasBusiness ? (
              <Link
                to="/business"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Open Business Center <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6">
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-5 w-5 flex-none text-amber-400" />
                    <div>
                      <p className="font-bold">Add and merge a Business Account</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        Keep this login and all buyer history. Beezio will add seller, affiliate, and influencer tools to the same account.
                      </p>
                    </div>
                  </div>
                </div>
                {error && <p className="mt-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}
                <button
                  type="button"
                  onClick={mergeBusinessAccount}
                  disabled={upgrading}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {upgrading ? 'Adding Business Account…' : 'Add Business Account'}
                  {!upgrading && <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default AccountHubPage;
