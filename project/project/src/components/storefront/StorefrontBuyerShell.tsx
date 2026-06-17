import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LifeBuoy, LogOut, Package, ShoppingBag, UserCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextMultiRole';
import type { StorefrontBranding } from '../../utils/storefrontScope';

interface StorefrontBuyerShellProps {
  branding: StorefrontBranding;
  children: React.ReactNode;
}

const StorefrontBuyerShell: React.FC<StorefrontBuyerShellProps> = ({ branding, children }) => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOrdersPage = String(new URLSearchParams(location.search).get('tab') || '').toLowerCase() === 'orders';
  const shellBackground = String(branding.backgroundImageUrl || '').trim();
  const signedInLabel =
    String(profile?.full_name || '').trim() ||
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim() ||
    user?.email ||
    'Customer';

  const handleSignOut = async () => {
    await signOut();
    navigate(branding.homePath || '/', { replace: true });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: shellBackground
          ? `linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.96)), url(${shellBackground})`
          : 'radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 24%), radial-gradient(circle at top right, rgba(14,165,233,0.12), transparent 20%), linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        backgroundSize: shellBackground ? 'cover' : undefined,
        backgroundPosition: shellBackground ? 'center' : undefined,
      }}
    >
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to={branding.homePath} className="flex items-center gap-3 text-slate-900">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={`${branding.name} logo`} className="h-10 w-10 rounded-xl border border-slate-200 object-cover bg-white" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                {branding.name.charAt(0)}
              </span>
            )}
            <div className="leading-tight">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-400">Customer</div>
              <div className="text-lg font-semibold text-slate-900">{branding.name}</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link to={branding.homePath} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <ShoppingBag className="h-4 w-4" />
              Shop
            </Link>
            <Link
              to="/account?tab=orders"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                isOrdersPage ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Package className="h-4 w-4" />
              Customer Orders
            </Link>
            <Link
              to="/account"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                !isOrdersPage ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserCircle className="h-4 w-4" />
              Customer Account
            </Link>
            {!user ? (
              <>
                <Link to="/account/login" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Customer Login
                </Link>
                <Link to="/account/signup" className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-500">
                  Create Account
                </Link>
              </>
            ) : (
              <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                <div className="flex min-w-0 items-center gap-2 px-1">
                  <UserCircle className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-xs font-semibold text-slate-900">{signedInLabel}</div>
                    {user.email && signedInLabel !== user.email ? (
                      <div className="truncate text-[0.68rem] text-slate-500">{user.email}</div>
                    ) : (
                      <div className="text-[0.68rem] text-slate-500">Signed in</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            )}
            <Link to="/account?tab=support" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <LifeBuoy className="h-4 w-4" />
              Support
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default StorefrontBuyerShell;
