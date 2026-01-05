import React, { useEffect } from 'react';
import PublicLayout from '../components/layout/PublicLayout';

interface AuthPageProps {
  mode: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode } }));
  }, [mode]);

  return (
    <PublicLayout>
      <div className="max-w-xl space-y-4 relative">
        <a
          href="/"
          className="absolute -top-2 right-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-amber-500 bg-white shadow-sm"
          aria-label="Close and go home"
        >
          <span className="text-xl leading-none">×</span>
        </a>
        <p className="text-sm font-semibold text-amber-700 uppercase tracking-[0.2em]">Account</p>
        <h1 className="text-3xl font-semibold text-gray-900">
          {mode === 'login' ? 'Log in to Beezio' : 'Create your Beezio account'}
        </h1>
        <p className="text-gray-700 leading-relaxed">
          Use the modal to {mode === 'login' ? 'sign in to' : 'join'} the marketplace. Sellers, affiliates, buyers, and fundraisers all share the same
          transparent checkout and payout system.
        </p>
      </div>
    </PublicLayout>
  );
};

export default AuthPage;
