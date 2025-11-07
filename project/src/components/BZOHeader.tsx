import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import CartIcon from './CartIcon';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';
import { Menu, X, User, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onOpenAuthModal: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const BZOHeader: React.FC<HeaderProps> = ({ onOpenAuthModal }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const storeProfileId = profile?.id || user?.id || '';

  // Refs for detecting clicks outside
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    const handleScroll = () => {
      setIsUserDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
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
      setIsUserDropdownOpen(false);
      navigate('/');
    }
  };

  const navigationLinks = [
    { to: '/', label: 'Home', hover: 'hover:text-[#FFD700]' },
    { to: '/sellers', label: 'Sellers', hover: 'hover:text-[#FFD700]' },
    { to: '/affiliates', label: 'Affiliates', hover: 'hover:text-[#FFD700]' },
    { to: '/fundraisers', label: 'Fundraisers', hover: 'hover:text-[#FFD700]' },
    { to: '/contact', label: 'Contact', hover: 'hover:text-[#FFD700]' }
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left side: Beezio Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="text-2xl font-bold text-gray-900 group-hover:text-[#FFD700] transition-colors duration-200">
                BEEZIO
              </div>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-gray-700 ${link.hover} font-medium transition-colors duration-200`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <CartIcon />

            {/* Language & Currency */}
            <div className="hidden lg:flex items-center space-x-2">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>

            {/* Auth Section */}
            {user ? (
              <div className="flex items-center space-x-3">
                {/* User Dropdown */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center space-x-2 bg-bzo-yellow-light hover:bg-bzo-yellow-primary/20 p-2 rounded-full transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 bg-bzo-yellow-primary rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-bzo-black" />
                    </div>
                    <span className="hidden lg:block text-bzo-black font-medium group-hover:text-bzo-yellow-primary transition-colors">
                      {user.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-bzo-black transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-bzo-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-bzo-black">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          {profile?.role === 'seller' ? '🏪 Seller Account' : 
                           profile?.role === 'affiliate' ? '🤝 Affiliate Account' : 
                           '👤 User Account'}
                        </p>
                      </div>
                      
                      <Link to="/dashboard" className="block px-4 py-2 text-sm text-bzo-black hover:bg-bzo-yellow-light transition-colors">
                        📊 Dashboard
                      </Link>
                      
                      {storeProfileId && (
                        <Link to={`/store/${storeProfileId}`} className="block px-4 py-2 text-sm text-bzo-black hover:bg-bzo-yellow-light transition-colors">
                          🏪 My Store
                        </Link>
                      )}
                      
                      <Link to="/profile" className="block px-4 py-2 text-sm text-bzo-black hover:bg-bzo-yellow-light transition-colors">
                        ⚙️ Settings
                      </Link>
                      
                      <hr className="my-2 border-gray-100" />
                      
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="bg-transparent border-2 border-gray-300 hover:border-[#FFD700] text-gray-900 px-6 py-2 rounded-lg font-semibold transition-all duration-200"
                >
                  Login
                </button>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="bg-[#FFD700] hover:bg-[#FFC700] text-gray-900 px-6 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-bzo-yellow-light transition-colors"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-bzo-black" />
              ) : (
                <Menu className="w-6 h-6 text-bzo-black" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-3">
              {navigationLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-4 py-2 text-bzo-black hover:bg-bzo-yellow-light rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              {!user && (
                <>
                  <hr className="border-gray-200" />
                  <div className="px-4 space-y-2">
                    <button
                      onClick={() => {
                        onOpenAuthModal({ isOpen: true, mode: 'login' });
                        setIsMenuOpen(false);
                      }}
                      className="w-full btn-bzo-outline py-2 rounded-full"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        onOpenAuthModal({ isOpen: true, mode: 'register' });
                        setIsMenuOpen(false);
                      }}
                      className="w-full btn-bzo-primary py-2 rounded-full"
                    >
                      Sign Up
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default BZOHeader;