// Sample Data Configuration
// This file controls all sample data across the application
// Set VITE_ENABLE_SAMPLE_DATA=false in your .env to disable sample products and fundraisers globally

const toBoolean = (value: string | boolean | undefined, defaultValue: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
  return defaultValue;
};

const ENABLE_SAMPLE_DATA = toBoolean(import.meta.env.VITE_ENABLE_SAMPLE_DATA, false);

export const SAMPLE_DATA_CONFIG = {
  // Master switch for all sample data
  ENABLE_SAMPLE_DATA,
  
  // Individual toggles (all depend on master switch)
  ENABLE_SAMPLE_PRODUCTS: ENABLE_SAMPLE_DATA,
  ENABLE_SAMPLE_FUNDRAISERS: ENABLE_SAMPLE_DATA,
  ENABLE_SAMPLE_REVIEWS: ENABLE_SAMPLE_DATA,
  ENABLE_SAMPLE_STORES: ENABLE_SAMPLE_DATA,
  
  // Sample data counts
  PRODUCTS_PER_SLIDER: 12,
  FUNDRAISERS_PER_SLIDER: 9,
  PRODUCTS_PER_CATEGORY: 5,
  
  // Debug mode - shows sample data indicators
  DEBUG_SAMPLE_DATA: false
};

// Helper function to check if sample data is enabled
export const isSampleDataEnabled = () => SAMPLE_DATA_CONFIG.ENABLE_SAMPLE_DATA;

// Helper function to check specific sample data types
export const isProductSampleDataEnabled = () => 
  SAMPLE_DATA_CONFIG.ENABLE_SAMPLE_DATA && SAMPLE_DATA_CONFIG.ENABLE_SAMPLE_PRODUCTS;

export const isFundraiserSampleDataEnabled = () => 
  SAMPLE_DATA_CONFIG.ENABLE_SAMPLE_DATA && SAMPLE_DATA_CONFIG.ENABLE_SAMPLE_FUNDRAISERS;

export default SAMPLE_DATA_CONFIG;
