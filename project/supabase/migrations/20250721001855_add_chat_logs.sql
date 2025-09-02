create table if not exists public.chat_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  event text not null,
  metadata jsonb,
  created_at timestamp with time zone default now() not null
);

-- Add RLS policies
alter table public.chat_logs enable row level security;

-- Allow inserts from all authenticated users
create policy "Anyone can create chat logs"
  on public.chat_logs
  for insert
  to authenticated, anon
  with check (true);

-- Only allow admin to read all chat logs
create policy "Only admins can read all chat logs"
  on public.chat_logs
  for select
  to authenticated
  using (auth.uid() in (
    select user_id from public.profiles where role = 'admin'
  ));

-- Create index for improved query performance
create index chat_logs_user_id_idx on public.chat_logs(user_id);
create index chat_logs_event_idx on public.chat_logs(event);
create index chat_logs_created_at_idx on public.chat_logs(created_at);
