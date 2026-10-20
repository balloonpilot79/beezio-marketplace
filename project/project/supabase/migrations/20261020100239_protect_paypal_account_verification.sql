-- Verification is a server-owned assertion, never a browser-editable setting.
-- SECURITY INVOKER preserves the effective caller role; RLS still checks row ownership.
create or replace function public.protect_paypal_account_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.is_verified := false;
    elsif new.paypal_email is distinct from old.paypal_email
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role then
      new.is_verified := false;
    else
      new.is_verified := old.is_verified and new.is_verified;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger protect_paypal_account_verification
before insert or update on public.paypal_accounts
for each row execute function public.protect_paypal_account_verification();
