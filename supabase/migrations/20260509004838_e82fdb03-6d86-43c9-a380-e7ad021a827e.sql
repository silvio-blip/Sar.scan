
drop policy if exists "scan_photos_public_read" on storage.objects;

create policy "scan_photos_owner_read"
on storage.objects for select
using (
  bucket_id = 'scan-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
