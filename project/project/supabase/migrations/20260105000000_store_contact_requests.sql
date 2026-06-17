-- Store contact requests (minimal "contact seller" without internal on-platform chat)
-- Goal: seller can reply from dashboard; buyer email remains private (only service role / admins).

-- Helper: is admin? (self-contained; safe to re-run)
CREATE OR REPLACE FUNCTION public.is_beezio_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  has_role boolean;
  has_primary_role boolean;
  role_expr text;
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) INTO has_role;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'primary_role'
  ) INTO has_primary_role;

  IF has_role AND has_primary_role THEN
    role_expr := 'lower(coalesce(p.role, p.primary_role, ''''))';
  ELSIF has_role THEN
    role_expr := 'lower(coalesce(p.role, ''''))';
  ELSIF has_primary_role THEN
    role_expr := 'lower(coalesce(p.primary_role, ''''))';
  ELSE
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND %s = ''admin''
     )',
    role_expr
  ) INTO is_admin;

  RETURN is_admin;
END;
$$;

CREATE TABLE IF NOT EXISTS public.store_contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_user_id uuid NULL,
  owner_type text NOT NULL DEFAULT 'seller' CHECK (owner_type IN ('seller', 'affiliate', 'fundraiser')),
  buyer_user_id uuid NULL,
  sender_name text NOT NULL,
  message text NOT NULL,
  store_name text NULL,
  page_url text NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz NULL,
  last_replied_by_user_id uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_store_contact_requests_owner_profile_id
  ON public.store_contact_requests(owner_profile_id);

CREATE INDEX IF NOT EXISTS idx_store_contact_requests_owner_user_id
  ON public.store_contact_requests(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_store_contact_requests_status
  ON public.store_contact_requests(status);

CREATE TABLE IF NOT EXISTS public.store_contact_request_private (
  request_id uuid PRIMARY KEY REFERENCES public.store_contact_requests(id) ON DELETE CASCADE,
  sender_email text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.store_contact_request_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.store_contact_requests(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_contact_request_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_contact_request_replies ENABLE ROW LEVEL SECURITY;

-- Sellers: can view their own requests (by owner_user_id OR owner_profile_id matching their profile.id)
DROP POLICY IF EXISTS "store_contact_requests_owner_select" ON public.store_contact_requests;
CREATE POLICY "store_contact_requests_owner_select"
ON public.store_contact_requests
FOR SELECT
TO authenticated
USING (
  public.is_beezio_admin()
  OR owner_user_id = auth.uid()
  OR owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Sellers: can insert replies to their own requests
DROP POLICY IF EXISTS "store_contact_request_replies_owner_insert" ON public.store_contact_request_replies;
CREATE POLICY "store_contact_request_replies_owner_insert"
ON public.store_contact_request_replies
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_beezio_admin()
  OR request_id IN (
    SELECT id
    FROM public.store_contact_requests
    WHERE owner_user_id = auth.uid()
       OR owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Sellers: can view replies on their own requests
DROP POLICY IF EXISTS "store_contact_request_replies_owner_select" ON public.store_contact_request_replies;
CREATE POLICY "store_contact_request_replies_owner_select"
ON public.store_contact_request_replies
FOR SELECT
TO authenticated
USING (
  public.is_beezio_admin()
  OR request_id IN (
    SELECT id
    FROM public.store_contact_requests
    WHERE owner_user_id = auth.uid()
       OR owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Requests are created server-side via service role (Netlify function), not directly by clients.
DROP POLICY IF EXISTS "store_contact_requests_service_role_insert" ON public.store_contact_requests;
CREATE POLICY "store_contact_requests_service_role_insert"
ON public.store_contact_requests
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "store_contact_request_private_service_role_all" ON public.store_contact_request_private;
CREATE POLICY "store_contact_request_private_service_role_all"
ON public.store_contact_request_private
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "store_contact_request_private_admin_select" ON public.store_contact_request_private;
CREATE POLICY "store_contact_request_private_admin_select"
ON public.store_contact_request_private
FOR SELECT
TO authenticated
USING (public.is_beezio_admin());

-- Allow service role/admin to update request status/timestamps
DROP POLICY IF EXISTS "store_contact_requests_service_role_update" ON public.store_contact_requests;
CREATE POLICY "store_contact_requests_service_role_update"
ON public.store_contact_requests
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "store_contact_requests_admin_update" ON public.store_contact_requests;
CREATE POLICY "store_contact_requests_admin_update"
ON public.store_contact_requests
FOR UPDATE
TO authenticated
USING (public.is_beezio_admin())
WITH CHECK (public.is_beezio_admin());
