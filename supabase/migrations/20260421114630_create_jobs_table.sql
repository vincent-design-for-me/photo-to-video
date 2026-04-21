create table if not exists jobs (
  id uuid primary key,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  config jsonb not null default '{}',
  source_images jsonb not null default '[]',
  generated_frames jsonb not null default '[]',
  frame_prompts jsonb,
  user_edit_requests jsonb,
  generated_clips jsonb not null default '[]',
  final_video_path text,
  error text,
  steps jsonb not null default '[]'
);

-- Storage bucket for all job assets
insert into storage.buckets (id, name, public)
values ('job-assets', 'job-assets', false)
on conflict (id) do nothing;
