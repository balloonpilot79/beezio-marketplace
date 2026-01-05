-- Harden categories table: enable RLS and allow public read.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories"
ON public.categories
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can manage categories" ON public.categories;
CREATE POLICY "Service role can manage categories"
ON public.categories
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

