ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_digital boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_download_bucket text,
  ADD COLUMN IF NOT EXISTS digital_download_path text,
  ADD COLUMN IF NOT EXISTS digital_download_filename text,
  ADD COLUMN IF NOT EXISTS digital_download_content_type text,
  ADD COLUMN IF NOT EXISTS digital_download_file_size bigint,
  ADD COLUMN IF NOT EXISTS digital_download_instructions text,
  ADD COLUMN IF NOT EXISTS digital_download_limit integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS digital_return_policy_notice text;

UPDATE public.products
SET
  is_digital = CASE
    WHEN lower(coalesce(category_id, '')) = 'digital-products' THEN true
    ELSE coalesce(is_digital, false)
  END,
  requires_shipping = CASE
    WHEN lower(coalesce(category_id, '')) = 'digital-products' THEN false
    ELSE requires_shipping
  END,
  shipping_cost = CASE
    WHEN lower(coalesce(category_id, '')) = 'digital-products' THEN 0
    ELSE shipping_cost
  END,
  shipping_price = CASE
    WHEN lower(coalesce(category_id, '')) = 'digital-products' THEN 0
    ELSE shipping_price
  END
WHERE lower(coalesce(category_id, '')) = 'digital-products';

CREATE TABLE IF NOT EXISTS public.digital_download_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid,
  buyer_user_id uuid,
  billing_email text,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  content_type text,
  file_size_bytes bigint,
  download_limit integer NOT NULL DEFAULT 1,
  download_count integer NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  access_status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT digital_download_entitlements_limit_check CHECK (download_limit >= 1),
  CONSTRAINT digital_download_entitlements_count_check CHECK (download_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS digital_download_entitlements_order_item_key
  ON public.digital_download_entitlements(order_item_id);

CREATE INDEX IF NOT EXISTS digital_download_entitlements_buyer_idx
  ON public.digital_download_entitlements(buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS digital_download_entitlements_order_idx
  ON public.digital_download_entitlements(order_id, created_at DESC);

ALTER TABLE public.digital_download_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digital_entitlements_service_role_all" ON public.digital_download_entitlements;
CREATE POLICY "digital_entitlements_service_role_all"
  ON public.digital_download_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "digital_entitlements_buyer_read" ON public.digital_download_entitlements;
CREATE POLICY "digital_entitlements_buyer_read"
  ON public.digital_download_entitlements
  FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT
  'digital-products-private',
  'digital-products-private',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/csv',
    'application/json'
  ]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'digital-products-private'
);
