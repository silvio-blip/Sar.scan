-- Create password_reset_codes table to store security codes for recovery
create table if not exists public.password_reset_codes (
  email text primary key,
  code text not null,
  created_at timestamptz not null default now(),
  user_id uuid not null
);

-- Turn on row level security
alter table public.password_reset_codes enable row level security;

-- Create policy to allow full operations for service role bypass/checks
create policy "Allow full operations for service role" on public.password_reset_codes
  for all using (true) with check (true);
