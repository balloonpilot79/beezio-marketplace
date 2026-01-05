import React, { createContext, useContext, ReactNode } from 'react';

interface GamificationContextType {
  trackProductView: (productId: string) => Promise<void>;
  trackSocialShare: (productId?: string) => Promise<void>;
  trackSale: (commissionAmount: number) => Promise<void>;
  trackReferral: () => Promise<void>;
  getAffiliateStats: () => Promise<any>;
  checkForNewBadges: () => Promise<void>;
  badgesSupported: boolean;
}

const noopAsync = async (): Promise<void> => {};
const defaultValue: GamificationContextType = {
  trackProductView: noopAsync,
  trackSocialShare: noopAsync,
  trackSale: noopAsync,
  trackReferral: noopAsync,
  getAffiliateStats: async () => null,
  checkForNewBadges: noopAsync,
  badgesSupported: false
};

const GamificationContext = createContext<GamificationContextType>(defaultValue);

interface GamificationProviderProps {
  children: ReactNode;
}

export const GamificationProvider: React.FC<GamificationProviderProps> = ({ children }) => {
  return (
    <GamificationContext.Provider value={defaultValue}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamificationContext = (): GamificationContextType => {
  return useContext(GamificationContext);
};

export default GamificationProvider;
