-- Auto-unlist products when inventory hits zero, and auto-relist CJ items when back in stock.

CREATE OR REPLACE FUNCTION public.sync_product_listing_with_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  inventory_count integer;
  provider text;
BEGIN
  inventory_count := COALESCE(NEW.total_inventory, NEW.stock_quantity, 0);

  IF inventory_count <= 0 THEN
    NEW.in_stock := false;
    NEW.is_active := false;
  ELSE
    NEW.in_stock := true;
  provider := lower(coalesce(NEW.dropship_provider, ''));
    IF provider = 'cj' THEN
      NEW.is_active := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_listing_with_inventory ON public.products;

CREATE TRIGGER trg_sync_product_listing_with_inventory
BEFORE INSERT OR UPDATE OF stock_quantity, total_inventory, dropship_provider
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_listing_with_inventory();
