# Gamification System Documentation

## Overview
The gamification system adds badges, levels, points, and leaderboards to motivate affiliates and increase engagement.

## Database Schema

### Tables Created:
- `badge_types` - Defines available badges with requirements
- `user_badges` - Tracks earned badges for each user
- `affiliate_stats` - Stores performance metrics for affiliates
- `leaderboard_entries` - Historical leaderboard data (for future use)

### Badge Categories:
1. **Sales Count** - Based on number of sales made
2. **Commission Earned** - Based on total commission earned
3. **Referrals** - Based on number of affiliates referred
4. **Streaks** - Based on consecutive days with sales
5. **Engagement** - Based on product views generated
6. **Social Sharing** - Based on affiliate links shared

## Components

### BadgeDisplay
- Shows individual badges with tooltips
- Different sizes (sm, md, lg)
- Progress bars for unearned badges
- Tier-based styling (bronze, silver, gold, platinum, diamond)

### AffiliateGamification
- Main dashboard component for affiliates
- Shows level, points, badges, and stats
- Tabbed interface (Overview, Badges, Leaderboard)

### BadgeNotification
- Toast-style notifications when badges are earned
- Auto-dismiss after 5 seconds
- Celebration animations

### MiniLeaderboard
- Shows top performers in different metrics
- Configurable timeframes and metrics

## Tracking Functions

### Available Tracking Methods:
```typescript
const { trackProductView, trackSocialShare, trackSale, trackReferral } = useGamificationContext();

// Track when someone views an affiliate product
await trackProductView(productId);

// Track when affiliate shares a link
await trackSocialShare(productId);

// Track when a sale is completed
await trackSale(commissionAmount);

// Track when someone signs up with referral code
await trackReferral();
```

## Badge Requirements

### Sales Badges:
- First Sale: 1 sale (100 points)
- Sales Rookie: 5 sales (250 points)
- Sales Pro: 25 sales (500 points)
- Sales Expert: 100 sales (1000 points)
- Sales Master: 500 sales (2500 points)
- Sales Legend: 1000 sales (5000 points)

### Commission Badges:
- First Dollar: $1 commission (50 points)
- Hundred Club: $100 commission (200 points)
- Thousand Club: $1,000 commission (500 points)
- Five K Club: $5,000 commission (1000 points)
- Ten K Club: $10,000 commission (2000 points)
- High Roller: $50,000 commission (5000 points)

### Other Badges:
- Networking, Team Building, Community Leadership (referrals)
- Consistency, Dedication, Unstoppable (streaks)
- Popular, Viral, Influencer (product views)
- Sharer, Social Butterfly, Brand Ambassador (social shares)

## Level System
- Every 1000 points = 1 level
- Level displayed prominently in dashboard
- Progress bar shows progress to next level

## Integration Points

### Automatic Tracking:
- **Product Views**: Tracked when affiliate links are clicked
- **Social Shares**: Tracked when affiliate links are copied
- **Sales**: Need to be integrated with payment processing
- **Referrals**: Need to be integrated with signup process

### Manual Testing:
To test the badge system, you can run SQL commands directly:

```sql
-- Add test stats for a user
INSERT INTO affiliate_stats (user_id, total_sales, total_commission_earned, total_referrals, current_streak_days, total_product_views, total_social_shares) 
VALUES ('your-user-id', 5, 150.00, 2, 7, 1000, 50)
ON CONFLICT (user_id) DO UPDATE SET
  total_sales = EXCLUDED.total_sales,
  total_commission_earned = EXCLUDED.total_commission_earned,
  total_referrals = EXCLUDED.total_referrals,
  current_streak_days = EXCLUDED.current_streak_days,
  total_product_views = EXCLUDED.total_product_views,
  total_social_shares = EXCLUDED.total_social_shares;

-- Check for badges (this will award badges if requirements are met)
SELECT check_and_award_badges('your-user-id');
```

## Future Enhancements
1. **Seasonal Badges** - Limited-time achievement badges
2. **Team Challenges** - Group competitions between affiliates
3. **Milestone Rewards** - Physical rewards for major achievements
4. **Social Features** - Badge sharing on social media
5. **Custom Challenges** - Admin-created special challenges

## Testing the System
1. Navigate to affiliate dashboard
2. Copy affiliate links (should track social shares)
3. Generate affiliate links (should track activity)
4. Use the database functions to simulate sales and track progress
5. Check for badge notifications and level progress

## Files Created
- `/supabase/migrations/20250722010000_add_badges_gamification.sql`
- `/src/components/BadgeDisplay.tsx`
- `/src/components/AffiliateGamification.tsx`
- `/src/components/BadgeNotification.tsx`
- `/src/components/MiniLeaderboard.tsx`
- `/src/hooks/useGamification.ts`
- `/src/contexts/GamificationContext.tsx`
