-- The release migration originally added a third copy of the existing
-- storefront/product uniqueness index. Keep the established constraint and
-- remove only the redundant release-specific copy.
drop index if exists public.storefront_products_storefront_product_release_key;
