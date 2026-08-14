alter table public.cj_fulfillment_settings
  alter column max_auto_pay_order set default 500;

update public.cj_fulfillment_settings
set max_auto_pay_order = 500,
    updated_at = now()
where id = 1
  and max_auto_pay_order < 500;
