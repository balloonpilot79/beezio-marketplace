# Sample Data Management

## Overview
This application includes comprehensive sample data for products and fundraisers with high-quality images and realistic information to showcase the marketplace functionality.

## How to Control Sample Data

### Quick Toggle (Remove All Sample Data)
To remove all sample products and fundraisers from the homepage and throughout the app:

1. Open `src/config/sampleDataConfig.ts`
2. Change `ENABLE_SAMPLE_DATA: true` to `ENABLE_SAMPLE_DATA: false`
3. Save the file

The homepage will immediately stop showing sample products and fundraisers.

### Fine-Grained Control
You can also control specific types of sample data:

```typescript
export const SAMPLE_DATA_CONFIG = {
  // Master switch for all sample data
  ENABLE_SAMPLE_DATA: true,
  
  // Individual toggles (all depend on master switch)
  ENABLE_SAMPLE_PRODUCTS: true,      // Controls product slider
  ENABLE_SAMPLE_FUNDRAISERS: true,   // Controls fundraiser slider
  ENABLE_SAMPLE_REVIEWS: true,       // Future: product reviews
  ENABLE_SAMPLE_STORES: true,        // Future: sample seller stores
};
```

## Sample Data Included

### Products (30 items across 6 categories)
- **Electronics**: Headphones, phone accessories, smart devices
- **Fashion**: Handbags, clothing, accessories  
- **Home & Garden**: Lamps, plants, kitchen items
- **Books**: Educational and lifestyle guides
- **Sports**: Exercise equipment, athletic gear
- **Beauty**: Skincare, makeup, wellness products

All products include:
- High-quality Unsplash images
- Realistic pricing ($24.99 - $299.99)
- Star ratings (4.5-4.9)
- Review counts (200-1500)
- Detailed descriptions
- Seller information

### Fundraisers (12 causes across multiple categories)
- **Humanitarian**: Water wells, disaster relief
- **Animals**: Shelter support, wildlife conservation
- **Education**: Scholarships, school programs
- **Health/Medical**: Cancer support, mental health
- **Community**: Gardens, senior centers
- **Environment**: Reforestation, climate action

All fundraisers include:
- Professional cause images
- Realistic funding goals ($5,000 - $50,000)
- Progress tracking with raised amounts
- Supporter counts (90-900 people)
- Location information
- Compelling cause descriptions
- Creator organization names

## Image Sources
All images are from Unsplash.com with proper attribution and commercial usage rights.

## Performance
Sample data is loaded dynamically and only when enabled. Disabling sample data reduces initial load time and bundle size.
