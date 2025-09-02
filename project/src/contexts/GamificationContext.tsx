import React, { createContext, useContext, ReactNode } from 'react';
import useGamification from '../hooks/useGamification';
import BadgeNotification from '../components/BadgeNotification';

interface GamificationContextType {
  trackProductView: (productId: string) => Promise<void>;
  trackSocialShare: (productId?: string) => Promise<void>;
  trackSale: (commissionAmount: number) => Promise<void>;
  trackReferral: () => Promise<void>;
  getAffiliateStats: () => Promise<any>;
  checkForNewBadges: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

interface GamificationProviderProps {
  children: ReactNode;
}

export const GamificationProvider: React.FC<GamificationProviderProps> = ({ children }) => {
  const {
    newBadges,
    dismissBadge,
    trackProductView,
    trackSocialShare,
    trackSale,
    trackReferral,
    getAffiliateStats,
    checkForNewBadges
  } = useGamification();

  const value = {
    trackProductView,
    trackSocialShare,
    trackSale,
    trackReferral,
    getAffiliateStats,
    checkForNewBadges
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
      
      {/* Badge Notifications */}
      {newBadges.map((notification) => (
        <BadgeNotification
          key={notification.id}
          badge={notification.badge}
          show={true}
          onClose={() => dismissBadge(notification.id)}
        />
      ))}
    </GamificationContext.Provider>
  );
};

export const useGamificationContext = (): GamificationContextType => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamificationContext must be used within a GamificationProvider');
  }
  return context;
};

export default GamificationProvider;
