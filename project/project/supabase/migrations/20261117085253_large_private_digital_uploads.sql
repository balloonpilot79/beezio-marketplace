-- Existing approved files and all physical products retain their current behavior.
alter table public.digital_file_uploads drop constraint digital_file_uploads_file_size_bytes_check;
alter table public.digital_file_uploads add constraint digital_file_uploads_file_size_bytes_check check(file_size_bytes between 1 and 52428800);
alter table public.digital_file_uploads
 add column upload_id uuid not null default gen_random_uuid() unique,
 add column quarantine_path text unique,
 add column validation_status text not null default 'approved' check(validation_status in ('pending','validating','approved','rejected')),
 add column validation_error text,
 add column validation_started_at timestamptz,
 add column validated_at timestamptz;
update storage.buckets set file_size_limit=52428800 where id='digital-products-private';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select 'digital-products-quarantine','digital-products-quarantine',false,52428800,allowed_mime_types from storage.buckets where id='digital-products-private';

create function public.begin_digital_upload(p_user uuid,p_path text,p_quarantine text,p_filename text,p_mime text,p_size bigint) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if p_size<1 or p_size>52428800 then raise exception 'Maximum file size is 50 MB';end if;
 if split_part(p_path,'/',1)<>p_user::text or split_part(p_quarantine,'/',1)<>p_user::text or p_path=p_quarantine then raise exception 'Invalid private upload path';end if;
 if (select count(*) from public.digital_file_uploads where seller_user_id=p_user and created_at>now()-interval '1 day')>=20 then raise exception 'Daily upload quota reached';end if;
 if (select count(*) from public.digital_file_uploads where seller_user_id=p_user and validation_status in ('pending','validating') and created_at>now()-interval '1 day')>=2 then raise exception 'Finish your pending uploads first';end if;
 if (select coalesce(sum(file_size_bytes),0) from public.digital_file_uploads where seller_user_id=p_user and validation_status<>'rejected')+p_size>524288000 then raise exception 'Private file quota reached';end if;
 insert into public.digital_file_uploads(storage_path,seller_user_id,original_filename,content_type,file_size_bytes,sha256,quarantine_path,validation_status)
 values(p_path,p_user,p_filename,p_mime,p_size,'',p_quarantine,'pending') returning upload_id into result;
 return result;
end $$;
revoke all on function public.begin_digital_upload(uuid,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.begin_digital_upload(uuid,text,text,text,text,bigint) to service_role;

create function public.claim_digital_upload(p_upload uuid,p_user uuid) returns setof public.digital_file_uploads
language sql security invoker set search_path='' as $$
 update public.digital_file_uploads set validation_status='validating',validation_started_at=now(),validation_error=null
 where upload_id=p_upload and seller_user_id=p_user and created_at>now()-interval '1 day'
 and (validation_status='pending' or (validation_status='validating' and validation_started_at<now()-interval '16 minutes')) returning *;
$$;
revoke all on function public.claim_digital_upload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_digital_upload(uuid,uuid) to service_role;

create function beezio_security.require_approved_digital_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.digital_file_uploads where storage_path=new.digital_download_path and validation_status='approved') then
 raise exception 'Wait for private file validation to finish before saving this digital product';end if;
 return new;
end $$;
revoke all on function beezio_security.require_approved_digital_file() from public,anon,authenticated;
create trigger digital_file_must_be_approved before insert or update on public.products for each row when(new.is_digital=true) execute function beezio_security.require_approved_digital_file();
