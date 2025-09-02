# Sample Data Setup

This directory contains scripts and data to populate your Beezio marketplace with sample listings for testing and demonstration purposes.

## Files

- `sample-data.sql` - Raw SQL script to insert sample data directly into the database
- `populate-sample-data.js` - Node.js script to populate data via Supabase client
- `src/lib/sampleData.ts` - Fallback sample data for when Supabase is not configured

## Quick Start

### Option 1: Automatic Fallback (Recommended for Testing)
If Supabase is not configured or there are connection issues, the app will automatically use sample data from `src/lib/sampleData.ts`. This ensures the marketplace always has products to display.

### Option 2: Populate Database via Script
If you have Supabase configured and want to add real data:

1. Add your Supabase service role key to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. Run the population script:
   ```bash
   npm run populate-db
   ```

### Option 3: Manual SQL Import
If you have direct database access:

1. Run the SQL script in your Supabase SQL editor:
   ```sql
   -- Copy and paste contents of sample-data.sql
   ```

## Sample Data Includes

- **8 Diverse Products**: Electronics, crafts, local goods, digital courses, subscriptions
- **5 Sample Sellers**: Different types of businesses and individuals
- **Various Commission Types**: Percentage-based and flat-rate commissions
- **Subscription Products**: Monthly coffee and weekly meal kits
- **Local Business Items**: Honey, tea, and other local products
- **High-Value Services**: Consulting and web development

## Product Categories

- 📱 **Tech & Electronics**: Headphones, smartwatch
- 🧳 **Fashion & Accessories**: Leather wallet, sunglasses
- 🍯 **Local & Organic**: Honey, herbal tea
- 📚 **Digital Courses**: Marketing, photography
- ☕ **Subscriptions**: Coffee, meal kits
- 💼 **Professional Services**: Consulting, web development

## Commission Examples

- **High Commission (25-40%)**: Digital courses, consulting services
- **Medium Commission (10-20%)**: Electronics, fitness products
- **Low Commission (8-12%)**: Local goods, handmade items
- **Flat Rate ($10-25)**: Accessories, small items

This sample data demonstrates all the key features of the Beezio marketplace including different seller types, commission structures, subscription products, and local business integration.
