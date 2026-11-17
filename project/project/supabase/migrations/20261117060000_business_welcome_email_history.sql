-- Welcome delivery uses the same private audit history as order notifications.
ALTER TABLE public.email_notifications DROP CONSTRAINT email_notifications_notification_type_check;
ALTER TABLE public.email_notifications ADD CONSTRAINT email_notifications_notification_type_check
CHECK (notification_type = ANY (ARRAY['order_confirmation','shipping_confirmation','delivery_update','commission_paid','dispute_opened','dispute_message','dispute_resolved','business_welcome']::text[]));
