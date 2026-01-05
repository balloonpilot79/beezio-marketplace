-- Materialize whether a product has active variants so list UIs (marketplace/store) can detect variants without joins.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

-- Backfill existing products based on active variants.
UPDATE public.products p
SET has_variants = EXISTS (
  SELECT 1
  FROM public.product_variants v
  WHERE v.product_id = p.id
    AND v.is_active = true
);

CREATE OR REPLACE FUNCTION public.recalc_product_has_variants(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.products p
  SET has_variants = EXISTS (
    SELECT 1
    FROM public.product_variants v
    WHERE v.product_id = p_product_id
      AND v.is_active = true
  )
  WHERE p.id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_product_variants_recalc_product()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_product_has_variants(NEW.product_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_product_has_variants(OLD.product_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      PERFORM public.recalc_product_has_variants(OLD.product_id);
      PERFORM public.recalc_product_has_variants(NEW.product_id);
    ELSE
      PERFORM public.recalc_product_has_variants(NEW.product_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_variants_recalc_product ON public.product_variants;
CREATE TRIGGER trg_product_variants_recalc_product
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.trg_product_variants_recalc_product();

