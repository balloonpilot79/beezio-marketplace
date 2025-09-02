import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface BehaviorTracker {
  trackView: (productId?: string, categoryId?: string) => void;
  trackClick: (productId?: string, elementType?: string) => void;
  trackCartAdd: (productId: string) => void;
  trackPurchase: (productId: string, metadata?: any) => void;
  trackSearch: (query: string, metadata?: any) => void;
  trackFavorite: (productId: string) => void;
  trackShare: (productId: string, platform?: string) => void;
}

const useBehaviorTracker = (): BehaviorTracker => {
  const { user } = useAuth();
  const sessionStartTime = useRef<number>(Date.now());
  const pageStartTime = useRef<number>(Date.now());
  const lastScrollPosition = useRef<number>(0);
  const maxScrollDepth = useRef<number>(0);

  useEffect(() => {
    // Track page view on mount
    trackPageView();
    
    // Track scroll depth
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercentage = (scrollPosition + windowHeight) / documentHeight;
      
      maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercentage);
      lastScrollPosition.current = scrollPosition;
    };

    // Track time on page when leaving
    const handleBeforeUnload = () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      trackBehavior('page_exit', undefined, undefined, {
        time_on_page: timeOnPage,
        max_scroll_depth: Math.round(maxScrollDepth.current * 100),
        final_scroll_position: lastScrollPosition.current
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Track exit when component unmounts
    };
  }, []);

  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  const getDeviceInfo = () => {
    const width = window.innerWidth;
    const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    
    return {
      device_type: deviceType,
      screen_width: width,
      screen_height: window.innerHeight,
      user_agent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  };

  const trackBehavior = async (
    behaviorType: string,
    productId?: string,
    categoryId?: string,
    metadata: any = {}
  ) => {
    try {
      const duration = Math.round((Date.now() - pageStartTime.current) / 1000);
      
      await supabase.from('user_behaviors').insert([{
        user_id: user?.id || null,
        session_id: getSessionId(),
        behavior_type: behaviorType,
        product_id: productId || null,
        category_id: categoryId || null,
        duration_seconds: duration,
        page_url: window.location.href,
        referrer_url: document.referrer || null,
        metadata: {
          ...getDeviceInfo(),
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (error) {
      console.error('Failed to track behavior:', error);
    }
  };

  const trackPageView = () => {
    pageStartTime.current = Date.now();
    maxScrollDepth.current = 0;
    
    // Extract product/category info from URL
    const path = window.location.pathname;
    const productMatch = path.match(/\/product\/([^\/]+)/);
    const categoryMatch = path.match(/\/category\/([^\/]+)/);
    
    trackBehavior(
      'page_view',
      productMatch ? productMatch[1] : undefined,
      categoryMatch ? categoryMatch[1] : undefined,
      {
        page_type: getPageType(path),
        url_params: Object.fromEntries(new URLSearchParams(window.location.search))
      }
    );
  };

  const getPageType = (path: string) => {
    if (path.includes('/product/')) return 'product_detail';
    if (path.includes('/category/')) return 'category';
    if (path.includes('/search')) return 'search';
    if (path.includes('/cart')) return 'cart';
    if (path.includes('/checkout')) return 'checkout';
    if (path.includes('/dashboard')) return 'dashboard';
    if (path === '/') return 'homepage';
    return 'other';
  };

  const trackView = (productId?: string, categoryId?: string) => {
    trackBehavior('view', productId, categoryId);
  };

  const trackClick = (productId?: string, elementType?: string) => {
    trackBehavior('click', productId, undefined, { element_type: elementType });
  };

  const trackCartAdd = (productId: string) => {
    trackBehavior('cart_add', productId, undefined, {
      action: 'add_to_cart',
      source_page: getPageType(window.location.pathname)
    });
  };

  const trackPurchase = (productId: string, metadata: any = {}) => {
    trackBehavior('purchase', productId, undefined, {
      action: 'purchase',
      ...metadata
    });
  };

  const trackSearch = (query: string, metadata: any = {}) => {
    trackBehavior('search', undefined, undefined, {
      search_query: query,
      ...metadata
    });
  };

  const trackFavorite = (productId: string) => {
    trackBehavior('favorite', productId, undefined, {
      action: 'add_to_favorites'
    });
  };

  const trackShare = (productId: string, platform?: string) => {
    trackBehavior('share', productId, undefined, {
      action: 'share',
      platform: platform || 'unknown'
    });
  };

  return {
    trackView,
    trackClick,
    trackCartAdd,
    trackPurchase,
    trackSearch,
    trackFavorite,
    trackShare
  };
};

export { useBehaviorTracker };
export default useBehaviorTracker;
