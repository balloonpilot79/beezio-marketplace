alter table public.profiles
add column if not exists sale_email_notifications boolean not null default true;

comment on column public.profiles.sale_email_notifications is
  'When true, seller receives email notifications when a sale is captured.';

