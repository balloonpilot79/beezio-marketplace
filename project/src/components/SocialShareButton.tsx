import React, { useState } from 'react';
import { 
  Share2, Facebook, Twitter, Linkedin, Mail, 
  MessageCircle, Copy, X 
} from 'lucide-react';
import { useGamificationContext } from '../contexts/GamificationContext';

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
  affiliateCode,
  className = '',
  size = 'md',
  variant = 'button'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { trackSocialShare } = useGamificationContext();

  const getProductUrl = () => {
    const baseUrl = `${window.location.origin}/product/${product.id}`;
    return affiliateCode ? `${baseUrl}?ref=${affiliateCode}` : baseUrl;
  };

  const getShareText = () => {
    const sellerText = product.profiles?.full_name ? ` by ${product.profiles.full_name}` : '';
    return {
      title: `Check out: ${product.title}${sellerText}`,
      description: product.description || `Amazing product for only $${product.price}! Don't miss out on this great deal.`,
      url: getProductUrl()
    };
  };

  const handleShare = async (platform: SharePlatform) => {
    const { title, description, url } = getShareText();
    const shareUrl = platform.shareUrl(url, title, description);
    
    // Track social share for gamification
    await trackSocialShare(product.id);
    
    // Open share window
    if (platform.name === 'Email') {
      window.location.href = shareUrl;
    } else {
      window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
    }
    
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      const { url } = getShareText();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // Track as social share for gamification
      await trackSocialShare(product.id);
    } catch (err) {
      console.error('Failed to copy link:', err);
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
        
        // Track social share for gamification
        await trackSocialShare(product.id);
      } catch (err) {
        console.error('Error sharing:', err);
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

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleNativeShare}
          className={`${className} text-gray-600 hover:text-amber-600 transition-colors p-2 rounded-full hover:bg-gray-100`}
          title="Share product"
        >
          <Share2 className={iconSizes[size]} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        className={`${className} ${buttonSizes[size]} bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2`}
      >
        <Share2 className={iconSizes[size]} />
        <span>Share</span>
      </button>

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

              {/* Copy Link */}
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
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
    </div>
  );
};

export default SocialShareButton;
