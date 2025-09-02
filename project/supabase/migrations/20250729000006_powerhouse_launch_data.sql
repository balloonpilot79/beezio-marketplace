-- Powerhouse Launch Data Population
-- Creates realistic vendors, products, and marketplace activity

-- First, insert realistic vendors
INSERT INTO vendors (name, email, description, website_url, contact_phone, logo_url, is_verified, commission_rate) VALUES
('TechFlow Solutions', 'contact@techflowsolutions.com', 'Leading provider of business automation software and productivity tools', 'https://techflowsolutions.com', '+1-555-0101', 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200', true, 25.00),
('Wellness Pro', 'hello@wellnesspro.com', 'Premium health and fitness subscription services', 'https://wellnesspro.com', '+1-555-0102', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200', true, 35.00),
('EduMaster Academy', 'support@edumaster.com', 'Professional development and skill-building courses', 'https://edumaster.com', '+1-555-0103', 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=200', true, 40.00),
('Digital Growth Hub', 'team@digitalgrowth.com', 'Marketing automation and growth tools for businesses', 'https://digitalgrowth.com', '+1-555-0104', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200', true, 30.00),
('Creative Studio Pro', 'info@creativestudio.com', 'Design tools and creative software solutions', 'https://creativestudio.com', '+1-555-0105', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200', true, 28.00);

-- Insert high-value subscription products
INSERT INTO products (
  title, description, price, subscription_price, images, videos, seller_id, 
  commission_rate, commission_type, flat_commission_amount, category, tags,
  is_subscription, subscription_interval, trial_period_days, setup_fee,
  subscription_description, max_subscribers, vendor_id, is_active, stock_quantity
) VALUES 
-- TechFlow Solutions Products
(
  'Business Automation Suite Pro',
  'Complete business automation platform with CRM, email marketing, and workflow automation. Streamline your entire business operation with our all-in-one solution.',
  0, 149.99,
  ARRAY['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample1'],
  (SELECT id FROM profiles WHERE email = 'seller1@beezio.co' LIMIT 1),
  35.00, 'percentage', 0, 'Software', 
  ARRAY['automation', 'crm', 'business', 'productivity', 'saas'],
  true, 'monthly', 14, 99.00,
  'Transform your business with automated workflows, customer management, and marketing campaigns. Includes unlimited contacts, advanced reporting, and priority support.',
  10000,
  (SELECT id FROM vendors WHERE email = 'contact@techflowsolutions.com'),
  true, 999
),
(
  'Project Management Pro',
  'Advanced project management software with team collaboration, time tracking, and resource planning.',
  0, 79.99,
  ARRAY['https://images.unsplash.com/photo-1552664730-d307ca884978?w=800', 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample2'],
  (SELECT id FROM profiles WHERE email = 'seller2@beezio.co' LIMIT 1),
  30.00, 'percentage', 0, 'Software',
  ARRAY['project management', 'team collaboration', 'productivity'],
  true, 'monthly', 7, 0,
  'Manage unlimited projects with advanced Gantt charts, team workload balancing, and real-time collaboration tools.',
  5000,
  (SELECT id FROM vendors WHERE email = 'contact@techflowsolutions.com'),
  true, 999
),

-- Wellness Pro Products
(
  'Premium Fitness & Nutrition Plan',
  'Personalized fitness routines and meal plans with live coaching sessions and progress tracking.',
  0, 39.99,
  ARRAY['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample3'],
  (SELECT id FROM profiles WHERE email = 'seller3@beezio.co' LIMIT 1),
  45.00, 'percentage', 0, 'Health & Fitness',
  ARRAY['fitness', 'nutrition', 'coaching', 'health', 'wellness'],
  true, 'monthly', 7, 0,
  'Get personalized workout plans, nutrition guidance, and weekly check-ins with certified trainers. Includes mobile app access.',
  2000,
  (SELECT id FROM vendors WHERE email = 'hello@wellnesspro.com'),
  true, 999
),
(
  'Mindfulness & Meditation Masterclass',
  'Comprehensive meditation program with guided sessions, stress management techniques, and mindfulness training.',
  0, 24.99,
  ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'https://images.unsplash.com/photo-1528715471579-d1bddf5e0a96?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample4'],
  (SELECT id FROM profiles WHERE email = 'seller4@beezio.co' LIMIT 1),
  40.00, 'percentage', 0, 'Health & Fitness',
  ARRAY['meditation', 'mindfulness', 'stress relief', 'mental health'],
  true, 'monthly', 14, 0,
  'Daily guided meditations, stress-reduction techniques, and mindfulness exercises for better mental health and focus.',
  1500,
  (SELECT id FROM vendors WHERE email = 'hello@wellnesspro.com'),
  true, 999
),

-- EduMaster Academy Products
(
  'Digital Marketing Mastery Course',
  'Complete digital marketing certification program covering SEO, social media, PPC, and conversion optimization.',
  0, 199.99,
  ARRAY['https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=800', 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample5'],
  (SELECT id FROM profiles WHERE email = 'seller5@beezio.co' LIMIT 1),
  50.00, 'percentage', 0, 'Education',
  ARRAY['digital marketing', 'seo', 'social media', 'certification', 'course'],
  true, 'monthly', 30, 49.00,
  'Master digital marketing with 200+ video lessons, practical projects, industry tools, and expert mentorship. Get certified upon completion.',
  3000,
  (SELECT id FROM vendors WHERE email = 'support@edumaster.com'),
  true, 999
),
(
  'Advanced Data Analytics Bootcamp',
  'Intensive data science and analytics program with Python, SQL, and machine learning training.',
  0, 299.99,
  ARRAY['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample6'],
  (SELECT id FROM profiles WHERE email = 'seller6@beezio.co' LIMIT 1),
  45.00, 'percentage', 0, 'Education',
  ARRAY['data science', 'analytics', 'python', 'sql', 'machine learning'],
  true, 'monthly', 14, 99.00,
  'Comprehensive data science program with hands-on projects, real datasets, and career placement assistance.',
  1000,
  (SELECT id FROM vendors WHERE email = 'support@edumaster.com'),
  true, 999
),

-- Digital Growth Hub Products
(
  'Social Media Management Suite',
  'All-in-one social media scheduling, analytics, and engagement platform for businesses and agencies.',
  0, 89.99,
  ARRAY['https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800', 'https://images.unsplash.com/photo-1432888622747-4eb9a8d2c2c8?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample7'],
  (SELECT id FROM profiles WHERE email = 'seller7@beezio.co' LIMIT 1),
  35.00, 'percentage', 0, 'Marketing',
  ARRAY['social media', 'scheduling', 'analytics', 'marketing automation'],
  true, 'monthly', 14, 0,
  'Manage all social platforms from one dashboard. Schedule posts, track engagement, and automate responses across 20+ networks.',
  5000,
  (SELECT id FROM vendors WHERE email = 'team@digitalgrowth.com'),
  true, 999
),
(
  'Email Marketing Pro Platform',
  'Advanced email marketing automation with AI-powered segmentation and conversion optimization.',
  0, 129.99,
  ARRAY['https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample8'],
  (SELECT id FROM profiles WHERE email = 'seller8@beezio.co' LIMIT 1),
  40.00, 'percentage', 0, 'Marketing',
  ARRAY['email marketing', 'automation', 'ai', 'segmentation', 'conversion'],
  true, 'monthly', 14, 29.00,
  'Create high-converting email campaigns with AI optimization, advanced automation, and detailed analytics. Unlimited subscribers included.',
  2500,
  (SELECT id FROM vendors WHERE email = 'team@digitalgrowth.com'),
  true, 999
),

-- Creative Studio Pro Products
(
  'Design Suite Professional',
  'Complete design toolkit with templates, stock photos, and collaboration features for creative professionals.',
  0, 59.99,
  ARRAY['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800', 'https://images.unsplash.com/photo-1558655146-364adbc5d000?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample9'],
  (SELECT id FROM profiles WHERE email = 'seller9@beezio.co' LIMIT 1),
  32.00, 'percentage', 0, 'Design',
  ARRAY['design', 'templates', 'graphics', 'creative tools'],
  true, 'monthly', 7, 0,
  'Access 50,000+ premium templates, unlimited downloads, and professional design tools. Perfect for agencies and freelancers.',
  3000,
  (SELECT id FROM vendors WHERE email = 'info@creativestudio.com'),
  true, 999
),

-- High-value one-time products
(
  'Premium Business Consultation Package',
  'Comprehensive business strategy consultation with market analysis, growth planning, and implementation roadmap.',
  2999.00, 0,
  ARRAY['https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample10'],
  (SELECT id FROM profiles WHERE email = 'seller10@beezio.co' LIMIT 1),
  25.00, 'percentage', 0, 'Business Services',
  ARRAY['business consultation', 'strategy', 'growth planning', 'premium'],
  false, null, 0, 0,
  null, null,
  (SELECT id FROM vendors WHERE email = 'contact@techflowsolutions.com'),
  true, 50
),
(
  'Executive Leadership Coaching Program',
  'Intensive 3-month leadership development program with one-on-one coaching and peer mastermind groups.',
  4999.00, 0,
  ARRAY['https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=800', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800'],
  ARRAY['https://www.youtube.com/watch?v=sample11'],
  (SELECT id FROM profiles WHERE email = 'seller1@beezio.co' LIMIT 1),
  30.00, 'percentage', 0, 'Education',
  ARRAY['leadership', 'coaching', 'executive', 'development', 'premium'],
  false, null, 0, 0,
  null, null,
  (SELECT id FROM vendors WHERE email = 'support@edumaster.com'),
  true, 25
);

-- Update current_subscribers for subscription products to show activity
UPDATE products SET current_subscribers = FLOOR(RANDOM() * (max_subscribers * 0.3)) + 50 
WHERE is_subscription = true;

-- Insert some customer subscriptions to show active marketplace
DO $$
DECLARE
  product_record RECORD;
  customer_record RECORD;
  affiliate_record RECORD;
  subscription_count INTEGER := 0;
BEGIN
  -- Create some sample subscriptions for each subscription product
  FOR product_record IN 
    SELECT id, subscription_price FROM products WHERE is_subscription = true
  LOOP
    -- Add 15-30 subscriptions per product
    FOR i IN 1..(15 + FLOOR(RANDOM() * 15)) LOOP
      -- Get random customer and affiliate
      SELECT id INTO customer_record FROM profiles 
      WHERE role IN ('buyer', 'seller') 
      ORDER BY RANDOM() LIMIT 1;
      
      SELECT id INTO affiliate_record FROM profiles 
      WHERE role = 'affiliate' 
      ORDER BY RANDOM() LIMIT 1;
      
      -- Insert subscription
      INSERT INTO customer_subscriptions (
        customer_id, product_id, affiliate_id, status,
        current_period_start, current_period_end, next_billing_date,
        subscription_price
      ) VALUES (
        customer_record,
        product_record.id,
        affiliate_record,
        CASE WHEN RANDOM() > 0.1 THEN 'active' ELSE 'trial' END,
        NOW() - INTERVAL '1 month' * RANDOM(),
        NOW() + INTERVAL '1 month',
        NOW() + INTERVAL '1 month',
        product_record.subscription_price
      );
      
      subscription_count := subscription_count + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Created % sample subscriptions', subscription_count;
END $$;

-- Create affiliate commission records for active subscriptions
INSERT INTO affiliate_commissions (
  affiliate_id, product_id, order_id, commission_amount, commission_rate,
  status, subscription_id, is_recurring, commission_type
)
SELECT 
  cs.affiliate_id,
  cs.product_id,
  gen_random_uuid()::text,
  cs.subscription_price * (p.commission_rate / 100),
  p.commission_rate,
  'paid',
  cs.id,
  true,
  'recurring'
FROM customer_subscriptions cs
JOIN products p ON cs.product_id = p.id
WHERE cs.status = 'active' AND cs.affiliate_id IS NOT NULL;

-- Update affiliate earnings based on commissions
UPDATE profiles SET total_earnings = (
  SELECT COALESCE(SUM(commission_amount), 0)
  FROM affiliate_commissions 
  WHERE affiliate_id = profiles.id AND status = 'paid'
) WHERE role = 'affiliate';
