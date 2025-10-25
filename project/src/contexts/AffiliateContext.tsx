import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContextMultiRole';
import { supabase } from '../lib/supabase';

export interface AffiliateProduct {
  productId: string;
  selected: boolean;
  dateAdded: string;
  customCommissionRate?: number;
  totalClicks?: number;
  totalSales?: number;
  totalEarnings?: number;
}

export interface AffiliateStats {
  totalProducts: number;
  totalClicks: number;
  totalSales: number;
  totalEarnings: number;
  conversionRate: number;
  topPerformingProduct?: string;
}

interface AffiliateContextType {
  selectedProducts: AffiliateProduct[];
  affiliateStats: AffiliateStats;
  referralCode: string | null;
  addProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  generateAffiliateLink: (productId: string) => string;
  generateSiteWideLink: () => string;
  trackClick: (productId: string, affiliateId: string) => void;
  trackSale: (productId: string, affiliateId: string, saleAmount: number, commission: number) => void;
  isProductSelected: (productId: string) => boolean;
  getProductStats: (productId: string) => Partial<AffiliateProduct>;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export const useAffiliate = () => {
  const context = useContext(AffiliateContext);
  if (!context) {
    throw new Error('useAffiliate must be used within an AffiliateProvider');
  }
  return context;
};

interface AffiliateProviderProps {
  children: React.ReactNode;
}

export const AffiliateProvider: React.FC<AffiliateProviderProps> = ({ children }) => {
  const { user, profile } = useAuth();
  const [selectedProducts, setSelectedProducts] = useState<AffiliateProduct[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats>({
    totalProducts: 0,
    totalClicks: 0,
    totalSales: 0,
    totalEarnings: 0,
    conversionRate: 0
  });

  // Fetch referral code when user/profile loads
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (user && profile) {
        // Try to get from profile first
        if (profile.referral_code) {
          setReferralCode(profile.referral_code);
          return;
        }

        // Otherwise fetch from database
        const { data, error } = await supabase
          .from('profiles')
          .select('referral_code')
          .eq('user_id', user.id)
          .single();

        if (data?.referral_code) {
          setReferralCode(data.referral_code);
        }
      }
    };

    fetchReferralCode();
  }, [user, profile]);

  // Load affiliate data from localStorage
  useEffect(() => {
    if (user) {
      const savedProducts = localStorage.getItem(`affiliate_products_${user.id}`);
      const savedStats = localStorage.getItem(`affiliate_stats_${user.id}`);
      
      if (savedProducts) {
        setSelectedProducts(JSON.parse(savedProducts));
      }
      
      if (savedStats) {
        setAffiliateStats(JSON.parse(savedStats));
      }
    }
  }, [user]);

  // Save to localStorage when data changes
  useEffect(() => {
    if (user && selectedProducts.length > 0) {
      localStorage.setItem(`affiliate_products_${user.id}`, JSON.stringify(selectedProducts));
    }
  }, [selectedProducts, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`affiliate_stats_${user.id}`, JSON.stringify(affiliateStats));
    }
  }, [affiliateStats, user]);

  const addProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.productId === productId);
      if (exists) return prev;
      
      return [...prev, {
        productId,
        selected: true,
        dateAdded: new Date().toISOString(),
        totalClicks: 0,
        totalSales: 0,
        totalEarnings: 0
      }];
    });

    setAffiliateStats(prev => ({
      ...prev,
      totalProducts: prev.totalProducts + 1
    }));
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
    
    setAffiliateStats(prev => ({
      ...prev,
      totalProducts: Math.max(0, prev.totalProducts - 1)
    }));
  };

  const generateAffiliateLink = (productId: string): string => {
    if (!user) return '';
    
    const baseUrl = window.location.origin;
    const affiliateId = user.id;
    const timestamp = Date.now();
    
    // Create a trackable affiliate link with UTM parameters
    return `${baseUrl}/product/${productId}?ref=${affiliateId}&utm_source=affiliate&utm_medium=link&utm_campaign=product_promotion&t=${timestamp}`;
  };

  const generateSiteWideLink = (): string => {
    if (!user) return '';
    
    const baseUrl = window.location.origin;
    
    // Use referral_code if available (e.g., "JOHN2024"), otherwise fallback to user.id
    const refParam = referralCode || user.id;
    
    // Create a site-wide affiliate link that tracks signups and purchases
    return `${baseUrl}/signup?ref=${refParam}`;
  };

  const trackClick = (productId: string, affiliateId: string) => {
    // In a real app, this would send data to your analytics API
    console.log(`Affiliate click tracked: Product ${productId} by Affiliate ${affiliateId}`);
    
    // Update local stats
    setSelectedProducts(prev =>
      prev.map(p =>
        p.productId === productId
          ? { ...p, totalClicks: (p.totalClicks || 0) + 1 }
          : p
      )
    );

    setAffiliateStats(prev => ({
      ...prev,
      totalClicks: prev.totalClicks + 1,
      conversionRate: prev.totalSales > 0 ? (prev.totalSales / (prev.totalClicks + 1)) * 100 : 0
    }));
  };

  const trackSale = (productId: string, affiliateId: string, saleAmount: number, commission: number) => {
    // In a real app, this would send data to your analytics API
    console.log(`Affiliate sale tracked: Product ${productId} by Affiliate ${affiliateId}, Commission: $${commission}`);
    
    // Update local stats
    setSelectedProducts(prev =>
      prev.map(p =>
        p.productId === productId
          ? { 
              ...p, 
              totalSales: (p.totalSales || 0) + 1,
              totalEarnings: (p.totalEarnings || 0) + commission
            }
          : p
      )
    );

    setAffiliateStats(prev => ({
      ...prev,
      totalSales: prev.totalSales + 1,
      totalEarnings: prev.totalEarnings + commission,
      conversionRate: ((prev.totalSales + 1) / Math.max(1, prev.totalClicks)) * 100
    }));
  };

  const isProductSelected = (productId: string): boolean => {
    return selectedProducts.some(p => p.productId === productId && p.selected);
  };

  const getProductStats = (productId: string): Partial<AffiliateProduct> => {
    return selectedProducts.find(p => p.productId === productId) || {};
  };

  const value: AffiliateContextType = {
    selectedProducts,
    affiliateStats,
    referralCode,
    addProduct,
    removeProduct,
    generateAffiliateLink,
    generateSiteWideLink,
    trackClick,
    trackSale,
    isProductSelected,
    getProductStats
  };

  return (
    <AffiliateContext.Provider value={value}>
      {children}
    </AffiliateContext.Provider>
  );
};

export default AffiliateProvider;
