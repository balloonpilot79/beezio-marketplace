-- Clear only the transient draft-building needs_review flag immediately before
-- a CJ activation attempt. The hard activation gate then recomputes readiness
-- from the current product, variant, mapping, freight and media data.

create or replace function beezio_private.prepare_cj_product_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    lower(coalesce(new.source_platform, '')) = 'cj'
    or lower(coalesce(new.source, '')) = 'cj'
    or lower(coalesce(new.dropship_provider, '')) = 'cj'
  ) and (
    coalesce(new.is_active, false) = true
    or lower(coalesce(new.status, '')) = 'active'
  ) then
    new.import_status := 'ready';
  end if;
  return new;
end;
$$;

revoke all on function beezio_private.prepare_cj_product_activation() from public, anon, authenticated;
grant execute on function beezio_private.prepare_cj_product_activation() to service_role;

drop trigger if exists a_products_cj_prepare_activation on public.products;
create trigger a_products_cj_prepare_activation
before insert or update of is_active, status, source_platform, source, dropship_provider, cj_product_id
on public.products
for each row
execute function beezio_private.prepare_cj_product_activation();
