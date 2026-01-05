-- Atomic inventory + counters updates to prevent overselling

CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
RETURNS TABLE(remaining_stock integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN QUERY SELECT stock_quantity FROM products WHERE id = p_product_id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity
  RETURNING stock_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_variant_inventory(
  p_variant_id uuid,
  p_quantity integer
)
RETURNS TABLE(remaining_inventory integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN QUERY SELECT inventory FROM product_variants WHERE id = p_variant_id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE product_variants
  SET inventory = inventory - p_quantity,
      updated_at = now()
  WHERE id = p_variant_id
    AND inventory IS NOT NULL
    AND inventory >= p_quantity
  RETURNING inventory;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_sales_count(
  p_product_id uuid,
  p_quantity integer
)
RETURNS TABLE(updated_sales_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN QUERY SELECT COALESCE(sales_count, 0) FROM products WHERE id = p_product_id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE products
  SET sales_count = COALESCE(sales_count, 0) + p_quantity,
      updated_at = now()
  WHERE id = p_product_id
  RETURNING sales_count;
END;
$$;

