-- Allow both authenticated users and service_role to manage job-assets objects.
-- Authenticated users are needed for source uploads during the initial request.
-- service_role is needed for background workflow uploads (generated frames/clips/final video).

drop policy if exists "Users can upload job assets" on storage.objects;
drop policy if exists "Users can view job assets" on storage.objects;
drop policy if exists "Users can delete own job assets" on storage.objects;

create policy "Users can upload job assets"
  on storage.objects for insert
  with check (
    bucket_id = 'job-assets'
    and (
      auth.uid() is not null
      or auth.role() = 'service_role'
    )
  );

create policy "Users can view job assets"
  on storage.objects for select
  using (
    bucket_id = 'job-assets'
    and (
      auth.uid() is not null
      or auth.role() = 'service_role'
    )
  );

create policy "Users can delete own job assets"
  on storage.objects for delete
  using (
    bucket_id = 'job-assets'
    and (
      auth.uid() is not null
      or auth.role() = 'service_role'
    )
  );
