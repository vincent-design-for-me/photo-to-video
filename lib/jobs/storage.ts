import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getSupabaseClient } from "../supabase";

const BUCKET = "job-assets";

export async function uploadToStorage(storageKey: string, localPath: string, contentType: string): Promise<void> {
  const supabase = getSupabaseClient();
  const buffer = await readFile(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storageKey, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function uploadBufferToStorage(storageKey: string, buffer: Buffer, contentType: string): Promise<void> {
  const supabase = getSupabaseClient();
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
