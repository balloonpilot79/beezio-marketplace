import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ShoppingCart, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';

interface GlobalHeaderBarProps {
  onOpenAuth?: () => void;
  onOpenSignup?: () => void;
}

const GlobalHeaderBar: React.FC<GlobalHeaderBarProps> = ({ onOpenAuth, onOpenSignup }) => {
  const { user, profile, signOut } = useAuth();
  const { getTotalItems } = useCart();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Stores', href: '/stores' },
    { label: 'Fundraisers', href: '/fundraisers' },
    { label: 'Affiliates', href: '/affiliates' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

  const itemCount = getTotalItems();

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut?.();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-black/20 bg-[#ffcb05] text-black shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-black text-[#ffcb05] font-black flex items-center justify-center shadow-sm">
              BZ
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold uppercase tracking-wide">Beezio</span>
              <span className="text-xs text-black/70">Marketplace</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-semibold">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} className="hover:text-black/70">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="md:hidden inline-flex items-center justify-center rounded-full bg-white text-black border border-black/10 p-2 shadow hover:bg-white/90"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link
            to="/cart"
            className="relative inline-flex items-center justify-center rounded-full bg-white text-black border border-black/10 px-3 py-1.5 text-sm font-semibold shadow hover:bg-white/90"
          >
            <ShoppingCart className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Cart
            {itemCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black text-[#ffcb05] text-xs px-1">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="inline-flex items-center gap-2 bg-white text-black border border-black/10 px-3 py-1.5 rounded-full font-semibold shadow hover:bg-white/90"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {profile?.full_name || user.email?.split('@')[0] || 'Account'}
                </span>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-black border border-black/10 rounded-lg shadow-lg py-2 text-sm">
                  <div className="px-3 py-2 border-b border-black/10">
                    <div className="font-semibold text-gray-900">{profile?.full_name || 'User'}</div>
                    <div className="text-xs text-gray-600">{profile?.email || user.email}</div>
                  </div>
                  <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black">
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Dashboard
                  </Link>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black">
                    <User className="w-4 h-4" aria-hidden="true" /> Profile & Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => (onOpenAuth ? onOpenAuth() : navigate('/auth/login'))}
                className="inline-flex items-center gap-2 bg-white text-black border border-black/10 px-4 py-1.5 rounded-full font-semibold shadow hover:bg-white/90"
              >
                <User className="w-4 h-4" aria-hidden="true" />
                Sign in
              </button>
              <button
                onClick={() => (onOpenSignup ? onOpenSignup() : navigate('/signup'))}
                className="inline-flex items-center gap-2 bg-black text-[#ffcb05] border border-black/10 px-4 py-1.5 rounded-full font-semibold shadow hover:bg-black/90"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#ffe459] text-black border-t border-black/10 shadow-sm">
          <nav className="px-4 py-3 grid gap-2 font-semibold text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="py-2 px-3 rounded-lg hover:bg-[#ffcb05] hover:text-black"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <div className="pt-2 mt-1 border-t border-black/10 grid gap-2">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (onOpenAuth) onOpenAuth();
                    else navigate('/auth/login');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white text-black border border-black/10 px-4 py-2 rounded-lg font-semibold shadow hover:bg-white/90"
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (onOpenSignup) onOpenSignup();
                    else navigate('/signup');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-black text-[#ffcb05] border border-black/10 px-4 py-2 rounded-lg font-semibold shadow hover:bg-black/90"
                >
                  Sign up
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default GlobalHeaderBar;
