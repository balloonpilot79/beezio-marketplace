alter table public.products add column vendor_managed_stock boolean not null default false;

create table public.vendor_inventory_reservations (
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  expires_at timestamptz not null,
  state text not null check (state in ('held', 'capturing', 'consumed', 'released')),
  primary key (order_id, product_id)
);

create index vendor_inventory_reservations_product_idx
  on public.vendor_inventory_reservations (product_id, state, expires_at);

alter table public.vendor_inventory_reservations enable row level security;
revoke all on public.vendor_inventory_reservations from public, anon, authenticated;

-- Callers lock the product before reading the total of competing reservations.
create function public.vendor_reserved_quantity(p_product_id uuid)
returns bigint language sql volatile set search_path = ''
as $$
  select coalesce(sum(quantity), 0)
  from public.vendor_inventory_reservations
  where product_id = p_product_id
    and (state = 'capturing' or (state = 'held' and expires_at > clock_timestamp()));
$$;
revoke execute on function public.vendor_reserved_quantity(uuid) from public, anon, authenticated;

create function public.reserve_vendor_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  item record;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if exists (select 1 from public.vendor_inventory_reservations where order_id = p_order_id) then
    return not exists (
      select 1 from public.vendor_inventory_reservations where order_id = p_order_id
        and (state = 'released' or (state = 'held' and expires_at <= clock_timestamp()))
    );
  end if;

  -- Stable lock order prevents deadlocks when carts overlap.
  perform p.id from public.products p
  where exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id and oi.product_id = p.id
  )
  order by p.id for update;

  for item in
    select p.id, p.is_active, p.stock_quantity, sum(oi.quantity) as quantity,
           bool_or(oi.variant_id is not null) as uses_variants
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.vendor_managed_stock
    group by p.id, p.is_active, p.stock_quantity
  loop
    if item.is_active is distinct from true or item.uses_variants
      or coalesce(item.stock_quantity, 0) - public.vendor_reserved_quantity(item.id) < item.quantity then
      return false;
    end if;
  end loop;

  insert into public.vendor_inventory_reservations (order_id, product_id, quantity, expires_at, state)
  select p_order_id, p.id, sum(oi.quantity)::integer, clock_timestamp() + interval '20 minutes', 'held'
  from public.order_items oi join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id and p.vendor_managed_stock
  group by p.id;
  return true;
end;
$$;

create function public.begin_vendor_order_capture(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  perform p.id from public.products p
  where exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id and oi.product_id = p.id
  )
  order by p.id for update;

  if exists (
    select 1 from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.vendor_managed_stock and not exists (
      select 1 from public.vendor_inventory_reservations r
      where r.order_id = p_order_id and r.product_id = p.id
    )
  ) or exists (
    select 1 from public.vendor_inventory_reservations
    where order_id = p_order_id and
      (state = 'released' or (state = 'held' and expires_at <= clock_timestamp()))
  ) then
    return false;
  end if;

  update public.vendor_inventory_reservations set state = 'capturing'
  where order_id = p_order_id and state = 'held';
  return true;
end;
$$;

create function public.consume_vendor_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  item record;
begin
  perform 1 from public.orders where id = p_order_id for update;
  for item in
    select product_id, quantity, state from public.vendor_inventory_reservations
    where order_id = p_order_id and state <> 'consumed' order by product_id
  loop
    if item.state <> 'capturing' then raise exception 'Vendor stock was not locked for capture'; end if;
    update public.products
    set stock_quantity = stock_quantity - item.quantity,
        total_inventory = stock_quantity - item.quantity
    where id = item.product_id and stock_quantity >= item.quantity;
    if not found then raise exception 'Reserved vendor stock is unavailable'; end if;
    update public.vendor_inventory_reservations set state = 'consumed'
    where order_id = p_order_id and product_id = item.product_id;
  end loop;
end;
$$;

-- Keep stock protected after an ambiguous capture error. Only a definitive
-- provider result that payment cannot complete may release a capturing hold.
create function public.release_vendor_order_stock(p_order_id uuid, p_confirmed_unpaid boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.orders where id = p_order_id for update;
  update public.vendor_inventory_reservations set state = 'released'
  where order_id = p_order_id and (state = 'held' or (state = 'capturing' and p_confirmed_unpaid));
end;
$$;

create function public.adjust_vendor_stock(p_product_id uuid, p_change integer)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  item public.products%rowtype;
  remaining integer;
begin
  if p_change is null or p_change = 0 or p_change < -10000 or p_change > 10000 then
    raise exception 'Enter a valid stock adjustment';
  end if;
  select * into item from public.products p
  where p.id = p_product_id and p.vendor_managed_stock
    and (p.seller_id = auth.uid() or exists (
      select 1 from public.profiles pr where pr.id = p.seller_id and pr.user_id = auth.uid()
    ))
  for update;
  if not found then raise exception 'Vendor listing not found'; end if;
  remaining := coalesce(item.stock_quantity, 0) + p_change;
  if remaining < public.vendor_reserved_quantity(item.id) then
    raise exception 'Some of this stock is reserved for checkout';
  end if;
  update public.products
    set stock_quantity = remaining, total_inventory = remaining
    where id = item.id;
  return remaining;
end;
$$;

revoke execute on function public.reserve_vendor_order(uuid), public.begin_vendor_order_capture(uuid),
  public.consume_vendor_order_stock(uuid), public.release_vendor_order_stock(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_vendor_order(uuid), public.begin_vendor_order_capture(uuid),
  public.consume_vendor_order_stock(uuid), public.release_vendor_order_stock(uuid, boolean)
  to service_role;
revoke execute on function public.adjust_vendor_stock(uuid, integer) from public, anon;
grant execute on function public.adjust_vendor_stock(uuid, integer) to authenticated;

create function public.guard_vendor_stock_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    (tg_op = 'INSERT' and new.vendor_managed_stock) or
    (tg_op = 'UPDATE' and (
      new.vendor_managed_stock is distinct from old.vendor_managed_stock or
      (old.vendor_managed_stock and (
        new.stock_quantity is distinct from old.stock_quantity or
        new.total_inventory is distinct from old.total_inventory
      ))
    ))
  ) then
    raise exception 'Managed stock must be adjusted through the inventory controls';
  end if;
  return new;
end;
$$;

create trigger trg_guard_vendor_stock_write
before insert or update on public.products
for each row execute function public.guard_vendor_stock_write();

-- Sellers may opt in only for stock they physically control. Existing orders
-- without a reservation are rejected at capture after an item is opted in.
create function public.enable_vendor_stock(p_product_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.products p
  set vendor_managed_stock = true, track_inventory = true
  where p.id = p_product_id
    and p.stock_quantity is not null
    and p.stock_quantity >= 0
    and p.has_variants is distinct from true
    and p.is_digital is distinct from true
    and nullif(btrim(p.dropship_provider), '') is null
    and coalesce(nullif(btrim(p.source_platform), ''), 'manual') = 'manual'
    and (p.seller_id = auth.uid() or exists (
      select 1 from public.profiles pr where pr.id = p.seller_id and pr.user_id = auth.uid()
    ));
  return found;
end;
$$;

revoke execute on function public.enable_vendor_stock(uuid) from public, anon;
grant execute on function public.enable_vendor_stock(uuid) to authenticated;
