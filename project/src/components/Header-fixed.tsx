import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import CartIcon from './CartIcon';

interface HeaderProps {
  onOpenAuthModal: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenAuthModal }) => {
  const { user, profile, signOut } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Remove old sign out handler and add new logout handler
  const handleLogout = async () => {
    try {
      await signOut();
      setIsMenuOpen(false);
      navigate('/');
    } catch (error) {
      alert('Logout failed. Please try again.');
    }
  };

  const handleDashboardClick = () => {
    if (profile?.role) {
      navigate(`/dashboard/${profile.role}`);
    } else {
      navigate('/dashboard');
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-r from-primary-600 to-accent-600 text-white w-10 h-10 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200">
              <span className="text-xl font-bold">B</span>
            </div>
            <span className="text-2xl font-display font-bold text-gradient">
              Beezio
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/products" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              Products
            </Link>
            <Link 
              to="/how-it-works" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              How It Works
            </Link>
            <Link 
              to="/sellers" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              For Sellers
            </Link>
            <Link 
              to="/affiliates" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
            >
              For Affiliates
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            
            {/* Cart Icon */}
            <Link to="/cart" className="relative">
              <CartIcon />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {profile?.full_name?.[0] || user.email?.[0] || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:block text-gray-700 font-medium">
                    {profile?.full_name || 'User'}
                  </span>
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={handleDashboardClick}
                      className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                    >
                      Dashboard
                    </button>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors duration-200"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="btn-primary"
                >
                  Get Started
                </button>
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
                to="/products" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Products
              </Link>
              <Link 
                to="/how-it-works" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link 
                to="/sellers" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                For Sellers
              </Link>
              <Link 
                to="/affiliates" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                For Affiliates
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
