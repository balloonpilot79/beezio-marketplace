import React, { useState } from 'react';
import {
  Share2, Facebook, Twitter, Linkedin, Mail,
  MessageCircle, Copy, X, Sparkles, QrCode
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import { reserveShareWindow, navigateShareWindow } from '../utils/shareNavigation';
import SocialMediaTemplates from './SocialMediaTemplates';
import QRCodeShare from './QRCodeShare';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { productShareUrl } from '../../shared/productShareMetadata';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  images: string[];
  seller_id?: string;
  profiles?: {
    full_name: string;
  };
}

interface SocialShareButtonProps {
  product: Product;
  targetPath?: string;
  affiliateCode?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon' | 'floating';
}

interface SharePlatform {
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  shareUrl: (url: string, title: string, description: string) => string;
}

const sharePlatforms: SharePlatform[] = [
  {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700',
    shareUrl: (url, title, description) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title + ' - ' + description)}`
  },
  {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-sky-500 hover:bg-sky-600',
    shareUrl: (url, title, description) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title + ' - ' + description)}&hashtags=shopping,deals`
  },
  {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 hover:bg-blue-800',
    shareUrl: (url, title, description) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`
  },
  {
    name: 'Pinterest',
    icon: () => (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.749.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.747-1.378 0 0-.599 2.282-.744 2.84-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.815 10.77 24 12.017 24c6.624 0 11.99-5.367 11.99-12.013C24.007 5.367 18.641.001.012.017z"/>
      </svg>
    ),
    color: 'bg-red-600 hover:bg-red-700',
    shareUrl: (url, title, description) =>
      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title + ' - ' + description)}`
  },
  {
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-green-500 hover:bg-green-600',
    shareUrl: (url, title, description) =>
      `https://wa.me/?text=${encodeURIComponent(title + ' - ' + description + ' ' + url)}`
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'bg-gray-600 hover:bg-gray-700',
    shareUrl: (url, title, description) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description + '\n\nCheck it out: ' + url)}`
  }
];

export const SocialShareButton: React.FC<SocialShareButtonProps> = ({
  product,
  targetPath,
  affiliateCode,
  className = '',
  size = 'md',
  variant = 'button'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const track = (channel: string) => {
    try { void Promise.resolve(trackShare(product.id, channel)).catch(() => {}); } catch { /* Analytics must not block sharing. */ }
  };
  const [showTemplates, setShowTemplates] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const { trackShare } = useBehaviorTracker();

  const getProductUrl = () => {
    return productShareUrl(window.location.origin, product.id, targetPath, affiliateCode);
  };

  const getShareText = () => {
    const sellerText = product.profiles?.full_name ? ` by ${product.profiles.full_name}` : '';
    return {
      title: `Check out: ${product.title}${sellerText}`,
      description: product.description || `Amazing product for only $${product.price}! Don't miss out on this great deal.`,
      url: getProductUrl()
    };
  };

  const handleShare = (platform: SharePlatform) => {
    const { title, description, url } = getShareText();
    const shareUrl = platform.shareUrl(url, title, description);

    // Open during the click gesture; analytics must not delay the composer.

    // Open share window
    if (platform.name === 'Email') {
      window.location.href = shareUrl;
    } else {
      navigateShareWindow(shareUrl, reserveShareWindow());
    }

    track(platform.name.toLowerCase());
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      const { url } = getShareText();
      setCopyError(false);
      if (!await copyTextToClipboard(url)) throw new Error('Copy failed');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track copy link action for analytics
      track('copy_link');
    } catch (err) {
      setCopyError(true);
      setIsOpen(true);
    }
  };

  const handleNativeShare = async () => {
    const { title, description, url } = getShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url
        });

        // Track native share for analytics
        track('native_share');
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) setIsOpen(true);
      }
    } else {
      setIsOpen(true);
    }
  };

  const buttonSizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (variant === 'floating') {
    return (
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40">
        {copyError && <div role="alert" className="bg-white p-3 shadow rounded-lg max-w-xs">Could not copy. Select and copy this link:<input aria-label="Product share link" value={getProductUrl()} readOnly className="w-full border p-2" /></div>}
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
          >
            <Share2 className="w-5 h-5" />
          </button>

          {isOpen && (
            <div className="flex flex-col space-y-2 animate-in slide-in-from-right duration-200">
              {sharePlatforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.name}
                    onClick={() => handleShare(platform)}
                    className={`${platform.color} text-white p-2 rounded-full shadow-lg transition-all duration-200 hover:scale-110`}
                    title={`Share on ${platform.name}`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              <button
                onClick={handleCopyLink}
                className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                title="Copy link"
              >
                {copied ? <Copy className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        title="Share product"
        className={variant === 'icon' ? `${className} text-gray-600 hover:text-amber-600 p-2 rounded-full` : `${className} ${buttonSizes[size]} bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2`}
      >
        <Share2 className={iconSizes[size]} />
        {variant !== 'icon' && <span>Share</span>}
      </button>

      {copyError && <p role="alert">Could not copy. Select and copy the link below.</p>}
      {/* Share Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Share Product</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Product Preview */}
              <div className="flex space-x-3 mb-6 p-3 bg-gray-50 rounded-lg">
                <img
                  src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=100'}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{product.title}</h4>
                  <p className="text-sm text-gray-600">${product.price.toFixed(2)}</p>
                  {product.profiles?.full_name && (
                    <p className="text-xs text-gray-500">by {product.profiles.full_name}</p>
                  )}
                </div>
              </div>

              {/* Share Platforms */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {sharePlatforms.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <button
                      key={platform.name}
                      onClick={() => handleShare(platform)}
                      className={`${platform.color} text-white p-3 rounded-lg transition-all duration-200 hover:scale-105 flex items-center space-x-2`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{platform.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Social Media Templates */}
              <div className="mb-4">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-3 rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">Get Social Media Templates</span>
                </button>
              </div>

              {/* QR Code Share */}
              <div className="mb-4">
                <button
                  onClick={() => setShowQRCode(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white p-3 rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <QrCode className="w-5 h-5" />
                  <span className="font-medium">Generate QR Code</span>
                </button>
              </div>

              {/* Copy Link */}
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    aria-label="Product share link"
                    value={getProductUrl()}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Copy className="w-4 h-4 text-green-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Media Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <SocialMediaTemplates
            product={product}
            affiliateCode={affiliateCode}
            onClose={() => setShowTemplates(false)}
          />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <QRCodeShare
            url={getProductUrl()}
            title={`Partner link for ${product.title}`}
            onClose={() => setShowQRCode(false)}
          />
        </div>
      )}
    </div>
  );
};

export default SocialShareButton;
