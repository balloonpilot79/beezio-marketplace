import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import CartIcon from './CartIcon';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';

interface HeaderProps {
  onOpenAuthModal: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenAuthModal }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGlobalDropdownOpen, setIsGlobalDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const storeProfileId = profile?.id || user?.id || '';


  // Refs for detecting clicks outside
  const globalDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (globalDropdownRef.current && !globalDropdownRef.current.contains(event.target as Node)) {
        setIsGlobalDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    const handleScroll = () => {
      // Close all dropdowns when scrolling
      setIsGlobalDropdownOpen(false);
      setIsUserDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setIsUserDropdownOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still close dropdown and navigate even if logout has issues
      setIsUserDropdownOpen(false);
      navigate('/');
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/80 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left side: Logo + Navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-all duration-200 shadow-md">
                <span className="text-xl font-bold">🐝</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                Beezio
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-4">
              <Link 
                to="/start-earning" 
                className="text-gray-700 hover:text-yellow-600 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
              >
                Sell & Earn
                <span className="absolute bottom-0 left-2 w-0 h-0.5 bg-yellow-600 transition-all duration-300 group-hover:w-[calc(100%-16px)]"></span>
              </Link>
              <Link 
                to="/affiliate/products" 
                className="text-gray-700 hover:text-green-600 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
              >
                Affiliate Products
                <span className="absolute bottom-0 left-2 w-0 h-0.5 bg-green-600 transition-all duration-300 group-hover:w-[calc(100%-16px)]"></span>
              </Link>
              <Link 
                to="/marketplace" 
                className="text-gray-700 hover:text-blue-600 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
              >
                Shop
                <span className="absolute bottom-0 left-2 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-[calc(100%-16px)]"></span>
              </Link>
              <Link 
                to="/contact" 
                className="text-gray-700 hover:text-orange-600 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
              >
                Contact
                <span className="absolute bottom-0 left-2 w-0 h-0.5 bg-orange-600 transition-all duration-300 group-hover:w-[calc(100%-16px)]"></span>
              </Link>
            </nav>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center space-x-4">
            {/* Global Settings Dropdown */}
            <div className="hidden md:block relative" ref={globalDropdownRef}>
              <button
                onClick={() => setIsGlobalDropdownOpen(!isGlobalDropdownOpen)}
                className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
              </button>
              
              {isGlobalDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Language</div>
                    <LanguageSwitcher />
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Currency</div>
                    <CurrencySwitcher />
                  </div>
                </div>
              )}
            </div>

            {/* Cart Icon */}
            <CartIcon />

            {/* Sign In/Up for non-authenticated users */}
            {!user ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="text-gray-700 hover:text-yellow-600 font-semibold transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-yellow-50"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Start Earning
                </button>
              </div>
            ) : (
              /* User Profile Dropdown for authenticated users */
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block text-gray-700 font-medium">
                    {user.email?.split('@')[0] || 'User'}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">Signed in</div>
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/affiliate/products"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      💰 Affiliate Products
                    </Link>
                    <Link
                      to="/seller/products"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      🏪 My Products
                    </Link>
                    {storeProfileId && (
                      <Link
                        to={`/store/${storeProfileId}`}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        My Store
                      </Link>
                    )}
                    <Link
                      to="/earnings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors duration-200"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      💵 Earnings
                    </Link>
                    <Link
                      to="/dashboard/store-settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => setIsUserDropdownOpen(false)}
                    >
                      ⚙️ Store Settings
                    </Link>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-200"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              <Link 
                to="/start-earning" 
                className="text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Sell & Earn
              </Link>
              <Link 
                to="/affiliate/products" 
                className="text-gray-700 hover:text-green-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Affiliate Products
              </Link>
              <Link 
                to="/marketplace" 
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Shop
              </Link>
              <Link 
                to="/contact" 
                className="text-gray-700 hover:text-orange-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              
              {/* Mobile Sign In/Up for non-authenticated users */}
              {!user ? (
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => {
                      onOpenAuthModal({ isOpen: true, mode: 'login' });
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuthModal({ isOpen: true, mode: 'register' });
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                  >
                    Start Earning
                  </button>
                </div>
              ) : (
                /* Mobile User Menu for authenticated users */
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <div className="pb-2 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                    <div className="text-xs text-gray-500">Signed in</div>
                  </div>
                  <Link
                    to="/dashboard"
                    className="block text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/affiliate/products"
                    className="block text-gray-700 hover:text-green-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    💰 Affiliate Products
                  </Link>
                  <Link
                    to="/seller/products"
                    className="block text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    🏪 My Products
                  </Link>
                  {storeProfileId && (
                    <Link
                      to={`/store/${storeProfileId}`}
                      className="block text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      My Store
                    </Link>
                  )}
                  <Link
                    to="/earnings"
                    className="block text-gray-700 hover:text-green-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    💵 Earnings
                  </Link>
                  <Link
                    to="/dashboard/store-settings"
                    className="block text-gray-700 hover:text-yellow-600 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    ⚙️ Store Settings
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left text-red-700 hover:text-red-800 font-medium transition-colors duration-200 pt-2 border-t border-gray-200"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
