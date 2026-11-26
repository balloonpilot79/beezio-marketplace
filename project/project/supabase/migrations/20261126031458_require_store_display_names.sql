-- Prevent storefronts from bypassing name claims by falling back to profile names.
alter table public.store_settings add constraint seller_store_display_name_required
  check (store_name is not null and store_name ~ '[^[:space:]]');
alter table public.affiliate_store_settings add constraint affiliate_store_display_name_required
  check (store_name is not null and store_name ~ '[^[:space:]]');
alter table public.storefronts add constraint dedicated_store_display_name_required
  check (name is not null and name ~ '[^[:space:]]');
