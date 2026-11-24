import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isCloudMode } from "../../../lib/cloudflare/config";
import { buildJobAsset, createJob } from "../../../lib/jobs/store";
import { requireAuthenticatedUserId } from "../../../lib/jobs/ownership";
import {
  deleteFromStorage,
  storageKey,
  uploadBufferToStorage,
} from "../../../lib/jobs/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DirectUploadFile = {
  key?: unknown;
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

type DirectCreatePayload = {
  jobId?: unknown;
  files?: DirectUploadFile[];
  styleId?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
  editRequests?: unknown;
};

export async function POST(request: Request) {
  if (!isCloudMode()) {
    return new NextResponse(
      "Server misconfiguration: Cloudflare D1 and R2 environment variables must be set " +
        "(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).",
      { status: 500 }
    );
  }

  const auth = await requireAuthenticatedUserId();
  if (auth.response) {
    return auth.response;
  }
  const userId = auth.userId;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return handleDirectUploadCreate(request, userId);
  }

  return handleMultipartCreate(request, userId);
}

async function handleDirectUploadCreate(request: Request, userId: string | undefined) {
  const body = (await request.json().catch(() => null)) as DirectCreatePayload | null;
  if (!body || typeof body.jobId !== "string" || !UUID_RE.test(body.jobId)) {
    return new NextResponse("Invalid or missing jobId", { status: 400 });
  }

  const jobId = body.jobId;
  const files = body.files;
  if (!Array.isArray(files) || files.length === 0) {
    return new NextResponse("Upload at least one image", { status: 400 });
  }
  if (files.length > 6) {
    return new NextResponse("Upload a maximum of 6 images", { status: 400 });
  }

  const assets = [];
  const keys: string[] = [];
  const expectedPrefix = `${jobId}/source/`;

  for (const [index, file] of files.entries()) {
    if (
      typeof file.key !== "string" ||
      !file.key.startsWith(expectedPrefix) ||
      file.key.includes("..")
    ) {
      return new NextResponse(`Invalid storage key at index ${index}`, { status: 400 });
    }
    const name = typeof file.name === "string" && file.name.trim() ? file.name.trim() : path.basename(file.key);
    const type = typeof file.type === "string" && file.type.trim() ? file.type.trim() : "image/jpeg";
    const size = typeof file.size === "number" && Number.isFinite(file.size) && file.size >= 0 ? file.size : 0;

    keys.push(file.key);
    assets.push(await buildJobAsset(file.key, name, type, size));
  }

  const styleId = typeof body.styleId === "string" && body.styleId.length > 0 ? body.styleId : undefined;
  const aspectRatio = typeof body.aspectRatio === "string" && body.aspectRatio.length > 0 ? body.aspectRatio : undefined;
  const resolution = typeof body.resolution === "string" && body.resolution.length > 0 ? body.resolution : undefined;
  const userEditRequests = Array.isArray(body.editRequests) && body.editRequests.every((v) => typeof v === "string")
    ? (body.editRequests as string[]).map((v) => v.trim()).slice(0, files.length)
    : undefined;

  try {
    const job = await createJob(
      assets,
      jobId,
      styleId,
      aspectRatio,
      resolution,
      userEditRequests,
      userId
    );
    return NextResponse.json({ id: job.id, status: job.status });
  } catch (error) {
    await deleteFromStorage(keys);
    const message = error instanceof Error ? error.message : "Failed to create job";
    return new NextResponse(`Job creation failed: ${message}`, { status: 500 });
  }
}

async function handleMultipartCreate(request: Request, userId: string | undefined) {
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
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        userEditRequests = (parsed as string[]).map((v) => v.trim()).slice(0, files.length);
      }
    } catch { /* treat as no edits */ }
  }

  if (files.length === 0) return new NextResponse("Upload at least one image", { status: 400 });
  if (files.length > 6) return new NextResponse("Upload a maximum of 6 images", { status: 400 });

  const jobId = randomUUID();
  const assets = [];
  const uploadedKeys: string[] = [];

  for (const [index, file] of files.entries()) {
    const extension = extensionFor(file.name, file.type);
    const safeName = `source-${index + 1}${extension}`;
    const contentType = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());

    const key = storageKey(jobId, `source/${safeName}`);
    try {
      await uploadBufferToStorage(key, buffer, contentType);
      uploadedKeys.push(key);
    } catch (error) {
      await deleteFromStorage(uploadedKeys);
      const message = error instanceof Error ? error.message : "Storage upload failed";
      return new NextResponse(`Storage upload failed: ${message}`, { status: 500 });
    }
    assets.push(await buildJobAsset(key, file.name || safeName, contentType, buffer.byteLength));
  }

  try {
    const job = await createJob(
      assets,
      jobId,
      styleId,
      aspectRatio,
      resolution,
      userEditRequests,
      userId
    );
    return NextResponse.json({ id: job.id, status: job.status });
  } catch (error) {
    await deleteFromStorage(uploadedKeys);
    const message = error instanceof Error ? error.message : "Failed to create job";
    return new NextResponse(`Job creation failed: ${message}`, { status: 500 });
  }
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
