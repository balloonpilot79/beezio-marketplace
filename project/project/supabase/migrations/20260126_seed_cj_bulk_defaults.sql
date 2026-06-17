-- Seed defaults for CJ bulk import (safe/no-op if categories missing)

-- Fallback category mapping (prefer slug = 'other', fallback to name = 'Other')
INSERT INTO public.category_map_cj_to_beezio (cj_category_path, beezio_category_id, fallback)
SELECT
  'CJ_FALLBACK',
  c.id,
  true
FROM public.categories c
WHERE (c.slug = 'other' OR c.name = 'Other')
  AND NOT EXISTS (
    SELECT 1 FROM public.category_map_cj_to_beezio WHERE fallback = true
  )
LIMIT 1;

-- Seed pricing rules for common categories if present.
-- Uses conservative defaults; adjust per category as needed.
INSERT INTO public.pricing_rules (
  beezio_category_id,
  affiliate_percent,
  affiliate_floor_cents,
  affiliate_enabled,
  markup_type,
  markup_value,
  paypal_fee_bps,
  paypal_fixed_cents
)
SELECT
  c.id,
  20,
  500,
  true,
  'flat',
  800,
  350,
  65
FROM public.categories c
WHERE c.slug IN (
  'electronics',
  'fashion',
  'home-garden',
  'beauty-personal-care',
  'sports-outdoors',
  'pet-supplies',
  'toys-games',
  'other'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.pricing_rules pr WHERE pr.beezio_category_id = c.id
  );

