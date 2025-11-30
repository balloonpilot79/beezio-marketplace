import { SupportedCurrency, COUNTRY_CURRENCY_MAP, VAT_RATES } from './stripe';

export interface LocationData {
  country: string;
  countryCode: string;
  currency: SupportedCurrency;
  vatRate: number;
  timezone: string;
  locale: string;
}

// Default location (fallback)
const DEFAULT_LOCATION: LocationData = {
  country: 'United States',
  countryCode: 'US',
  currency: 'USD',
  vatRate: 0,
  timezone: 'America/New_York',
  locale: 'en-US',
};

// Get user's location data
export const getUserLocation = async (): Promise<LocationData> => {
  // Disabled remote geolocation in browser to avoid CORS issues; always return default
  return DEFAULT_LOCATION;
};

// Get locale from country code
const getLocaleFromCountry = (countryCode: string): string => {
  const localeMap: Record<string, string> = {
    US: 'en-US', CA: 'en-CA', GB: 'en-GB', AU: 'en-AU',
    DE: 'de-DE', FR: 'fr-FR', IT: 'it-IT', ES: 'es-ES',
    NL: 'nl-NL', BE: 'nl-BE', AT: 'de-AT', CH: 'de-CH',
    SE: 'sv-SE', NO: 'nb-NO', DK: 'da-DK', FI: 'fi-FI',
    PL: 'pl-PL', CZ: 'cs-CZ', HU: 'hu-HU', SK: 'sk-SK',
    BG: 'bg-BG', RO: 'ro-RO', HR: 'hr-HR', SI: 'sl-SI',
    EE: 'et-EE', LV: 'lv-LV', LT: 'lt-LT', GR: 'el-GR',
    CY: 'el-CY', MT: 'mt-MT', IE: 'en-IE', LU: 'fr-LU',
    PT: 'pt-PT', JP: 'ja-JP', IN: 'en-IN', SG: 'en-SG',
    HK: 'en-HK', MX: 'es-MX', BR: 'pt-BR',
  };
  
  return localeMap[countryCode] || 'en-US';
};

// Calculate shipping cost based on location
export const calculateShippingCost = (
  countryCode: string,
  weight: number = 1,
  value: number = 0
): number => {
  // Shipping zones and rates
  const shippingZones = {
    domestic: ['US'], // Free shipping for domestic
    zone1: ['CA', 'MX'], // North America
    zone2: ['GB', 'IE'], // UK & Ireland
    zone3: [ // EU
      'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH',
      'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'SK',
      'BG', 'RO', 'HR', 'SI', 'EE', 'LV', 'LT', 'GR',
      'CY', 'MT', 'LU', 'PT'
    ],
    zone4: ['AU', 'NZ'], // Oceania
    zone5: ['JP', 'SG', 'HK'], // Asia Pacific
    zone6: ['IN', 'BR'], // Other international
  };
  
  const baseRates = {
    domestic: 0, // Free domestic shipping
    zone1: 15,
    zone2: 20,
    zone3: 25,
    zone4: 35,
    zone5: 30,
    zone6: 40,
  };
  
  // Find which zone the country belongs to
  let zone = 'zone6'; // Default to most expensive
  for (const [zoneName, countries] of Object.entries(shippingZones)) {
    if (countries.includes(countryCode)) {
      zone = zoneName;
      break;
    }
  }
  
  const baseRate = baseRates[zone as keyof typeof baseRates];
  
  // Add weight-based surcharge (per kg over 1kg)
  const weightSurcharge = Math.max(0, weight - 1) * 5;
  
  // Add insurance for high-value items
  const insuranceFee = value > 500 ? value * 0.01 : 0;
  
  return baseRate + weightSurcharge + insuranceFee;
};

// Get currency exchange rates (you would typically use a real API)
export const getExchangeRates = async (baseCurrency: SupportedCurrency = 'USD'): Promise<Record<string, number>> => {
  try {
    // In production, use a real exchange rate API like:
    // - Fixer.io
    // - CurrencyAPI
    // - Open Exchange Rates
    
    // For demo purposes, using mock rates
    const mockRates: Record<string, number> = {
      USD: 1.0,
      EUR: 0.85,
      GBP: 0.73,
      CAD: 1.25,
      AUD: 1.35,
      JPY: 110.0,
      CHF: 0.92,
      SEK: 8.5,
      NOK: 8.8,
      DKK: 6.3,
      PLN: 3.9,
      CZK: 21.5,
      HUF: 295.0,
      BGN: 1.66,
      RON: 4.2,
      HRK: 6.4,
      INR: 74.0,
      SGD: 1.35,
      HKD: 7.8,
      MXN: 20.0,
      BRL: 5.2,
    };
    
    return mockRates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    // Return 1:1 rates as fallback
    return Object.keys(COUNTRY_CURRENCY_MAP).reduce((acc, curr) => {
      acc[curr] = 1.0;
      return acc;
    }, {} as Record<string, number>);
  }
};

// Convert price between currencies
export const convertCurrency = async (
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;
  
  try {
    const rates = await getExchangeRates('USD');
    
    // Convert to USD first, then to target currency
    const usdAmount = fromCurrency === 'USD' ? amount : amount / rates[fromCurrency];
    const convertedAmount = toCurrency === 'USD' ? usdAmount : usdAmount * rates[toCurrency];
    
    return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Currency conversion failed:', error);
    return amount; // Return original amount on error
  }
};
