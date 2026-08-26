-- Count the distinct users currently selling/promoting each product.
-- This intentionally uses one batched RPC so marketplace/storefront pages do not
-- issue one Supabase query per product card.

create or replace function public.get_product_promoter_counts(p_product_ids uuid[])
returns table(product_id uuid, promoter_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with promoters as (
    select ap.product_id, ap.affiliate_id as user_id
    from public.affiliate_products ap
    where ap.product_id = any(p_product_ids)
    union
    select spo.product_id, spo.seller_id as user_id
    from public.seller_product_order spo
    where spo.product_id = any(p_product_ids)
  )
  select p.id as product_id, count(distinct pr.user_id)::bigint as promoter_count
  from unnest(p_product_ids) as p(id)
  left join promoters pr on pr.product_id = p.id
  group by p.id;
$$;

revoke all on function public.get_product_promoter_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_product_promoter_counts(uuid[]) to anon, authenticated;
