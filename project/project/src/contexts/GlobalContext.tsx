import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LocationData, 
  getUserLocation, 
  getExchangeRates, 
  convertCurrency 
} from '../lib/geolocation';
import { SupportedCurrency, SUPPORTED_CURRENCIES } from '../lib/stripe';

interface GlobalContextType {
  location: LocationData | null;
  currency: SupportedCurrency;
  exchangeRates: Record<string, number>;
  loading: boolean;
  language: string;
  timezone: string;
  setCurrency: (currency: SupportedCurrency) => void;
  setLanguage: (language: string) => void;
  convertPrice: (amount: number, fromCurrency: SupportedCurrency) => Promise<number>;
  formatPrice: (amount: number, currency?: SupportedCurrency) => string;
  formatDate: (date: Date) => string;
  refreshLocation: () => Promise<void>;
  isFeatureAvailable: (feature: string) => boolean;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobal must be used within a GlobalProvider');
  }
  return context;
};

interface GlobalProviderProps {
  children: ReactNode;
}

export const GlobalProvider: React.FC<GlobalProviderProps> = ({ children }) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [currency, setCurrencyState] = useState<SupportedCurrency>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  
  // Global internationalization state
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('preferred-language') || i18n.language || 'en';
  });
  const [timezone] = useState(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  // Initialize location and currency
  useEffect(() => {
    initializeGlobalSettings();
  }, []);

  // Update exchange rates periodically
  useEffect(() => {
    const updateRates = async () => {
      try {
        const rates = await getExchangeRates(currency);
        setExchangeRates(rates);
      } catch (error) {
        console.error('Failed to update exchange rates:', error);
      }
    };

    updateRates();
    
    // Update rates every 30 minutes
    const interval = setInterval(updateRates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currency]);

  const initializeGlobalSettings = async () => {
    try {
      setLoading(true);
      
      // Get user location
      const userLocation = await getUserLocation();
      setLocation(userLocation);
      
      // Check if user has a saved currency preference
      const savedCurrency = localStorage.getItem('beezio_currency') as SupportedCurrency;
      const preferredCurrency = savedCurrency || userLocation.currency;
      
      setCurrencyState(preferredCurrency);
      
      // Set language based on location
      const savedLanguage = localStorage.getItem('beezio_language');
      const preferredLanguage = savedLanguage || userLocation.locale.split('-')[0];
      
      // Check if i18n is initialized and has changeLanguage method
      if (i18n && typeof i18n.changeLanguage === 'function' && i18n.language !== preferredLanguage) {
        try {
          await i18n.changeLanguage(preferredLanguage);
        } catch (langError) {
          console.warn('Failed to change language:', langError);
        }
      }
      
      // Get initial exchange rates
      const rates = await getExchangeRates(preferredCurrency);
      setExchangeRates(rates);
      
    } catch (error) {
      console.error('Failed to initialize global settings:', error);
      // Set defaults on error
      setLocation({
        country: 'United States',
        countryCode: 'US',
        currency: 'USD',
        vatRate: 0,
        timezone: 'America/New_York',
        locale: 'en-US',
      });
      setCurrencyState('USD');
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = (newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('beezio_currency', newCurrency);
  };

  const convertPrice = async (amount: number, fromCurrency: SupportedCurrency): Promise<number> => {
    if (fromCurrency === currency) return amount;
    
    try {
      return await convertCurrency(amount, fromCurrency, currency);
    } catch (error) {
      console.error('Price conversion failed:', error);
      return amount;
    }
  };

  const formatPrice = (amount: number, targetCurrency?: SupportedCurrency): string => {
    const currencyToUse = targetCurrency || currency;
    const currencyInfo = SUPPORTED_CURRENCIES[currencyToUse];
    
    try {
      return new Intl.NumberFormat(location?.locale || 'en-US', {
        style: 'currency',
        currency: currencyToUse,
        minimumFractionDigits: currencyInfo.decimals,
        maximumFractionDigits: currencyInfo.decimals,
      }).format(amount);
    } catch (error) {
      // Fallback formatting
      const symbol = currencyInfo.symbol;
      const formatted = amount.toFixed(currencyInfo.decimals);
      return `${symbol}${formatted}`;
    }
  };

  const refreshLocation = async () => {
    try {
      const newLocation = await getUserLocation();
      setLocation(newLocation);
      
      // Update currency if user hasn't manually set one
      const savedCurrency = localStorage.getItem('beezio_currency');
      if (!savedCurrency) {
        setCurrencyState(newLocation.currency);
      }
    } catch (error) {
      console.error('Failed to refresh location:', error);
    }
  };

  // Global language setter
  const setLanguage = (newLanguage: string) => {
    setLanguageState(newLanguage);
    localStorage.setItem('preferred-language', newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  // Global date formatter
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  // Feature availability checker
  const isFeatureAvailable = (feature: string): boolean => {
    // Basic feature availability based on location
    const country = location?.country || 'US';
    
    switch (feature) {
      case 'fundraising':
        return ['US', 'CA', 'AU', 'UK', 'DE', 'FR'].includes(country);
      case 'crypto':
        return ['US', 'CA', 'DE', 'NL', 'SG'].includes(country);
      default:
        return true;
    }
  };

  const value = {
    location,
    currency,
    exchangeRates,
    loading,
    language,
    timezone,
    setCurrency,
    setLanguage,
    convertPrice,
    formatPrice,
    formatDate,
    refreshLocation,
    isFeatureAvailable,
  };

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  );
};