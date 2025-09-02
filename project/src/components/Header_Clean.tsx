import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import CartIcon from './CartIcon';
import LanguageSwitcher from './LanguageSwitcher';
import CurrencySwitcher from './CurrencySwitcher';

interface HeaderProps {
  onOpenAuthModal: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenAuthModal }) => {
  const { user, profile } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpDropdownOpen, setIsHelpDropdownOpen] = useState(false);
  const [isGlobalDropdownOpen, setIsGlobalDropdownOpen] = useState(false);

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left side: Logo + Navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white w-10 h-10 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200">
                <span className="text-xl font-bold">B</span>
              </div>
              <span className="text-2xl font-display font-bold text-gradient">
                Beezio
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                to="/marketplace" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200 relative group"
              >
                Marketplace
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
              <Link 
                to="/fundraisers" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200 relative group"
              >
                Fundraisers
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
              <div className="relative">
                <button
                  onClick={() => setIsHelpDropdownOpen(!isHelpDropdownOpen)}
                  className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200 flex items-center space-x-1"
                >
                  <span>How It Works</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isHelpDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <Link to="/how-it-works" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      How It Works
                    </Link>
                    <Link to="/sellers" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      For Sellers
                    </Link>
                    <Link to="/affiliates" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      For Affiliates
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center space-x-4">
            {/* Global Settings Dropdown */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setIsGlobalDropdownOpen(!isGlobalDropdownOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
              </button>
              
              {isGlobalDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <LanguageSwitcher />
                  </div>
                  <div className="px-4 py-2">
                    <CurrencySwitcher />
                  </div>
                </div>
              )}
            </div>

            {/* Cart Icon */}
            <Link to="/cart" className="relative">
              <CartIcon />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </Link>

            {/* Sign In/Up for non-authenticated users */}
            {!user && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
                  className="text-gray-600 hover:text-primary-600 font-medium transition-colors duration-200"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuthModal({ isOpen: true, mode: 'register' })}
                  className="bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  Sign Up
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
                to="/marketplace" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Marketplace
              </Link>
              <Link 
                to="/fundraisers" 
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Fundraisers
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
              
              {/* Mobile Sign In/Up for non-authenticated users */}
              {!user && (
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => {
                      onOpenAuthModal({ isOpen: true, mode: 'login' });
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      onOpenAuthModal({ isOpen: true, mode: 'register' });
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-primary-600 font-medium transition-colors duration-200"
                  >
                    Sign Up
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
