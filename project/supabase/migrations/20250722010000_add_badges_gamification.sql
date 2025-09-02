-- Add badges and gamification system for affiliates

-- Create badge_types table to define available badges
CREATE TABLE IF NOT EXISTS badge_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL, -- Lucide icon name
  color VARCHAR(20) NOT NULL, -- Tailwind color class
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  requirement_type VARCHAR(50) NOT NULL CHECK (requirement_type IN ('sales_count', 'commission_earned', 'referrals', 'streak_days', 'product_views', 'social_shares')),
  requirement_value INTEGER NOT NULL,
  points_reward INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_badges table to track earned badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type_id UUID NOT NULL REFERENCES badge_types(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  progress_value INTEGER DEFAULT 0, -- Current progress towards next tier
  UNIQUE(user_id, badge_type_id)
);

-- Create affiliate_stats table to track performance metrics
CREATE TABLE IF NOT EXISTS affiliate_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_sales INTEGER DEFAULT 0,
  total_commission_earned DECIMAL(10,2) DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  total_product_views INTEGER DEFAULT 0,
  total_social_shares INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  last_sale_date TIMESTAMP WITH TIME ZONE,
  last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create leaderboard_entries table for competitive elements
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rank INTEGER NOT NULL,
  sales_count INTEGER DEFAULT 0,
  commission_earned DECIMAL(10,2) DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);

-- Insert default badge types
INSERT INTO badge_types (name, description, icon, color, tier, requirement_type, requirement_value, points_reward) VALUES
-- Sales Count Badges
('First Sale', 'Make your first sale', 'Trophy', 'amber', 'bronze', 'sales_count', 1, 100),
('Sales Rookie', 'Make 5 sales', 'Award', 'amber', 'bronze', 'sales_count', 5, 250),
('Sales Pro', 'Make 25 sales', 'Medal', 'gray', 'silver', 'sales_count', 25, 500),
('Sales Expert', 'Make 100 sales', 'Crown', 'yellow', 'gold', 'sales_count', 100, 1000),
('Sales Master', 'Make 500 sales', 'Gem', 'purple', 'platinum', 'sales_count', 500, 2500),
('Sales Legend', 'Make 1000 sales', 'Star', 'blue', 'diamond', 'sales_count', 1000, 5000),

-- Commission Earned Badges
('First Dollar', 'Earn your first dollar in commission', 'DollarSign', 'green', 'bronze', 'commission_earned', 1, 50),
('Hundred Club', 'Earn $100 in commission', 'Banknote', 'green', 'bronze', 'commission_earned', 100, 200),
('Thousand Club', 'Earn $1,000 in commission', 'PiggyBank', 'gray', 'silver', 'commission_earned', 1000, 500),
('Five K Club', 'Earn $5,000 in commission', 'Wallet', 'yellow', 'gold', 'commission_earned', 5000, 1000),
('Ten K Club', 'Earn $10,000 in commission', 'CreditCard', 'purple', 'platinum', 'commission_earned', 10000, 2000),
('High Roller', 'Earn $50,000 in commission', 'Diamond', 'blue', 'diamond', 'commission_earned', 50000, 5000),

-- Referral Badges
('Networker', 'Refer 5 new affiliates', 'Users', 'blue', 'bronze', 'referrals', 5, 300),
('Team Builder', 'Refer 25 new affiliates', 'UserPlus', 'gray', 'silver', 'referrals', 25, 750),
('Community Leader', 'Refer 100 new affiliates', 'Crown', 'yellow', 'gold', 'referrals', 100, 1500),

-- Streak Badges
('Consistent', 'Maintain a 7-day sales streak', 'Flame', 'orange', 'bronze', 'streak_days', 7, 200),
('Dedicated', 'Maintain a 30-day sales streak', 'Fire', 'orange', 'silver', 'streak_days', 30, 600),
('Unstoppable', 'Maintain a 90-day sales streak', 'Zap', 'yellow', 'gold', 'streak_days', 90, 1200),

-- Engagement Badges
('Popular', 'Get 1,000 product views', 'Eye', 'indigo', 'bronze', 'product_views', 1000, 150),
('Viral', 'Get 10,000 product views', 'TrendingUp', 'gray', 'silver', 'product_views', 10000, 400),
('Influencer', 'Get 100,000 product views', 'Globe', 'yellow', 'gold', 'product_views', 100000, 800),

-- Social Sharing Badges
('Sharer', 'Share products 50 times', 'Share', 'pink', 'bronze', 'social_shares', 50, 100),
('Social Butterfly', 'Share products 200 times', 'Share2', 'gray', 'silver', 'social_shares', 200, 300),
('Brand Ambassador', 'Share products 1000 times', 'Megaphone', 'yellow', 'gold', 'social_shares', 1000, 600);

