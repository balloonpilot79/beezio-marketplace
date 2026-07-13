import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Heart } from 'lucide-react';
import { getPartnerLabel } from '../utils/processorSafeCopy';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white text-gray-700 border-t border-black/10">
      <div className="sm:hidden px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-black">Beezio</div>
            <div className="mt-1 text-xs text-gray-500">Simple marketplace checkout and clear pricing.</div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Link to="/marketplace" className="rounded-full border border-black/10 px-3 py-1.5 text-black">
              Shop
            </Link>
            <Link to="/dashboard" className="rounded-full border border-black/10 px-3 py-1.5 text-black">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          
          {/* Company Info */}
          <div>
            <h3 className="text-black text-lg font-bold mb-4">Beezio</h3>
            <p className="text-sm text-gray-600 mb-4">
              A transparent retail marketplace where sellers and buyers meet with clear pricing and secure checkout.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500" aria-hidden="true" />
              <span>in the USA</span>
            </div>
          </div>

          {/* For Users */}
          <div>
            <h3 className="text-black text-base font-semibold mb-4">For Users</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/marketplace" className="hover:text-[#ffcb05] transition-colors">
                  Browse Marketplace
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-[#ffcb05] transition-colors">
                  How Beezio works
                </Link>
              </li>
              <li>
                <Link to="/sellers" className="hover:text-[#ffcb05] transition-colors">
                  For Sellers
                </Link>
              </li>
              <li>
                <Link to="/start-earning" className="hover:text-[#ffcb05] transition-colors">
                  {getPartnerLabel()}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-black text-base font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/contact" className="hover:text-[#ffcb05] transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help-center" className="hover:text-[#ffcb05] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-[#ffcb05] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/returns" className="hover:text-[#ffcb05] transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link to="/shipping" className="hover:text-[#ffcb05] transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <a href="mailto:support@beezio.co" className="hover:text-[#ffcb05] transition-colors inline-flex items-center">
                  support@beezio.co
                  <Mail className="w-3 h-3 ml-1" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-black text-base font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/legal/terms" className="hover:text-[#ffcb05] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/legal/seller-terms" className="hover:text-[#ffcb05] transition-colors">
                  Seller Terms
                </Link>
              </li>
              <li>
                <Link to="/legal/partner-terms" className="hover:text-[#ffcb05] transition-colors">
                  Affiliate Terms
                </Link>
              </li>
              <li>
                <Link to="/legal/influencer-terms" className="hover:text-[#ffcb05] transition-colors">
                  Influencer Terms
                </Link>
              </li>
              <li>
                <Link to="/legal/refund-policy" className="hover:text-[#ffcb05] transition-colors">
                  Refund & Returns
                </Link>
              </li>
              <li>
                <Link to="/legal/dispute-policy" className="hover:text-[#ffcb05] transition-colors">
                  Dispute Policy
                </Link>
              </li>
              <li>
                <Link to="/legal/payout-policy" className="hover:text-[#ffcb05] transition-colors">
                  Payout Policy
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="hover:text-[#ffcb05] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a href="mailto:legal@beezio.co" className="hover:text-[#ffcb05] transition-colors inline-flex items-center">
                  Legal Inquiries
                  <Mail className="w-3 h-3 ml-1" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a href="mailto:press@beezio.co" className="hover:text-[#ffcb05] transition-colors inline-flex items-center">
                  Press & Media
                  <Mail className="w-3 h-3 ml-1" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-black/10 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 text-sm">
            {/* Copyright */}
            <div className="text-center sm:text-left text-gray-600">
              © {currentYear} Beezio. All rights reserved.
            </div>

            {/* Contact Emails */}
            <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-xs text-gray-600">
              <a href="mailto:info@beezio.co" className="hover:text-[#ffcb05] transition-colors">
                info@beezio.co
              </a>
              <a href="mailto:sales@beezio.co" className="hover:text-[#ffcb05] transition-colors">
                sales@beezio.co
              </a>
              <a href="mailto:partners@beezio.co" className="hover:text-[#ffcb05] transition-colors">
                partners@beezio.co
              </a>
            </div>
          </div>

          {/* Platform Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Transparent pricing and straightforward checkout.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Payments processed securely through Beezio checkout.
            </p>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
};

export default Footer;
