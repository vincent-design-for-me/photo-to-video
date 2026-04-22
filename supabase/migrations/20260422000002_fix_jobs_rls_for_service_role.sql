-- Allow authenticated users to create their own jobs during the initial request
-- and allow service_role to continue job updates during background workflow steps.

drop policy if exists "Users can view own jobs" on jobs;
drop policy if exists "Users can create own jobs" on jobs;
drop policy if exists "Users can update own jobs" on jobs;
drop policy if exists "Anon can view jobs without owner" on jobs;

create policy "Users can view own jobs"
  on jobs for select
  using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
  );

create policy "Users can create own jobs"
  on jobs for insert
  with check (
    auth.uid() = user_id
    or auth.role() = 'service_role'
  );

create policy "Users can update own jobs"
  on jobs for update
  using (
    auth.uid() = user_id
    or auth.role() = 'service_role'
  );

create policy "Anon can view jobs without owner"
  on jobs for select
  using (user_id is null);
