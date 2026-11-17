-- Run as a single transaction. Every fixture and audit record is rolled back.
begin;
do $$
declare seller uuid:=gen_random_uuid(); buyer uuid:=gen_random_uuid(); seller_profile uuid; buyer_profile uuid; product uuid:=gen_random_uuid(); ord uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); ent uuid; path text; n integer;
begin
 insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,confirmation_token,recovery_token,email_change_token_new,email_change)
 values(seller,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rollback-seller-'||seller||'@example.invalid',now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Digital QA rollback seller","role":"seller","account_type":"business"}','','','',''),
 (buyer,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rollback-buyer-'||buyer||'@example.invalid',now(),now(),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Digital QA rollback buyer","role":"buyer","account_type":"buyer"}','','','','');
 select id into seller_profile from public.profiles where user_id=seller;
 select id into buyer_profile from public.profiles where user_id=buyer;
 path:=seller||'/rollback-only/guide.txt';
 perform public.reserve_digital_upload(seller,path,'guide.txt','text/plain',5,repeat('0',64));
 -- Phantom metadata is never committed; no actual file is uploaded or served.
 insert into storage.objects(bucket_id,name) values('digital-products-private',path);
 insert into public.products(id,seller_id,title,price,is_digital,digital_download_path,digital_download_limit,is_active,status,shipping_cost,shipping_price)
 values(product,seller_profile,'Digital QA rollback fixture',20,true,path,1,false,'draft',99,99);
 if not exists(select 1 from public.products where id=product and shipping_cost=0 and shipping_price=0 and not requires_shipping and not track_inventory) then raise exception 'digital shipping invariant failed';end if;
 insert into public.orders(id,buyer_id,seller_id,total_amount,status,payment_status,digital_buyer_user_id,digital_policy_version,digital_policy_accepted_at) values(ord,buyer_profile,seller_profile,25,'created','unpaid',buyer,'2026-11-17',now());
 insert into public.order_items(id,order_id,product_id,seller_id,quantity,price) values(item,ord,product,seller_profile,1,25);
 select id into ent from public.digital_download_entitlements where order_item_id=item and access_status='pending';
 if ent is null then raise exception 'snapshot missing';end if;
 begin perform public.consume_digital_download(ent,buyer,'rollback QA','2026-11-17');raise exception 'unpaid access incorrectly allowed';exception when others then if sqlerrm='unpaid access incorrectly allowed' then raise;end if;end;
 update public.orders set payment_status='paid',paid_at=now(),provider_capture_id='ROLLBACK_ONLY_NOT_A_REAL_CAPTURE',payment_finalized_at=now() where id=ord;
 if not exists(select 1 from public.digital_download_entitlements where id=ent and access_status='active') then raise exception 'paid activation failed';end if;
 begin perform public.consume_digital_download(ent,seller,'rollback QA','2026-11-17');raise exception 'wrong buyer incorrectly allowed';exception when others then if sqlerrm='wrong buyer incorrectly allowed' then raise;end if;end;
 update public.orders set dispute_status='OPEN' where id=ord;
 begin perform public.consume_digital_download(ent,buyer,'rollback QA','2026-11-17');raise exception 'disputed access incorrectly allowed';exception when others then if sqlerrm='disputed access incorrectly allowed' then raise;end if;end;
 update public.orders set dispute_status='NONE' where id=ord;
 n:=public.consume_digital_download(ent,buyer,'rollback QA','2026-11-17');
 if n<>0 then raise exception 'limit consumption failed';end if;
 if not exists(select 1 from public.digital_download_entitlements where id=ent and access_status='exhausted' and download_count=1 and first_access_at is not null) then raise exception 'access record failed';end if;
 update public.orders set payment_status='paid' where id=ord;
 if exists(select 1 from public.digital_download_entitlements where id=ent and access_status<>'exhausted') then raise exception 'replay reset access';end if;
 if (select count(*) from public.digital_download_events where entitlement_id=ent)<>1 then raise exception 'audit event count failed';end if;
 begin perform public.consume_digital_download(ent,buyer,'rollback QA','2026-11-17');raise exception 'repeat access incorrectly allowed';exception when others then if sqlerrm='repeat access incorrectly allowed' then raise;end if;end;
end $$;
rollback;
select 'PASS: actual-schema digital lifecycle; every test record rolled back' as result;
