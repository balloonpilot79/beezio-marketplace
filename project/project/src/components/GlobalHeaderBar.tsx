import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  DollarSign,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  Store,
  User,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import { canAccessCJImport } from '../utils/cjImportAccess';

interface GlobalHeaderBarProps {
  onOpenAuth?: () => void;
  onOpenSignup?: () => void;
}

const GlobalHeaderBar: React.FC<GlobalHeaderBarProps> = ({ onOpenAuth, onOpenSignup }) => {
  const { user, profile, userRoles, hasRole, signOut } = useAuth();
  const { getTotalItems } = useCart();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const normalizedRole = String(profile?.primary_role || profile?.role || '').toLowerCase();
  const isAdminUser = Boolean(
    normalizedRole === 'admin' ||
    userRoles?.some((role) => String(role || '').toLowerCase() === 'admin') ||
    hasRole?.('admin') ||
    canAccessCJImport(user?.email || profile?.email || '')
  );

  const navLinks = [
    { label: 'Home', href: '/', description: 'Start here' },
    { label: 'Product Marketplace', href: '/marketplace', description: 'Find products to add to your storefront and promote' },
    { label: 'How It Works', href: '/how-it-works', description: 'See how selling, partner payouts, and checkout work' },
    ...(user
      ? [{ label: 'Dashboard', href: '/dashboard', description: 'Manage products, orders, payouts, and store setup' }]
      : [])
  ];
  const leftNavLinks = navLinks.filter((link) => link.label === 'Home');
  const centerNavLinks = navLinks.filter((link) => link.label !== 'Home');

  const payoutsShortcutHref = useMemo(() => {
    if (!user) return null;
    return '/dashboard?tab=financials#payouts';
  }, [user]);

  const itemCount = getTotalItems();
  const mobilePrimaryActions = user
    ? [
        { label: 'Home', href: '/', icon: Home },
        { label: 'Market', href: '/marketplace', icon: Store },
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Cart', href: '/cart', icon: ShoppingCart },
      ]
    : [
        { label: 'Home', href: '/', icon: Home },
        { label: 'Market', href: '/marketplace', icon: Store },
        { label: 'How', href: '/how-it-works', icon: Users },
        { label: 'Sign in', href: '/auth/login', icon: User },
      ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent | PointerEvent) => {
      if (accountOpen && accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    };

    const handleScroll = () => {
      setAccountOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [accountOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut?.();
    navigate('/');
  };

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[70] pointer-events-none">
        <header className="pointer-events-auto w-full border-b border-black/20 bg-[#ffcb05] text-black shadow-md">
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 lg:gap-3">
              <Link to="/" className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black text-[#ffcb05] text-sm sm:text-base font-black flex items-center justify-center shadow-sm">
                  BZ
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] sm:text-sm font-semibold uppercase tracking-wide">Beezio</span>
                  <span className="text-[10px] sm:text-xs text-black/70">Business Platform</span>
                </div>
              </Link>

              <nav className="hidden xl:flex items-center gap-3 text-sm font-semibold">
                {leftNavLinks.map((link) => (
                  <Link key={link.href} to={link.href} className="hover:text-black/70 whitespace-nowrap" title={link.description}>
                    {link.label}
                  </Link>
                ))}
                {centerNavLinks.map((link) => (
                  <Link key={link.href} to={link.href} className="hover:text-black/70 whitespace-nowrap" title={link.description}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="xl:hidden inline-flex items-center justify-center rounded-full bg-white text-black border border-black/10 p-2 shadow hover:bg-white/90"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {user && payoutsShortcutHref && (
                <button
                  type="button"
                  onClick={() => navigate(payoutsShortcutHref)}
                  className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[#101820] bg-white px-3 py-1.5 text-xs font-semibold text-[#101820] hover:bg-[#fff2b7]"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Payouts
                </button>
              )}

              {user && (
                <Link
                  to="/cart"
                  className="relative inline-flex items-center justify-center rounded-full bg-white text-black border border-black/10 px-3 py-1.5 text-sm font-semibold shadow hover:bg-white/90"
                >
                  <ShoppingCart className="w-4 h-4 sm:mr-1.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Cart</span>
                  {itemCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black text-[#ffcb05] text-xs px-1">
                      {itemCount}
                    </span>
                  )}
                </Link>
              )}

              {user ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    onClick={() => setAccountOpen(!accountOpen)}
                    className="inline-flex items-center gap-2 bg-white text-black border border-black/10 px-3 py-1.5 rounded-full font-semibold shadow hover:bg-white/90"
                  >
                    <User className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline max-w-[140px] truncate">
                      {profile?.full_name || user.email?.split('@')[0] || 'Account'}
                    </span>
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white text-black border border-black/10 rounded-lg shadow-lg py-2 text-sm z-[90]">
                      <div className="px-3 py-2 border-b border-black/10">
                        <div className="font-semibold text-gray-900 truncate">{profile?.full_name || 'User'}</div>
                        <div className="text-xs text-gray-600 truncate">{profile?.email || user.email}</div>
                      </div>
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black"
                        onClick={() => setAccountOpen(false)}
                      >
                        <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black"
                        onClick={() => setAccountOpen(false)}
                      >
                        <User className="w-4 h-4" aria-hidden="true" /> Profile & Settings
                      </Link>
                      {isAdminUser && (
                        <Link
                          to="/dashboard?section=admin"
                          className="flex items-center gap-2 px-3 py-2 hover:bg-[#ffcb05] hover:text-black"
                          onClick={() => setAccountOpen(false)}
                        >
                          <Settings className="w-4 h-4" aria-hidden="true" /> Admin
                        </Link>
                      )}
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
                <div className="hidden sm:flex items-center gap-2">
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
        </header>
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation backdrop"
            className="fixed inset-x-0 bottom-0 top-12 sm:top-14 z-[66] xl:hidden bg-black/10"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-x-0 top-12 sm:top-14 z-[69] xl:hidden max-h-[calc(100vh-6.5rem)] sm:max-h-[calc(100vh-7.5rem)] overflow-y-auto border-t border-black/10 bg-[#ffe459] text-black shadow-sm">
            <nav className="px-4 py-3 grid gap-2 font-semibold text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="rounded-lg border border-black/10 bg-white px-3 py-3 hover:bg-[#ffcb05] hover:text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="font-semibold text-black">{link.label}</div>
                </Link>
              ))}

              {user && (
                <div className="pt-2 mt-1 border-t border-black/10 grid gap-2">
                  {payoutsShortcutHref && (
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        navigate(payoutsShortcutHref);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 bg-white text-black border border-black/10 px-4 py-2 rounded-lg font-semibold shadow hover:bg-white/90"
                    >
                      <DollarSign className="w-4 h-4" aria-hidden="true" />
                      Payouts
                    </button>
                  )}
                  {isAdminUser && (
                    <Link
                      to="/dashboard?section=admin"
                      onClick={() => setMobileOpen(false)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-white text-black border border-black/10 px-4 py-2 rounded-lg font-semibold shadow hover:bg-white/90"
                    >
                      <Settings className="w-4 h-4" aria-hidden="true" />
                      Admin
                    </Link>
                  )}
                </div>
              )}

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
        </>
      )}

      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-[65] pointer-events-none">
        <div className="pointer-events-auto border-t border-black/10 bg-white/95 backdrop-blur">
          <div
            className="grid gap-1 px-1.5 py-1.5"
            style={{ gridTemplateColumns: `repeat(${mobilePrimaryActions.length}, minmax(0, 1fr))` }}
          >
            {mobilePrimaryActions.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? location.pathname.startsWith('/dashboard')
                  : item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);
              const badgeCount = item.href === '/cart' ? itemCount : 0;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-semibold ${
                    isActive ? 'bg-[#101820] text-[#ffcb05]' : 'text-[#101820]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="absolute right-2 top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ffcb05] px-1 text-[10px] font-bold text-black">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default GlobalHeaderBar;
