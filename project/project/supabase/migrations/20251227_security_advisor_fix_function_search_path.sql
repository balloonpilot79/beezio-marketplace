-- Supabase Security Advisor: "Function Search Path Mutable"
-- Fix by locking down the search_path on listed public functions.
-- Safe to run multiple times and across different argument signatures.

DO $$
DECLARE
  fn_name text;
  fn_oid oid;
  fn_args text;
  target_search_path text := 'public, extensions';
  names text[] := ARRAY[
    'set_updated_at_cj_tokens',
    'touch_store_conversation_on_message',
    'get_store_inbox_unread_count',
    'update_user_integrations_updated_at',
    'generate_referral_code_simple',
    'update_cj_mapping_timestamp',
    'update_cj_order_timestamp',
    'force_platform_checkout',
    'update_updated_at_column'
  ];
BEGIN
  FOREACH fn_name IN ARRAY names LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fn_name
    LOOP
      fn_args := pg_get_function_identity_arguments(fn_oid);
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = %s;', fn_name, fn_args, quote_literal(target_search_path));
    END LOOP;
  END LOOP;
END $$;

