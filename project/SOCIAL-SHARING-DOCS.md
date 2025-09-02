# Social Sharing System Documentation

## Overview
The social sharing system allows users to share products across multiple social media platforms, similar to Amazon's sharing functionality. It integrates with the gamification system to track and reward social sharing activities.

## Components

### 1. SocialShareButton
**File**: `/src/components/SocialShareButton.tsx`

A comprehensive sharing component with multiple variants:
- **Button variant**: Full share button with modal
- **Icon variant**: Icon-only button for compact spaces
- **Floating variant**: Fixed floating button for mobile

**Features**:
- 5 major social platforms (Facebook, Twitter, LinkedIn, WhatsApp, Email)
- Copy link functionality
- Native Web Share API support
- Product preview in share modal
- Affiliate link integration
- Gamification tracking

**Usage**:
```tsx
<SocialShareButton 
  product={product}
  affiliateCode={affiliateCode}
  variant="button" // or "icon" or "floating"
  size="md" // sm, md, lg
/>
```

### 2. ShareableProductCard
**File**: `/src/components/ShareableProductCard.tsx`

Enhanced product card with built-in sharing:
- **Grid variant**: Standard grid layout
- **List variant**: Horizontal list layout  
- **Featured variant**: Large featured product display

**Features**:
- Integrated share buttons
- Wishlist functionality
- Commission info for affiliates
- Rating display
- Seller information

### 3. ProductDetailPage
**File**: `/src/pages/ProductDetailPage.tsx`

Complete product detail page with:
- Large social share section
- Floating share button for mobile
- Affiliate tools section
- Product gallery and details

## Supported Platforms

### Primary Platforms
1. **Facebook** - Standard Facebook sharing
2. **Twitter** - Tweet with hashtags
3. **LinkedIn** - Professional network sharing
4. **WhatsApp** - Mobile messaging
5. **Email** - Traditional email sharing

### Additional Features
- **Copy Link** - One-click link copying
- **Native Share** - Uses device's native share menu (mobile)

## Share URLs and Formats

### Facebook
```
https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${title + description}
```

### Twitter
```
https://twitter.com/intent/tweet?url=${url}&text=${title + description}&hashtags=shopping,deals
```

### LinkedIn
```
https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${description}
```

### WhatsApp
```
https://wa.me/?text=${title + description + url}
```

### Email
```
mailto:?subject=${title}&body=${description + url}
```

## Gamification Integration

### Automatic Tracking
- **Product Views**: Tracked when affiliate links are accessed
- **Social Shares**: Tracked when users share or copy links
- **Badge Progress**: Sharing contributes to social badges

### Social Sharing Badges
- **Sharer**: 50 shares (100 points)
- **Social Butterfly**: 200 shares (300 points)  
- **Brand Ambassador**: 1000 shares (600 points)

## Implementation Details

### Affiliate Link Integration
```tsx
const getProductUrl = () => {
  const baseUrl = `${window.location.origin}/product/${product.id}`;
  return affiliateCode ? `${baseUrl}?ref=${affiliateCode}` : baseUrl;
};
```

### Share Text Generation
```tsx
const getShareText = () => {
  const sellerText = product.profiles?.full_name ? ` by ${product.profiles.full_name}` : '';
  return {
    title: `Check out: ${product.title}${sellerText}`,
    description: product.description || `Amazing product for only $${product.price}! Don't miss out on this great deal.`,
    url: getProductUrl()
  };
};
```

### Native Share API
```tsx
const handleNativeShare = async () => {
  if (navigator.share) {
    await navigator.share({
      title,
      text: description,
      url
    });
  }
};
```

## Usage Examples

### Basic Product Grid
```tsx
import SocialShareButton from './SocialShareButton';

// In ProductGrid component
<SocialShareButton 
  product={product}
  variant="icon"
  size="sm"
/>
```

### Product Detail Page
```tsx
<SocialShareButton 
  product={product}
  affiliateCode={affiliateCode}
  size="lg"
  className="w-full"
/>
```

### Floating Mobile Button
```tsx
<SocialShareButton 
  product={product}
  variant="floating"
/>
```

### Affiliate Integration
```tsx
// For affiliates
<SocialShareButton 
  product={product}
  affiliateCode={userAffiliateCode}
  showCommissionInfo={true}
/>
```

## Styling and Customization

### Platform Colors
- Facebook: `bg-blue-600`
- Twitter: `bg-sky-500`
- LinkedIn: `bg-blue-700`
- WhatsApp: `bg-green-500`
- Email: `bg-gray-600`

### Size Variants
- **Small**: `w-4 h-4`, `px-3 py-1.5`
- **Medium**: `w-5 h-5`, `px-4 py-2`
- **Large**: `w-6 h-6`, `px-6 py-3`

### Responsive Design
- Desktop: Full modal with all platforms
- Mobile: Native share API + floating button
- Hover effects on desktop only

## Browser Support

### Required Features
- **Clipboard API**: For copy link functionality
- **Web Share API**: For native sharing (optional)
- **PopUp windows**: For social platform sharing

### Fallbacks
- Copy link falls back to text selection
- Native share falls back to modal
- All platforms work without JavaScript (progressive enhancement)

## Performance Considerations

### Lazy Loading
- Icons loaded only when needed
- Share modals rendered conditionally
- Platform detection on mount

### Tracking Efficiency
- Debounced share tracking
- Async gamification updates
- Error handling for failed requests

## Testing

### Test Cases
1. **Share to each platform** - Verify correct URLs
2. **Copy link functionality** - Test clipboard access
3. **Affiliate link generation** - Verify ref parameter
4. **Mobile native share** - Test on mobile devices
5. **Gamification tracking** - Verify badge progress

### Browser Testing
- Chrome, Firefox, Safari, Edge
- Mobile Safari, Chrome Mobile
- Various screen sizes and orientations

## Future Enhancements

### Additional Platforms
- Instagram Stories
- TikTok sharing
- Pinterest pins
- Reddit posts
- Telegram channels

### Advanced Features
- Share analytics dashboard
- A/B testing for share text
- Custom share images
- Share scheduling
- Referral tracking

### Integration Options
- QR code sharing
- Social media management tools
- Email marketing integration
- Influencer partnership tools

## Files Created
- `/src/components/SocialShareButton.tsx` - Main sharing component
- `/src/components/ShareableProductCard.tsx` - Enhanced product cards
- `/src/pages/ProductDetailPage.tsx` - Product detail page with sharing
- `/src/lib/socialSharing.ts` - Utility functions and configurations

The social sharing system is now fully integrated and ready to boost product virality and affiliate engagement! 🚀
