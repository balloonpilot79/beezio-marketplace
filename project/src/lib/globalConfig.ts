// Global configuration for Beezio International Platform

// Supported languages for the platform
export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' }
];

// Supported currencies for the platform
export const supportedCurrencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '元' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' }
];

// Global market configuration
export const globalConfig = {
  // Supported markets
  markets: [
    {
      region: 'North America',
      countries: ['US', 'CA', 'MX'],
      defaultCurrency: 'USD',
      defaultLanguage: 'en',
      languages: ['en', 'es'],
      timezones: ['America/New_York', 'America/Los_Angeles', 'America/Mexico_City']
    },
    {
      region: 'Europe',
      countries: ['DE', 'FR', 'ES', 'IT', 'NL', 'GB'],
      defaultCurrency: 'EUR',
      defaultLanguage: 'en',
      languages: ['en', 'de', 'fr', 'es'],
      timezones: ['Europe/London', 'Europe/Paris', 'Europe/Berlin']
    },
    {
      region: 'Asia Pacific',
      countries: ['JP', 'CN', 'AU', 'KR', 'SG'],
      defaultCurrency: 'USD',
      defaultLanguage: 'en',
      languages: ['en', 'zh', 'ja'],
      timezones: ['Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney']
    },
    {
      region: 'Latin America',
      countries: ['BR', 'AR', 'CL', 'CO'],
      defaultCurrency: 'USD',
      defaultLanguage: 'es',
      languages: ['es', 'pt', 'en'],
      timezones: ['America/Sao_Paulo', 'America/Buenos_Aires']
    }
  ],

  // Payment methods by region
  paymentMethods: {
    'US': ['stripe', 'paypal', 'apple_pay', 'google_pay'],
    'EU': ['stripe', 'paypal', 'sepa', 'klarna'],
    'CN': ['alipay', 'wechat_pay', 'unionpay'],
    'JP': ['stripe', 'paypal', 'konbini', 'bank_transfer'],
    'BR': ['stripe', 'paypal', 'pix', 'boleto'],
    'IN': ['razorpay', 'paytm', 'upi', 'net_banking']
  },

  // Shipping providers by region
  shippingProviders: {
    'US': ['fedex', 'ups', 'usps', 'dhl'],
    'EU': ['dhl', 'dpd', 'ups', 'local_post'],
    'CN': ['sf_express', 'ems', 'yto', 'zto'],
    'JP': ['yamato', 'sagawa', 'japan_post'],
    'BR': ['correios', 'fedex', 'dhl'],
    'AU': ['aus_post', 'fastway', 'tnt']
  },

  // Tax configurations
  taxConfig: {
    'US': { type: 'sales_tax', rate: 'variable', collectAt: 'state' },
    'EU': { type: 'vat', rate: 'variable', collectAt: 'country' },
    'CA': { type: 'gst_hst', rate: 'variable', collectAt: 'province' },
    'AU': { type: 'gst', rate: 10, collectAt: 'national' },
    'JP': { type: 'consumption_tax', rate: 10, collectAt: 'national' }
  },

  // Feature availability by market
  features: {
    fundraising: {
      available: ['US', 'CA', 'AU', 'UK', 'DE', 'FR'],
      regulations: {
        'US': { requiresRegistration: true, taxDeductible: true },
        'EU': { requiresRegistration: false, taxDeductible: false }
      }
    },
    cryptoPayments: {
      available: ['US', 'CA', 'DE', 'NL', 'SG'],
      supported: ['BTC', 'ETH', 'USDC']
    },
    socialCommerce: {
      available: 'all',
      platforms: ['instagram', 'tiktok', 'facebook', 'whatsapp']
    }
  }
};

// Utility functions for global features
export const getMarketConfig = (countryCode: string) => {
  return globalConfig.markets.find(market => 
    market.countries.includes(countryCode.toUpperCase())
  );
};

export const getCurrencyByCountry = (countryCode: string) => {
  const market = getMarketConfig(countryCode);
  return market?.defaultCurrency || 'USD';
};

export const getLanguageByCountry = (countryCode: string) => {
  const market = getMarketConfig(countryCode);
  return market?.defaultLanguage || 'en';
};

export const isFeatureAvailable = (feature: string, countryCode: string) => {
  const featureConfig = globalConfig.features[feature as keyof typeof globalConfig.features];
  if (!featureConfig) return false;
  
  if (featureConfig.available === 'all') return true;
  return featureConfig.available.includes(countryCode.toUpperCase());
};

// RTL language detection
export const isRTL = (languageCode: string) => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(languageCode);
};

// Number formatting for different locales
export const formatCurrency = (amount: number, currency: string, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Date formatting for different locales
export const formatDate = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

export default globalConfig;