-- Function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  stats_record affiliate_stats%ROWTYPE;
  badge_record badge_types%ROWTYPE;
BEGIN
  -- Get current user stats
  SELECT * INTO stats_record FROM affiliate_stats WHERE user_id = p_user_id;
  
  -- If no stats record exists, create one
  IF NOT FOUND THEN
    INSERT INTO affiliate_stats (user_id) VALUES (p_user_id);
    SELECT * INTO stats_record FROM affiliate_stats WHERE user_id = p_user_id;
  END IF;
  
  -- Check each badge type
  FOR badge_record IN SELECT * FROM badge_types WHERE is_active = true LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_type_id = badge_record.id) THEN
      -- Check if requirements are met
      CASE badge_record.requirement_type
        WHEN 'sales_count' THEN
          IF stats_record.total_sales >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.total_sales);
            
            -- Award points
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
          
        WHEN 'commission_earned' THEN
          IF stats_record.total_commission_earned >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.total_commission_earned::INTEGER);
            
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
          
        WHEN 'referrals' THEN
          IF stats_record.total_referrals >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.total_referrals);
            
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
          
        WHEN 'streak_days' THEN
          IF stats_record.current_streak_days >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.current_streak_days);
            
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
          
        WHEN 'product_views' THEN
          IF stats_record.total_product_views >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.total_product_views);
            
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
          
        WHEN 'social_shares' THEN
          IF stats_record.total_social_shares >= badge_record.requirement_value THEN
            INSERT INTO user_badges (user_id, badge_type_id, progress_value) 
            VALUES (p_user_id, badge_record.id, stats_record.total_social_shares);
            
            UPDATE affiliate_stats 
            SET total_points = total_points + badge_record.points_reward
            WHERE user_id = p_user_id;
          END IF;
      END CASE;
    END IF;
  END LOOP;
  
  -- Update user level based on total points
  UPDATE affiliate_stats 
  SET level = GREATEST(1, (total_points / 1000) + 1)
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update affiliate stats (called when sales are made)
CREATE OR REPLACE FUNCTION update_affiliate_stats(
  p_user_id UUID,
  p_commission_amount DECIMAL DEFAULT 0,
  p_is_referral BOOLEAN DEFAULT false,
  p_product_view BOOLEAN DEFAULT false,
  p_social_share BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
DECLARE
  current_date DATE := CURRENT_DATE;
  last_sale DATE;
BEGIN
  -- Insert or update affiliate stats
  INSERT INTO affiliate_stats (user_id, last_activity_date) 
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    last_activity_date = now();
  
  -- Update based on action type
  IF p_commission_amount > 0 THEN
    -- This is a sale
    SELECT last_sale_date::DATE INTO last_sale FROM affiliate_stats WHERE user_id = p_user_id;
    
    UPDATE affiliate_stats SET
      total_sales = total_sales + 1,
      total_commission_earned = total_commission_earned + p_commission_amount,
      last_sale_date = now(),
      current_streak_days = CASE 
        WHEN last_sale IS NULL OR last_sale = current_date - INTERVAL '1 day' THEN current_streak_days + 1
        WHEN last_sale = current_date THEN current_streak_days -- Same day, don't change streak
        ELSE 1 -- Reset streak
      END
    WHERE user_id = p_user_id;
    
    -- Update longest streak if current is longer
    UPDATE affiliate_stats SET
      longest_streak_days = GREATEST(longest_streak_days, current_streak_days)
    WHERE user_id = p_user_id;
  END IF;
  
  IF p_is_referral THEN
    UPDATE affiliate_stats SET
      total_referrals = total_referrals + 1
    WHERE user_id = p_user_id;
  END IF;
  
  IF p_product_view THEN
    UPDATE affiliate_stats SET
      total_product_views = total_product_views + 1
    WHERE user_id = p_user_id;
  END IF;
  
  IF p_social_share THEN
    UPDATE affiliate_stats SET
      total_social_shares = total_social_shares + 1
    WHERE user_id = p_user_id;
  END IF;
  
  -- Check for new badges
  PERFORM check_and_award_badges(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Set up Row Level Security
ALTER TABLE badge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view badge types" ON badge_types FOR SELECT USING (true);
CREATE POLICY "Anyone can view user badges" ON user_badges FOR SELECT USING (true);
CREATE POLICY "Users can view their own badges" ON user_badges FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view affiliate stats" ON affiliate_stats FOR SELECT USING (true);
CREATE POLICY "Users can update their own stats" ON affiliate_stats FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view leaderboard" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "System can manage leaderboard" ON leaderboard_entries FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_type_id ON user_badges(badge_type_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_stats_user_id ON affiliate_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_stats_total_points ON affiliate_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_entries(period_type, period_start, rank);
