import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../ui/Button';

interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

const navLinks = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/dashboard/products', label: 'My products' },
  { to: '/dashboard/orders', label: 'Orders' },
  { to: '/dashboard/earnings', label: 'Earnings' },
  { to: '/dashboard/affiliates', label: 'Affiliate / Fundraisers' },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, subtitle, children }) => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bz-bg text-bz-text">
      <header className="border-b border-bz-border/60 bg-bz-surface">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bz-primary text-black font-black">
              BZ
            </span>
            <span>Beezio Dashboard</span>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setMenuOpen((prev) => !prev)} className="md:hidden">
            Menu
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside
          className={[
            'bg-bz-surface border border-bz-border rounded-bzo-card p-4',
            'md:block',
            menuOpen ? 'block' : 'hidden',
          ].join(' ')}
        >
          <nav className="space-y-2">
            {navLinks.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={[
                    'block rounded-lg px-3 py-2 text-sm font-medium',
                    active
                      ? 'bg-bz-primary/15 text-bz-text border border-bz-primary/30'
                      : 'text-bz-muted hover:text-bz-text hover:bg-bz-surfaceAlt',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="space-y-4">
          {(title || subtitle) && (
            <div className="flex flex-col gap-1">
              {title && <h1 className="text-2xl md:text-3xl font-semibold text-bz-text">{title}</h1>}
              {subtitle && <p className="text-sm text-bz-muted">{subtitle}</p>}
            </div>
          )}
          <div>{children}</div>
        </section>
      </div>
    </div>
  );
};

export default DashboardLayout;
