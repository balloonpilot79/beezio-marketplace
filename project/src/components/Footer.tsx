import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Heart, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          
          {/* Company Info */}
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Beezio</h3>
            <p className="text-sm text-gray-400 mb-4">
              The transparent marketplace where sellers, affiliates, and buyers all win. 
              Everyone knows exactly what they're getting.
            </p>
            <div className="flex items-center space-x-2 text-sm">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span>in the USA</span>
            </div>
          </div>

          {/* For Users */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4">For Users</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/marketplace" className="hover:text-white transition-colors">
                  Browse Marketplace
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/sellers" className="hover:text-white transition-colors">
                  For Sellers
                </Link>
              </li>
              <li>
                <Link to="/start-earning" className="hover:text-white transition-colors">
                  For Affiliates
                </Link>
              </li>
              <li>
                <Link to="/fundraisers" className="hover:text-white transition-colors">
                  For Fundraisers
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help-center" className="hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:support@beezio.co" className="hover:text-white transition-colors inline-flex items-center">
                  support@beezio.co
                  <Mail className="w-3 h-3 ml-1" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="mailto:legal@beezio.co" className="hover:text-white transition-colors inline-flex items-center">
                  Legal Inquiries
                  <Mail className="w-3 h-3 ml-1" />
                </a>
              </li>
              <li>
                <a href="mailto:press@beezio.co" className="hover:text-white transition-colors inline-flex items-center">
                  Press & Media
                  <Mail className="w-3 h-3 ml-1" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            {/* Copyright */}
            <div className="text-sm text-gray-400 text-center sm:text-left">
              © {currentYear} Beezio. All rights reserved.
            </div>

            {/* Contact Emails */}
            <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-xs text-gray-400">
              <a href="mailto:info@beezio.co" className="hover:text-white transition-colors">
                info@beezio.co
              </a>
              <a href="mailto:sales@beezio.co" className="hover:text-white transition-colors">
                sales@beezio.co
              </a>
              <a href="mailto:affiliates@beezio.co" className="hover:text-white transition-colors">
                affiliates@beezio.co
              </a>
            </div>
          </div>

          {/* Platform Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Transparent pricing • Fair commissions • Everyone wins
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Payments processed securely by{' '}
              <a 
                href="https://stripe.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center"
              >
                Stripe
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
