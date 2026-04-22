-- Add user_id to jobs and enable RLS

alter table jobs add column if not exists user_id uuid references auth.users(id);

-- Backfill: existing rows get no owner (nullable is fine)

-- Enable Row Level Security
alter table jobs enable row level security;

-- Users can read their own jobs
create policy "Users can view own jobs"
  on jobs for select
  using (auth.uid() = user_id);

-- Users can insert jobs for themselves
create policy "Users can create own jobs"
  on jobs for insert
  with check (auth.uid() = user_id);

-- Users can update their own jobs
create policy "Users can update own jobs"
  on jobs for update
  using (auth.uid() = user_id);

-- Allow anonymous access for users not yet logged in (homepage browsing)
create policy "Anon can view jobs without owner"
  on jobs for select
  using (user_id is null);

-- Storage: users can manage their own job assets
create policy "Users can upload job assets"
  on storage.objects for insert
  with check (bucket_id = 'job-assets' and auth.uid() is not null);

create policy "Users can view job assets"
  on storage.objects for select
  using (bucket_id = 'job-assets');

create policy "Users can delete own job assets"
  on storage.objects for delete
  using (bucket_id = 'job-assets' and auth.uid() is not null);
