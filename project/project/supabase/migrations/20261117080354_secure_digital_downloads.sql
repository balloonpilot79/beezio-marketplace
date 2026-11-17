-- Additive digital delivery. No changes to existing physical products or their policies.
create schema if not exists beezio_security;
alter table public.orders add column if not exists digital_buyer_user_id uuid references auth.users(id), add column if not exists digital_policy_version text, add column if not exists digital_policy_accepted_at timestamptz;
create table public.digital_file_uploads (
 storage_path text primary key, seller_user_id uuid not null references auth.users(id), original_filename text not null,
 content_type text not null, file_size_bytes bigint not null check(file_size_bytes between 1 and 3145728), sha256 text not null,
 created_at timestamptz not null default now()
);
alter table public.digital_file_uploads enable row level security;
revoke all on public.digital_file_uploads from anon,authenticated;
grant all on public.digital_file_uploads to service_role;
create index digital_file_uploads_owner_idx on public.digital_file_uploads(seller_user_id,created_at);
create table public.digital_download_entitlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 order_item_id uuid not null unique references public.order_items(id) on delete cascade, product_id uuid not null references public.products(id),
 seller_id uuid, buyer_user_id uuid not null references auth.users(id), billing_email text,
 storage_bucket text not null default 'digital-products-private' check(storage_bucket='digital-products-private'), storage_path text not null references public.digital_file_uploads(storage_path),
 original_filename text not null, content_type text not null, file_size_bytes bigint not null,
 download_limit integer not null check(download_limit between 1 and 20), download_count integer not null default 0 check(download_count>=0),
 first_access_at timestamptz, last_downloaded_at timestamptz, access_status text not null default 'pending' check(access_status in ('pending','active','exhausted','revoked')),
 metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.digital_download_entitlements enable row level security;
