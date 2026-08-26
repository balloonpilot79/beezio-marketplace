-- The product owner is the primary seller, not a marketplace promoter count.
create or replace function public.get_product_promoter_counts(p_product_ids uuid[])
returns table(product_id uuid, promoter_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select p.id, p.seller_id
    from public.products p
    where p.id = any(p_product_ids)
  ),
  promoters as (
    select ap.product_id, ap.affiliate_id as user_id
    from public.affiliate_products ap
    where ap.product_id = any(p_product_ids)
    union
    select spo.product_id, spo.seller_id as user_id
    from public.seller_product_order spo
    where spo.product_id = any(p_product_ids)
  )
  select r.id as product_id,
         count(distinct pr.user_id) filter (where pr.user_id is not null and pr.user_id <> r.seller_id)::bigint as promoter_count
  from requested r
  left join promoters pr on pr.product_id = r.id
  group by r.id;
$$;

revoke all on function public.get_product_promoter_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_product_promoter_counts(uuid[]) to anon, authenticated;
