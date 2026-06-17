import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import AuthModal from '../components/AuthModal';
import StorefrontBuyerShell from '../components/storefront/StorefrontBuyerShell';
import { loadStorefrontBranding, readPostAuthPath, readStoredStorefrontScope, setPostAuthPath, type StorefrontBranding } from '../utils/storefrontScope';

interface StorefrontAuthPageProps {
  mode: 'login' | 'register';
}

const fallbackBranding: StorefrontBranding = {
  kind: 'generic',
  name: 'Your Account',
  tagline: 'Use one buyer account across every storefront.',
  logoUrl: null,
  backgroundImageUrl: null,
  homePath: '/',
};

const buyerBenefits = [
  'One customer account that works across every Beezio storefront.',
  'Orders, receipts, and support history stored in one place.',
  'Email confirmation before first sign-in for verified checkout access.',
];

const StorefrontAuthPage: React.FC<StorefrontAuthPageProps> = ({ mode }) => {
  const { user } = useAuth();
  const [branding, setBranding] = useState<StorefrontBranding>(fallbackBranding);
  const location = useLocation();
  const navigate = useNavigate();
  const [postAuthTarget, setPostAuthTarget] = useState<string>(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return String(params.get('next') || '').trim() || readPostAuthPath() || '/account';
  });

  useEffect(() => {
    const scope = readStoredStorefrontScope();
    const params = new URLSearchParams(location.search);
    const nextTarget = String(params.get('next') || '').trim() || readPostAuthPath() || '/account';
    loadStorefrontBranding(scope).then((next) => setBranding(next));
    setPostAuthTarget(nextTarget);
    setPostAuthPath(nextTarget);
  }, [mode, location.search]);

  if (user) {
    return <Navigate to={postAuthTarget || '/account'} replace />;
  }

  return (
    <StorefrontBuyerShell branding={branding}>
      <AuthModal
        isOpen={true}
        mode={mode}
        audience="buyer"
        onClose={() => navigate(branding.homePath, { replace: true })}
      />
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Buyer Account</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          {mode === 'login' ? 'Customer login' : 'Create your customer account'}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          One customer account works across every storefront. Your orders, receipts, and support history stay in one place.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">What You Get</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {buyerBenefits.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode, audience: 'buyer' } }))}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {mode === 'login' ? 'Open Customer Login' : 'Open Customer Sign Up'}
          </button>
          <Link
            to={`${mode === 'login' ? '/account/signup' : '/account/login'}?next=${encodeURIComponent(postAuthTarget || '/account')}`}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {mode === 'login' ? 'Create Account' : 'Customer Login'}
          </Link>
          <Link
            to={branding.homePath}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Store
          </Link>
        </div>
      </div>
    </StorefrontBuyerShell>
  );
};

export default StorefrontAuthPage;
