begin;
-- Verification is a server-owned assertion, never a browser-editable setting.
-- SECURITY INVOKER preserves the effective caller role; RLS still checks row ownership.
create temporary table verification_probe (id integer primary key, user_id uuid, role text, paypal_email text, is_verified boolean not null default false);
grant select,insert,update on verification_probe to authenticated,service_role;
create trigger probe before insert or update on verification_probe for each row execute function public.protect_paypal_account_verification();
set local role authenticated;
insert into verification_probe values (1,gen_random_uuid(),'SELLER','probe@example.invalid',true);
do $$ begin if (select is_verified from verification_probe where id=1) then raise exception 'FAIL: client insert self-verified'; end if; end $$;
update verification_probe set is_verified=true where id=1;
do $$ begin if (select is_verified from verification_probe where id=1) then raise exception 'FAIL: client update self-verified'; end if; end $$;
insert into verification_probe values (2,gen_random_uuid(),'PARTNER','saved@example.invalid',false);
set local role service_role;
update verification_probe set is_verified=true where id=1;
do $$ begin if not (select is_verified from verification_probe where id=1) then raise exception 'FAIL: trusted verification blocked'; end if; end $$;
set local role authenticated;
update verification_probe set paypal_email=paypal_email where id=1;
do $$ begin if not (select is_verified from verification_probe where id=1) then raise exception 'FAIL: unchanged verified account lost status'; end if; end $$;
update verification_probe set paypal_email='changed@example.invalid',is_verified=true where id=1;
do $$ begin if (select is_verified from verification_probe where id=1) then raise exception 'FAIL: new destination retained verification'; end if; end $$;
update verification_probe set is_verified=true where id=2;
do $$ begin if (select is_verified from verification_probe where id=2) then raise exception 'FAIL: manual saved email became verified'; end if; end $$;
reset role;
select 'PASS: client insert/update blocked; manual save allowed; trusted verification allowed; unchanged destination preserved; changed destination reset' as result;
rollback;
