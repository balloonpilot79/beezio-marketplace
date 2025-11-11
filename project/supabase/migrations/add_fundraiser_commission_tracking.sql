-- Add fundraiser commission tracking
-- This migration adds a PostgreSQL function to increment fundraiser current_raised

-- Create function to increment fundraiser's current_raised amount
CREATE OR REPLACE FUNCTION increment_fundraiser_raised(
  p_fundraiser_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE fundraiser_store_settings
  SET current_raised = COALESCE(current_raised, 0) + p_amount,
      updated_at = NOW()
  WHERE user_id = p_fundraiser_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION increment_fundraiser_raised IS 'Increments the current_raised amount for a fundraiser when a sale is made';
