-- Create plan limits table
create table if not exists public.plan_limits (
  plan text primary key,
  chat_limit integer not null default -1 -- -1 means unlimited
);

-- Insert default limits
insert into public.plan_limits (plan, chat_limit)
values 
  ('weekly', 0),
  ('monthly', 50), -- 50 messages per day
  ('yearly', -1)
on conflict (plan) do update set chat_limit = excluded.chat_limit;

-- Create chat usage table
create table if not exists public.chat_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usage_count integer default 0,
  last_message_at timestamp with time zone default now(),
  last_reset_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.plan_limits enable row level security;
alter table public.chat_usage enable row level security;

-- Policies for plan_limits (everyone can read)
create policy "Anyone can read plan limits"
  on public.plan_limits for select
  using (true);

-- Policies for chat_usage (user can read/write their own)
create policy "Users can read their own chat usage"
  on public.chat_usage for select
  using (auth.uid() = user_id);

create policy "Users can update their own chat usage"
  on public.chat_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can modify their own chat usage"
  on public.chat_usage for update
  using (auth.uid() = user_id);
