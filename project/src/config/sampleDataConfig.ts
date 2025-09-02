// Sample Data Configuration
// This file controls all sample data across the application
// Set ENABLE_SAMPLE_DATA to false to remove all sample products and fundraisers

export const SAMPLE_DATA_CONFIG = {
  // Master switch for all sample data
  ENABLE_SAMPLE_DATA: true,
  
  // Individual toggles (all depend on master switch)
  ENABLE_SAMPLE_PRODUCTS: true,
  ENABLE_SAMPLE_FUNDRAISERS: true,
  ENABLE_SAMPLE_REVIEWS: true,
  ENABLE_SAMPLE_STORES: true,
  
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
