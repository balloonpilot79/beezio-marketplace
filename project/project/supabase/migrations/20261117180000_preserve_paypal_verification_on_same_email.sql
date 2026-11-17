-- Email ownership is server-owned. Repeated browser Saves must not revoke it.
create or replace function public.protect_paypal_account_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.paypal_email := pg_catalog.lower(pg_catalog.btrim(new.paypal_email));
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    elsif new.paypal_email is distinct from pg_catalog.lower(pg_catalog.btrim(old.paypal_email))
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role then
      new.is_verified := false;
    else
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end;
$$;
