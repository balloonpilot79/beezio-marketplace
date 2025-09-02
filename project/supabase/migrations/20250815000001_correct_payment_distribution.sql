-- Corrected payment distribution function
-- Ensures sellers get 100% of desired amount, with all fees added on top

-- Function to calculate correct payment distribution
CREATE OR REPLACE FUNCTION calculate_payment_distribution(
  seller_desired_amount DECIMAL,
  affiliate_rate DECIMAL DEFAULT 0,
  affiliate_type TEXT DEFAULT 'percentage' -- 'percentage' or 'flat_rate'
)
RETURNS TABLE(
  seller_amount DECIMAL,
  affiliate_amount DECIMAL,
  platform_fee DECIMAL,
  stripe_fee DECIMAL,
  total_listing_price DECIMAL
) AS $$
DECLARE
  affiliate_commission DECIMAL;
  platform_commission DECIMAL;
  before_stripe DECIMAL;
  stripe_commission DECIMAL;
BEGIN
  -- Step 1: Seller gets exactly what they want
  seller_amount := seller_desired_amount;
  
  -- Step 2: Calculate affiliate commission
  IF affiliate_type = 'flat_rate' THEN
    affiliate_commission := affiliate_rate;
  ELSE
    affiliate_commission := seller_desired_amount * (affiliate_rate / 100);
  END IF;
  affiliate_amount := affiliate_commission;
  
  -- Step 3: Platform fee = 10% of seller's desired amount (NOT total)
  platform_commission := seller_desired_amount * 0.10;
  platform_fee := platform_commission;
  
  -- Step 4: Calculate Stripe fee (3% of subtotal)
  before_stripe := seller_desired_amount + affiliate_commission + platform_commission;
  stripe_commission := before_stripe * 0.03;
  stripe_fee := stripe_commission;
  
  -- Step 5: Final listing price = Seller + 10% + Affiliate + 3%
  total_listing_price := before_stripe + stripe_commission;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to process order with correct fee distribution
CREATE OR REPLACE FUNCTION process_order_payment(
  order_id UUID,
  payment_intent_id TEXT,
  total_paid DECIMAL,
  items JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  seller_payouts JSONB,
  affiliate_payouts JSONB,
  platform_revenue DECIMAL,
  stripe_fees DECIMAL
) AS $$
DECLARE
  item JSONB;
  seller_id UUID;
  affiliate_id UUID;
  seller_amount DECIMAL;
  affiliate_rate DECIMAL;
  distribution_result RECORD;
  seller_payouts_data JSONB := '[]'::JSONB;
  affiliate_payouts_data JSONB := '[]'::JSONB;
  total_platform_revenue DECIMAL := 0;
  total_stripe_fees DECIMAL := 0;
BEGIN
  -- Process each item in the order
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    -- Extract item details
    seller_id := (item->>'seller_id')::UUID;
    affiliate_id := CASE WHEN item->>'affiliate_id' != '' THEN (item->>'affiliate_id')::UUID ELSE NULL END;
    seller_amount := (item->>'seller_desired_amount')::DECIMAL * (item->>'quantity')::INTEGER;
    affiliate_rate := COALESCE((item->>'commission_rate')::DECIMAL, 0);
    
    -- Calculate distribution for this item
    SELECT * INTO distribution_result 
    FROM calculate_payment_distribution(
      seller_amount, 
      affiliate_rate, 
      'percentage'
    );
    
    -- Record seller payout
    INSERT INTO payment_distributions (
      order_id,
      recipient_type,
      recipient_id,
      amount,
      percentage,
      status
    ) VALUES (
      order_id,
      'seller',
      seller_id,
      distribution_result.seller_amount,
      100.00, -- Seller gets 100% of desired amount
      'pending'
    );
    
    -- Add to seller payouts summary
    seller_payouts_data := seller_payouts_data || jsonb_build_object(
      'seller_id', seller_id,
      'amount', distribution_result.seller_amount,
      'item_id', item->>'product_id'
    );
    
    -- Record affiliate payout if applicable
    IF affiliate_id IS NOT NULL AND distribution_result.affiliate_amount > 0 THEN
      INSERT INTO payment_distributions (
        order_id,
        recipient_type,
        recipient_id,
        amount,
        percentage,
        status
      ) VALUES (
        order_id,
        'affiliate',
        affiliate_id,
        distribution_result.affiliate_amount,
        affiliate_rate,
        'pending'
      );
      
      -- Add to affiliate payouts summary
      affiliate_payouts_data := affiliate_payouts_data || jsonb_build_object(
        'affiliate_id', affiliate_id,
        'amount', distribution_result.affiliate_amount,
        'item_id', item->>'product_id',
        'rate', affiliate_rate
      );
    END IF;
    
    -- Record platform revenue
    INSERT INTO payment_distributions (
      order_id,
      recipient_type,
      recipient_id,
      amount,
      percentage,
      status
    ) VALUES (
      order_id,
      'platform',
      NULL, -- Platform has no specific user ID
      distribution_result.platform_fee,
      10.00, -- Always 10% of seller amount
      'pending'
    );
    
    -- Accumulate totals
    total_platform_revenue := total_platform_revenue + distribution_result.platform_fee;
    total_stripe_fees := total_stripe_fees + distribution_result.stripe_fee;
  END LOOP;
  
  -- Record Stripe fees
  INSERT INTO platform_revenue (
    order_id,
    revenue_type,
    amount,
    description
  ) VALUES (
    order_id,
    'stripe_fee',
    total_stripe_fees,
    'Stripe processing fees (3%)'
  );
  
  -- Record platform revenue
  INSERT INTO platform_revenue (
    order_id,
    revenue_type,
    amount,
    description
  ) VALUES (
    order_id,
    'platform_fee',
    total_platform_revenue,
    'Platform fees (10% of seller amounts)'
  );
  
  success := TRUE;
  seller_payouts := seller_payouts_data;
  affiliate_payouts := affiliate_payouts_data;
  platform_revenue := total_platform_revenue;
  stripe_fees := total_stripe_fees;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to validate fee structure
CREATE OR REPLACE FUNCTION validate_fee_structure(
  seller_amount DECIMAL,
  affiliate_amount DECIMAL,
  platform_fee DECIMAL,
  stripe_fee DECIMAL,
  total_price DECIMAL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verify the formula: Seller + 10% + Affiliate + 3% = Total
  RETURN (
    ABS(
      (seller_amount + affiliate_amount + platform_fee + stripe_fee) - total_price
    ) < 0.01 -- Allow for rounding differences
  );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_distributions_order_id ON payment_distributions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_recipient ON payment_distributions(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_order_id ON platform_revenue(order_id);

-- Add helpful comments
COMMENT ON FUNCTION calculate_payment_distribution IS 
  'Calculates correct fee distribution: Seller + 10% + Affiliate + 3% = Total. Seller gets exactly what they want.';

COMMENT ON FUNCTION process_order_payment IS 
  'Processes order payment with correct fee distribution, ensuring sellers get 100% of desired amount.';

COMMENT ON FUNCTION validate_fee_structure IS 
  'Validates that fee structure follows the correct formula: Seller + 10% + Affiliate + 3% = Total';
