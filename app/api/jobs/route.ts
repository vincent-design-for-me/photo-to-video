import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildJobAsset, createJob } from "../../../lib/jobs/store";
import { requireAuthenticatedUserId } from "../../../lib/jobs/ownership";
import { isSupabaseMode } from "../../../lib/supabase";
import { isStorageRlsError, uploadBufferToStorage, storageKey } from "../../../lib/jobs/storage";
import { createClient as createServerClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseMode()) {
    return new NextResponse(
      "Server misconfiguration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
      "Add both environment variables in your Vercel project settings.",
      { status: 500 }
    );
  }

  let userId: string | undefined;
  let requestSupabase: Awaited<ReturnType<typeof createServerClient>> | undefined;
  requestSupabase = await createServerClient();
  const auth = await requireAuthenticatedUserId();
  if (auth.response) {
    return auth.response;
  }
  userId = auth.userId;

  const formData = await request.formData();
  const files = formData.getAll("images").filter((value): value is File => value instanceof File);
  const styleId = stringValue(formData.get("styleId"));
  const aspectRatio = stringValue(formData.get("aspectRatio"));
  const resolution = stringValue(formData.get("resolution"));
  const editRequestsRaw = stringValue(formData.get("editRequests"));
  let userEditRequests: string[] | undefined;
  if (editRequestsRaw) {
    try {
      const parsed: unknown = JSON.parse(editRequestsRaw);
      if (Array.isArray(parsed) && parsed.every(v => typeof v === "string")) {
        userEditRequests = (parsed as string[]).map(v => v.trim()).slice(0, files.length);
      }
    } catch { /* treat as no edits */ }
  }

  if (files.length === 0) return new NextResponse("Upload at least one image", { status: 400 });
  if (files.length > 6) return new NextResponse("Upload a maximum of 6 images", { status: 400 });

  const jobId = randomUUID();

  const assets = [];
  for (const [index, file] of files.entries()) {
    const extension = extensionFor(file.name, file.type);
    const safeName = `source-${index + 1}${extension}`;
    const contentType = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());

    const key = storageKey(jobId, `source/${safeName}`);
    try {
      await uploadBufferToStorage(key, buffer, contentType, requestSupabase);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storage upload failed";
      if (isStorageRlsError(message)) {
        return new NextResponse(
          "Storage upload was rejected by Supabase RLS. Apply the latest storage policy migration and verify your storage bucket policies.",
          { status: 500 }
        );
      }
      return new NextResponse(`Storage upload failed: ${message}`, { status: 500 });
    }
    assets.push(await buildJobAsset(key, file.name || safeName, contentType, buffer.byteLength));
  }

  let job;
  try {
    job = await createJob(
      assets,
      jobId,
      styleId,
      aspectRatio,
      resolution,
      userEditRequests,
      userId,
      requestSupabase
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job";
    return new NextResponse(`Job creation failed: ${message}`, { status: 500 });
  }
  return NextResponse.json({ id: job.id, status: job.status });
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function extensionFor(name: string, type: string): string {
  const fromName = path.extname(name);
  if (fromName) return fromName.toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}
