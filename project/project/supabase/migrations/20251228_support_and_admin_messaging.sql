-- Beezio Support + Admin Broadcast Messaging
-- - Users can message Beezio support (in-house, auditable)
-- - Admins can view all support/store conversations for disputes
-- - Admins can send site-wide announcements
-- Safe to run multiple times.

-- Helper: is admin?
CREATE OR REPLACE FUNCTION public.is_beezio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(coalesce(p.role, p.primary_role, '')) = 'admin'
  );
$$;

-- ==========================================
-- 1) Harden store messaging: allow admin audit + admin intervention
-- ==========================================

ALTER TABLE IF EXISTS public.store_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_conversations_select_participants" ON public.store_conversations;
CREATE POLICY "store_conversations_select_participants"
ON public.store_conversations
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = customer_id OR public.is_beezio_admin());

DROP POLICY IF EXISTS "store_conversations_insert_participants" ON public.store_conversations;
CREATE POLICY "store_conversations_insert_participants"
ON public.store_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id OR auth.uid() = owner_id OR public.is_beezio_admin());

DROP POLICY IF EXISTS "store_participants_select_self" ON public.store_conversation_participants;
CREATE POLICY "store_participants_select_self"
ON public.store_conversation_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_beezio_admin());

DROP POLICY IF EXISTS "store_participants_update_self" ON public.store_conversation_participants;
CREATE POLICY "store_participants_update_self"
ON public.store_conversation_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_beezio_admin())
WITH CHECK (auth.uid() = user_id OR public.is_beezio_admin());

DROP POLICY IF EXISTS "store_messages_select_participants" ON public.store_messages;
CREATE POLICY "store_messages_select_participants"
ON public.store_messages
FOR SELECT
TO authenticated
USING (
  public.is_beezio_admin()
  OR EXISTS (
    SELECT 1
    FROM public.store_conversations c
    WHERE c.id = store_messages.conversation_id
      AND (c.owner_id = auth.uid() OR c.customer_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "store_messages_insert_participants" ON public.store_messages;
CREATE POLICY "store_messages_insert_participants"
ON public.store_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    public.is_beezio_admin()
    OR EXISTS (
      SELECT 1
      FROM public.store_conversations c
      WHERE c.id = store_messages.conversation_id
        AND (c.owner_id = auth.uid() OR c.customer_id = auth.uid())
    )
  )
);

-- ==========================================
-- 2) Support threads (user <-> Beezio)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_threads_customer_updated ON public.support_threads(customer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_status_updated ON public.support_threads(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.support_thread_participants (
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread_created ON public.support_messages(thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.touch_support_thread_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.support_threads
    SET updated_at = now()
    WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_thread ON public.support_messages;
CREATE TRIGGER trg_touch_support_thread
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_thread_on_message();

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Threads: customer or admin can read
DROP POLICY IF EXISTS "support_threads_select" ON public.support_threads;
CREATE POLICY "support_threads_select"
ON public.support_threads
FOR SELECT
TO authenticated
USING (customer_id = auth.uid() OR public.is_beezio_admin());

-- Threads: customer can create for themselves; admin can create for any customer (direct message)
DROP POLICY IF EXISTS "support_threads_insert" ON public.support_threads;
CREATE POLICY "support_threads_insert"
ON public.support_threads
FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid() OR public.is_beezio_admin());

-- Participants: self + admin can read/update markers
DROP POLICY IF EXISTS "support_participants_select" ON public.support_thread_participants;
CREATE POLICY "support_participants_select"
ON public.support_thread_participants
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_beezio_admin());

DROP POLICY IF EXISTS "support_participants_upsert_self" ON public.support_thread_participants;
CREATE POLICY "support_participants_upsert_self"
ON public.support_thread_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_beezio_admin());

DROP POLICY IF EXISTS "support_participants_update" ON public.support_thread_participants;
CREATE POLICY "support_participants_update"
ON public.support_thread_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_beezio_admin())
WITH CHECK (user_id = auth.uid() OR public.is_beezio_admin());

-- Messages: customer or admin can read/write (auditable)
DROP POLICY IF EXISTS "support_messages_select" ON public.support_messages;
CREATE POLICY "support_messages_select"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  public.is_beezio_admin()
  OR EXISTS (
    SELECT 1
    FROM public.support_threads t
    WHERE t.id = support_messages.thread_id
      AND t.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
CREATE POLICY "support_messages_insert"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    public.is_beezio_admin()
    OR EXISTS (
      SELECT 1
      FROM public.support_threads t
      WHERE t.id = support_messages.thread_id
        AND t.customer_id = auth.uid()
    )
  )
);

-- ==========================================
-- 3) Admin announcements (site-wide messages)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 8000),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_created_at ON public.admin_announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcement_reads ENABLE ROW LEVEL SECURITY;

-- Everyone signed-in can read announcements; only admins can manage
DROP POLICY IF EXISTS "announcements_select_authenticated" ON public.admin_announcements;
CREATE POLICY "announcements_select_authenticated"
ON public.admin_announcements
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "announcements_admin_manage" ON public.admin_announcements;
CREATE POLICY "announcements_admin_manage"
ON public.admin_announcements
FOR ALL
TO authenticated
USING (public.is_beezio_admin())
WITH CHECK (public.is_beezio_admin());

-- Read receipts: user can upsert their own; admins can view all
DROP POLICY IF EXISTS "announcement_reads_select" ON public.admin_announcement_reads;
CREATE POLICY "announcement_reads_select"
ON public.admin_announcement_reads
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_beezio_admin());

DROP POLICY IF EXISTS "announcement_reads_upsert_self" ON public.admin_announcement_reads;
CREATE POLICY "announcement_reads_upsert_self"
ON public.admin_announcement_reads
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_beezio_admin());

DROP POLICY IF EXISTS "announcement_reads_update_self" ON public.admin_announcement_reads;
CREATE POLICY "announcement_reads_update_self"
ON public.admin_announcement_reads
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.is_beezio_admin())
WITH CHECK (user_id = auth.uid() OR public.is_beezio_admin());

