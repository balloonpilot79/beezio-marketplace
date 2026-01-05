-- In-house messaging for standalone stores and dashboard inbox
-- Buyer ↔ store owner messages are stored in DB to prevent "he said / she said".

-- 1) Conversations
CREATE TABLE IF NOT EXISTS public.store_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_type text NOT NULL CHECK (owner_type IN ('seller','affiliate','fundraiser')),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, owner_type, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_store_conversations_owner ON public.store_conversations(owner_id, owner_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_conversations_customer ON public.store_conversations(customer_id, updated_at DESC);

-- 2) Participants (for read-state)
CREATE TABLE IF NOT EXISTS public.store_conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.store_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 3) Messages
CREATE TABLE IF NOT EXISTS public.store_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.store_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_messages_conversation_created_at
  ON public.store_messages(conversation_id, created_at ASC);

-- 4) Update conversation timestamp when a message is inserted
CREATE OR REPLACE FUNCTION public.touch_store_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.store_conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_store_conversation ON public.store_messages;
CREATE TRIGGER trg_touch_store_conversation
AFTER INSERT ON public.store_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_store_conversation_on_message();

-- 5) RLS
ALTER TABLE public.store_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: participants can read
DROP POLICY IF EXISTS "store_conversations_select_participants" ON public.store_conversations;
CREATE POLICY "store_conversations_select_participants"
ON public.store_conversations
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id OR auth.uid() = customer_id);

-- Conversations: buyer or owner can create (owner creation allows seller initiating support threads)
DROP POLICY IF EXISTS "store_conversations_insert_participants" ON public.store_conversations;
CREATE POLICY "store_conversations_insert_participants"
ON public.store_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id OR auth.uid() = owner_id);

-- Participants: user can read their own participant rows
DROP POLICY IF EXISTS "store_participants_select_self" ON public.store_conversation_participants;
CREATE POLICY "store_participants_select_self"
ON public.store_conversation_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Participants: user can update their own read marker if they are in the conversation
DROP POLICY IF EXISTS "store_participants_update_self" ON public.store_conversation_participants;
CREATE POLICY "store_participants_update_self"
ON public.store_conversation_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Messages: participants can read
DROP POLICY IF EXISTS "store_messages_select_participants" ON public.store_messages;
CREATE POLICY "store_messages_select_participants"
ON public.store_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.store_conversations c
    WHERE c.id = store_messages.conversation_id
      AND (c.owner_id = auth.uid() OR c.customer_id = auth.uid())
  )
);

-- Messages: only participants can write
DROP POLICY IF EXISTS "store_messages_insert_participants" ON public.store_messages;
CREATE POLICY "store_messages_insert_participants"
ON public.store_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.store_conversations c
    WHERE c.id = store_messages.conversation_id
      AND (c.owner_id = auth.uid() OR c.customer_id = auth.uid())
  )
);

-- 6) Helper function: unread count for current user (for dashboard badge)
CREATE OR REPLACE FUNCTION public.get_store_inbox_unread_count()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM public.store_conversations c
  JOIN public.store_conversation_participants p
    ON p.conversation_id = c.id
   AND p.user_id = auth.uid()
  JOIN public.store_messages m
    ON m.conversation_id = c.id
  WHERE m.sender_id <> auth.uid()
    AND m.created_at > COALESCE(p.last_read_at, '1970-01-01'::timestamptz);
$$;

