import React from 'react';
import { Link } from 'react-router-dom';

interface PublicLayoutProps {
  children: React.ReactNode;
  onOpenAuthModal?: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  className?: string;
  contentClassName?: string;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children, className, contentClassName }) => {
  const shellClassName = className ? `min-h-screen ${className}` : 'min-h-screen bg-white text-gray-900';
  const mainClassName = ['max-w-6xl mx-auto px-4 py-10', contentClassName].filter(Boolean).join(' ');

  return (
    <div className={shellClassName}>
      <main className={mainClassName}>{children}</main>
      <footer className="border-t border-gray-200 bg-gradient-to-r from-white via-amber-50 to-orange-50">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-amber-100 bg-white/80 px-6 py-8 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-600">Beezio</p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">Ready to build your Beezio storefront?</h2>
                <p className="mt-2 text-sm text-gray-700">
                  One free business account includes seller, affiliate, influencer, storefront, promotion, and payout tools.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-sm hover:bg-amber-600 transition-colors"
                >
                  Create Your Business Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
