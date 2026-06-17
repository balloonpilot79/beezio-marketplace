create table if not exists public.admin_finance_closeout_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  report_title text not null,
  closeout_start_date date not null,
  closeout_end_date date not null,
  order_search text not null default '',
  tax_year integer,
  generated_at timestamptz not null default now(),
  row_count integer not null default 0,
  gross_sales numeric(12,2) not null default 0,
  total_payouts numeric(12,2) not null default 0,
  beezio_net numeric(12,2) not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  headers_json jsonb not null default '[]'::jsonb,
  rows_json jsonb not null default '[]'::jsonb,
  csv_content text not null default ''
);

create index if not exists admin_finance_closeout_reports_created_at_idx
  on public.admin_finance_closeout_reports(created_at desc);

create index if not exists admin_finance_closeout_reports_window_idx
  on public.admin_finance_closeout_reports(closeout_start_date desc, closeout_end_date desc);

create index if not exists admin_finance_closeout_reports_created_by_idx
  on public.admin_finance_closeout_reports(created_by_user_id, created_at desc);

alter table public.admin_finance_closeout_reports enable row level security;

drop policy if exists "finance closeout reports admin select" on public.admin_finance_closeout_reports;
create policy "finance closeout reports admin select"
on public.admin_finance_closeout_reports
for select
to authenticated
using (public.is_beezio_admin());

drop policy if exists "finance closeout reports admin insert" on public.admin_finance_closeout_reports;
create policy "finance closeout reports admin insert"
on public.admin_finance_closeout_reports
for insert
to authenticated
with check (public.is_beezio_admin());
