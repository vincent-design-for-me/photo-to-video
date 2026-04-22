import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase";

const BUCKET = "job-assets";

function clientOrDefault(client?: SupabaseClient) {
  return client ?? getSupabaseClient();
}

export async function uploadToStorage(
  storageKey: string,
  localPath: string,
  contentType: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = clientOrDefault(client);
  const buffer = await readFile(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function uploadBufferToStorage(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = clientOrDefault(client);
  const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadFromStorage(storageKey: string, localPath: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(storageKey);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  await mkdir(path.dirname(localPath), { recursive: true });
  const buffer = Buffer.from(await data.arrayBuffer());
  const { writeFile } = await import("node:fs/promises");
  await writeFile(localPath, buffer);
}

export async function getSignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storageKey, expiresIn);
  if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message}`);
  return data.signedUrl;
}

export function storageKey(jobId: string, subpath: string): string {
  return `${jobId}/${subpath}`;
}

export function isStorageRlsError(message: string): boolean {
  return /row-level security policy/i.test(message);
}

export const storagePolicySql = `
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
`;
