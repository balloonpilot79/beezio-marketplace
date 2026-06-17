// Currency + tax utilities (payment-processor agnostic)

export const SUPPORTED_CURRENCIES = {
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  CAD: { symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  JPY: { symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CHF: { symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
  SEK: { symbol: 'kr', decimals: 2, name: 'Swedish Krona' },
  NOK: { symbol: 'kr', decimals: 2, name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', decimals: 2, name: 'Danish Krone' },
  PLN: { symbol: 'zł', decimals: 2, name: 'Polish Złoty' },
  CZK: { symbol: 'Kč', decimals: 2, name: 'Czech Koruna' },
  HUF: { symbol: 'Ft', decimals: 0, name: 'Hungarian Forint' },
  BGN: { symbol: 'лв', decimals: 2, name: 'Bulgarian Lev' },
  RON: { symbol: 'lei', decimals: 2, name: 'Romanian Leu' },
  HRK: { symbol: 'kn', decimals: 2, name: 'Croatian Kuna' },
  INR: { symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  SGD: { symbol: 'S$', decimals: 2, name: 'Singapore Dollar' },
  HKD: { symbol: 'HK$', decimals: 2, name: 'Hong Kong Dollar' },
  MXN: { symbol: '$', decimals: 2, name: 'Mexican Peso' },
  BRL: { symbol: 'R$', decimals: 2, name: 'Brazilian Real' },
} as const;

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES;

export const COUNTRY_CURRENCY_MAP: Record<string, SupportedCurrency> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  AU: 'AUD',
  JP: 'JPY',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  BG: 'BGN',
  RO: 'RON',
  HR: 'HRK',
  IN: 'INR',
  SG: 'SGD',
  HK: 'HKD',
  MX: 'MXN',
  BR: 'BRL',
  // EU countries default to EUR
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  LU: 'EUR',
  SI: 'EUR',
  SK: 'EUR',
  EE: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  CY: 'EUR',
  MT: 'EUR',
};

// VAT rates by country (percentage)
export const VAT_RATES: Record<string, number> = {
  // EU VAT rates
  AT: 20,
  BE: 21,
  BG: 20,
  HR: 25,
  CY: 19,
  CZ: 21,
  DK: 25,
  EE: 20,
  FI: 24,
  FR: 20,
  DE: 19,
  GR: 24,
  HU: 27,
  IE: 23,
  IT: 22,
  LV: 21,
  LT: 21,
  LU: 17,
  MT: 18,
  NL: 21,
  PL: 23,
  PT: 23,
  RO: 19,
  SK: 20,
  SI: 22,
  ES: 21,
  // Other countries
  GB: 20,
  CH: 7.7,
  NO: 25,
  AU: 10,
  CA: 5,
  IN: 18,
  SG: 7,
  JP: 10,
  US: 0,
};

export const formatCurrency = (amount: number, currency: SupportedCurrency, locale?: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency];

  try {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currencyInfo.decimals,
      maximumFractionDigits: currencyInfo.decimals,
    }).format(amount);
  } catch {
    const formatted = amount.toFixed(currencyInfo.decimals);
    return `${currencyInfo.symbol}${formatted}`;
  }
};
