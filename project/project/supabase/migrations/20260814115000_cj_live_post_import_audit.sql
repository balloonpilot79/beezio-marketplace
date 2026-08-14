alter table public.products
  add column if not exists cj_live_audit_status text not null default 'pending',
  add column if not exists cj_live_audited_at timestamptz,
  add column if not exists cj_live_audit_details jsonb not null default '{}'::jsonb;

create index if not exists products_cj_live_audit_queue_idx
  on public.products (cj_live_audit_status, created_at)
  where source_platform = 'cj';

create or replace function beezio_private.invalidate_cj_product_live_audit_from_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id uuid;
begin
  target_product_id := coalesce(new.product_id, old.product_id);
  if target_product_id is not null then
    update public.products
    set cj_live_audit_status = 'pending',
        cj_live_audited_at = null,
        cj_live_audit_details = '{}'::jsonb
    where id = target_product_id
      and lower(coalesce(source_platform, '')) = 'cj';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function beezio_private.invalidate_cj_product_live_audit_from_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id uuid;
begin
  target_product_id := coalesce(new.beezio_product_id, old.beezio_product_id);
  if target_product_id is not null then
    update public.products
    set cj_live_audit_status = 'pending',
        cj_live_audited_at = null,
        cj_live_audit_details = '{}'::jsonb
    where id = target_product_id
      and lower(coalesce(source_platform, '')) = 'cj';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function beezio_private.invalidate_cj_product_live_audit_from_variant() from public, anon, authenticated;
revoke all on function beezio_private.invalidate_cj_product_live_audit_from_mapping() from public, anon, authenticated;
grant execute on function beezio_private.invalidate_cj_product_live_audit_from_variant() to service_role;
grant execute on function beezio_private.invalidate_cj_product_live_audit_from_mapping() to service_role;

drop trigger if exists product_variants_invalidate_cj_live_audit on public.product_variants;
create trigger product_variants_invalidate_cj_live_audit
after insert or update or delete on public.product_variants
for each row execute function beezio_private.invalidate_cj_product_live_audit_from_variant();

drop trigger if exists cj_variant_mappings_invalidate_live_audit on public.cj_variant_mappings;
create trigger cj_variant_mappings_invalidate_live_audit
after insert or update or delete on public.cj_variant_mappings
for each row execute function beezio_private.invalidate_cj_product_live_audit_from_mapping();

update public.products
set cj_live_audit_status = 'pending',
    cj_live_audited_at = null,
    cj_live_audit_details = '{}'::jsonb
where lower(coalesce(source_platform, '')) = 'cj';
