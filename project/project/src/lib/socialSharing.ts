// Social sharing utilities and platform configurations

export interface ShareData {
  url: string;
  title: string;
  description: string;
  image?: string;
  hashtags?: string[];
}

export interface SharePlatform {
  name: string;
  icon: string;
  color: string;
  shareFunction: (data: ShareData) => void;
}

// Platform-specific sharing functions
export const shareFunctions = {
  facebook: (data: ShareData) => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}&quote=${encodeURIComponent(data.title + ' - ' + data.description)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  twitter: (data: ShareData) => {
    const hashtags = data.hashtags ? data.hashtags.join(',') : 'shopping,deals';
    const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.title + ' - ' + data.description)}&hashtags=${hashtags}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  linkedin: (data: ShareData) => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(data.title)}&summary=${encodeURIComponent(data.description)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  whatsapp: (data: ShareData) => {
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(data.title + ' - ' + data.description + ' ' + data.url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  telegram: (data: ShareData) => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.title + ' - ' + data.description)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  pinterest: (data: ShareData) => {
    const shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(data.url)}&description=${encodeURIComponent(data.description)}&media=${encodeURIComponent(data.image || '')}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  reddit: (data: ShareData) => {
    const shareUrl = `https://reddit.com/submit?url=${encodeURIComponent(data.url)}&title=${encodeURIComponent(data.title)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  tumblr: (data: ShareData) => {
    const shareUrl = `https://www.tumblr.com/share/link?url=${encodeURIComponent(data.url)}&name=${encodeURIComponent(data.title)}&description=${encodeURIComponent(data.description)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  },

  email: (data: ShareData) => {
    const subject = encodeURIComponent(data.title);
    const body = encodeURIComponent(`${data.description}\n\nCheck it out: ${data.url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  },

  sms: (data: ShareData) => {
    const body = encodeURIComponent(`${data.title} - ${data.description} ${data.url}`);
    window.location.href = `sms:?body=${body}`;
  },

  copyLink: async (data: ShareData) => {
    try {
      await navigator.clipboard.writeText(data.url);
      return true;
    } catch (err) {
      console.error('Failed to copy link:', err);
      return false;
    }
  },

  nativeShare: async (data: ShareData) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.description,
          url: data.url
        });
        return true;
      } catch (err) {
        console.error('Error sharing:', err);
        return false;
      }
    }
    return false;
  }
};

// Check if native sharing is supported
export const isNativeShareSupported = (): boolean => {
  return typeof navigator !== 'undefined' && !!navigator.share;
};

// Generate share text with product info
export const generateShareText = (product: any, affiliateCode?: string): ShareData => {
  const baseUrl = `${window.location.origin}/product/${product.id}`;
  const url = affiliateCode ? `${baseUrl}?ref=${affiliateCode}` : baseUrl;
  const sellerText = product.profiles?.full_name ? ` by ${product.profiles.full_name}` : '';
  
  return {
    url,
    title: `Check out: ${product.title}${sellerText}`,
    description: product.description || `Amazing product for only $${product.price}! Don't miss out on this great deal.`,
    image: product.images?.[0],
    hashtags: ['shopping', 'deals', 'marketplace']
  };
};

// Track social share event (integrates with gamification)
export const trackSocialShare = async (
  productId: string, 
  platform: string, 
  trackingFunction: (productId: string) => Promise<void>
) => {
  try {
    await trackingFunction(productId);
    
    // Optional: Track specific platform analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'share', {
        method: platform,
        content_type: 'product',
        item_id: productId
      });
    }
  } catch (error) {
    console.error('Error tracking social share:', error);
  }
};

// Get appropriate platforms based on device/context
export const getRecommendedPlatforms = (): string[] => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    return ['whatsapp', 'facebook', 'twitter', 'instagram', 'telegram', 'sms', 'copyLink'];
  } else {
    return ['facebook', 'twitter', 'linkedin', 'pinterest', 'reddit', 'email', 'copyLink'];
  }
};

// Format share analytics data
export const formatShareAnalytics = (shares: any[]) => {
  const platformCounts = shares.reduce((acc, share) => {
    acc[share.platform] = (acc[share.platform] || 0) + 1;
    return acc;
  }, {});

  return {
    totalShares: shares.length,
    platformBreakdown: platformCounts,
    topPlatform: Object.keys(platformCounts).reduce((a, b) => 
      platformCounts[a] > platformCounts[b] ? a : b
    )
  };
};