revoke all on public.digital_download_entitlements from anon,authenticated;
grant all on public.digital_download_entitlements to service_role;
create index digital_entitlements_buyer_idx on public.digital_download_entitlements(buyer_user_id,created_at desc);
create index digital_entitlements_order_idx on public.digital_download_entitlements(order_id);
create table public.digital_download_events (
 id uuid primary key default gen_random_uuid(), entitlement_id uuid not null references public.digital_download_entitlements(id),
 buyer_user_id uuid not null references auth.users(id), accessed_at timestamptz not null default now(), user_agent text, policy_version text not null
);
alter table public.digital_download_events enable row level security;
revoke all on public.digital_download_events from anon,authenticated;
grant all on public.digital_download_events to service_role;
create index digital_download_events_entitlement_idx on public.digital_download_events(entitlement_id,accessed_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('digital-products-private','digital-products-private',false,3145728,array['application/pdf','application/zip','image/png','image/jpeg','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']) on conflict(id) do nothing;

create function public.reserve_digital_upload(p_user uuid,p_path text,p_filename text,p_mime text,p_size bigint,p_sha256 text) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if (select count(*) from public.digital_file_uploads where seller_user_id=p_user and created_at>now()-interval '1 day')>=20 or
 (select coalesce(sum(file_size_bytes),0) from public.digital_file_uploads where seller_user_id=p_user)+p_size>104857600 then raise exception 'Upload quota reached'; end if;
 insert into public.digital_file_uploads(storage_path,seller_user_id,original_filename,content_type,file_size_bytes,sha256) values(p_path,p_user,p_filename,p_mime,p_size,p_sha256);
end $$;
revoke all on function public.reserve_digital_upload(uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_digital_upload(uuid,text,text,text,bigint,text) to service_role;

create function beezio_security.validate_digital_product() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.digital_file_uploads; owner_user uuid;
begin
 if new.is_digital is not true then return new; end if;
 select user_id into owner_user from public.profiles where id=new.seller_id;
 select * into f from public.digital_file_uploads where storage_path=new.digital_download_path and seller_user_id=owner_user;
 if not found then raise exception 'Upload a validated private file owned by this seller before saving a digital product'; end if;
 if not exists(select 1 from storage.objects where bucket_id='digital-products-private' and name=f.storage_path) then raise exception 'Private file upload is incomplete'; end if;
 new.digital_download_bucket:='digital-products-private'; new.digital_download_filename:=f.original_filename;
 new.digital_download_content_type:=f.content_type; new.digital_download_file_size:=f.file_size_bytes;
 new.digital_download_limit:=greatest(1,least(20,coalesce(new.digital_download_limit,5)));
 new.digital_return_policy_notice:='Digital purchases are final once download access begins. No change-of-mind refunds after access. Contact support for corrupt, inaccessible, or misdescribed files, unauthorized purchases, or rights required by law or your payment provider.';
 new.requires_shipping:=false; new.shipping_cost:=0; new.shipping_price:=0; new.shipping_reserve_amount:=0; new.shipping_options:='[]'::jsonb;
 new.track_inventory:=false; new.in_stock:=true;
 return new;
end $$;
revoke all on function beezio_security.validate_digital_product() from public,anon,authenticated;
create trigger validate_digital_product before insert or update on public.products for each row when(new.is_digital=true) execute function beezio_security.validate_digital_product();

-- Freeze the actual purchased file before capture, so later seller edits cannot change it.
create function beezio_security.snapshot_digital_purchase() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.products; o public.orders; f public.digital_file_uploads;
begin
 select * into p from public.products where id=new.product_id;
 if p.is_digital is not true then return new; end if;
 select * into o from public.orders where id=new.order_id;
 if o.digital_buyer_user_id is null or o.digital_policy_version is distinct from '2026-11-17' or o.digital_policy_accepted_at is null then raise exception 'Digital checkout requires verified buyer and policy consent'; end if;
 select * into f from public.digital_file_uploads where storage_path=p.digital_download_path;
 if not found then raise exception 'Digital delivery file unavailable'; end if;
 insert into public.digital_download_entitlements(order_id,order_item_id,product_id,seller_id,buyer_user_id,billing_email,storage_path,original_filename,content_type,file_size_bytes,download_limit,metadata)
 values(new.order_id,new.id,new.product_id,new.seller_id,o.digital_buyer_user_id,o.customer_email,f.storage_path,f.original_filename,f.content_type,f.file_size_bytes,least(20,greatest(1,coalesce(p.digital_download_limit,5))),jsonb_build_object('product_title',p.title,'instructions',p.digital_download_instructions,'policy_notice',p.digital_return_policy_notice,'sha256',f.sha256,'policy_version',o.digital_policy_version)) on conflict(order_item_id) do nothing;
 return new;
end $$;
revoke all on function beezio_security.snapshot_digital_purchase() from public,anon,authenticated;
create trigger snapshot_digital_purchase after insert on public.order_items for each row execute function beezio_security.snapshot_digital_purchase();

-- Both capture and webhook/recovery update orders: delivery never depends on browser return.
create function beezio_security.activate_digital_purchase() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.digital_buyer_user_id is null then return new; end if;
 if lower(coalesce(new.payment_status,'')) in ('paid','completed') and new.paid_at is not null and new.payment_finalized_at is not null and coalesce(new.provider_capture_id,'')<>'' and lower(coalesce(new.status,''))!~'refund|cancel|revers|fail|denied' then
 update public.digital_download_entitlements set access_status='active',updated_at=now() where order_id=new.id and access_status='pending';
 elsif lower(coalesce(new.status,'')||' '||coalesce(new.payment_status,''))~'refund|cancel|revers|fail|denied' then
 update public.digital_download_entitlements set access_status='revoked',updated_at=now() where order_id=new.id and access_status<>'revoked';
 end if;
 return new;
end $$;
revoke all on function beezio_security.activate_digital_purchase() from public,anon,authenticated;
create trigger activate_digital_purchase after update on public.orders for each row when(new.digital_buyer_user_id is not null) execute function beezio_security.activate_digital_purchase();

create function public.consume_digital_download(p_entitlement uuid,p_buyer uuid,p_user_agent text,p_policy text) returns integer language plpgsql security invoker set search_path='' as $$
declare e public.digital_download_entitlements; o public.orders; remaining integer;
begin
 if p_policy is distinct from '2026-11-17' then raise exception 'Accept the digital download policy'; end if;
 -- Lock order first, consistently with the activation trigger.
 select orders.* into o from public.orders join public.digital_download_entitlements d on d.order_id=orders.id where d.id=p_entitlement and d.buyer_user_id=p_buyer for update of orders;
 if not found then raise exception 'Download unavailable'; end if;
 select * into e from public.digital_download_entitlements where id=p_entitlement and buyer_user_id=p_buyer for update;
 if e.access_status<>'active' or e.download_count>=e.download_limit then raise exception 'Download unavailable or download limit reached'; end if;
 if lower(coalesce(o.payment_status,'')) not in ('paid','completed') or o.paid_at is null or o.payment_finalized_at is null or coalesce(o.provider_capture_id,'')='' or lower(coalesce(o.status,''))~'refund|cancel|revers|fail|denied' or upper(coalesce(o.dispute_status::text,'NONE'))<>'NONE' then raise exception 'Payment or dispute prevents access'; end if;
 if exists(select 1 from public.disputes where order_id=o.id and status in ('open','investigating','awaiting_response')) then raise exception 'Disputed purchase access is on hold'; end if;
 remaining:=e.download_limit-e.download_count-1;
 update public.digital_download_entitlements set download_count=download_count+1,first_access_at=coalesce(first_access_at,now()),last_downloaded_at=now(),updated_at=now(),access_status=case when remaining=0 then 'exhausted' else 'active' end where id=e.id;
 insert into public.digital_download_events(entitlement_id,buyer_user_id,user_agent,policy_version) values(e.id,p_buyer,left(p_user_agent,512),p_policy);
 return remaining;
end $$;
revoke all on function public.consume_digital_download(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_digital_download(uuid,uuid,text,text) to service_role;
