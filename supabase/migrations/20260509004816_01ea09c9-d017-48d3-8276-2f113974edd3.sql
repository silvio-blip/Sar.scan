
-- 1. Storage bucket for scan photos
insert into storage.buckets (id, name, public)
values ('scan-photos', 'scan-photos', true)
on conflict (id) do nothing;

create policy "scan_photos_public_read"
on storage.objects for select
using (bucket_id = 'scan-photos');

create policy "scan_photos_user_insert"
on storage.objects for insert
with check (
  bucket_id = 'scan-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "scan_photos_user_delete"
on storage.objects for delete
using (
  bucket_id = 'scan-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Subscription plan + credits + AI flag
alter table public.subscriptions
  add column if not exists plan text check (plan in ('weekly','monthly','yearly')) ,
  add column if not exists scans_credits integer not null default 0,
  add column if not exists ai_agent_enabled boolean not null default false;

-- 3. Realtime
alter table public.rewards replica identity full;
alter table public.subscriptions replica identity full;
alter table public.scan_usage replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.rewards;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.subscriptions;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.scan_usage;
  exception when duplicate_object then null; end;
end $$;
