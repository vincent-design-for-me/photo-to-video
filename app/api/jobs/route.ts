import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildJobAsset, createJob, ensureJobDirs } from "../../../lib/jobs/store";
import { isSupabaseMode } from "../../../lib/supabase";
import { uploadBufferToStorage, storageKey } from "../../../lib/jobs/storage";

export async function POST(request: Request) {
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
  const rootDir = await ensureJobDirs(jobId);
  const sourceDir = path.join(rootDir, "source");
  await mkdir(sourceDir, { recursive: true });

  const assets = [];
  for (const [index, file] of files.entries()) {
    const extension = extensionFor(file.name, file.type);
    const safeName = `source-${index + 1}${extension}`;
    const contentType = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isSupabaseMode()) {
      const key = storageKey(jobId, `source/${safeName}`);
      await uploadBufferToStorage(key, buffer, contentType);
      assets.push(await buildJobAsset(key, file.name || safeName, contentType, buffer.byteLength));
    } else {
      const outputPath = path.join(sourceDir, safeName);
      await writeFile(outputPath, buffer);
      assets.push(await buildJobAsset(outputPath, file.name || safeName, contentType));
    }
  }

  const job = await createJob(assets, jobId, styleId, aspectRatio, resolution, userEditRequests);
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
