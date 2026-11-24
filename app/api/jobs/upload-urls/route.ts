import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isR2Configured } from "../../../../lib/cloudflare/config";
import { requireAuthenticatedUserId } from "../../../../lib/jobs/ownership";
import { createSignedUploadUrl, storageKey } from "../../../../lib/jobs/storage";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per image
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type UploadFileMeta = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return new NextResponse("Direct upload requires Cloudflare R2 configuration", { status: 501 });
  }

  const auth = await requireAuthenticatedUserId();
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as { files?: UploadFileMeta[] } | null;
  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return new NextResponse("Upload at least one image", { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return new NextResponse(`Upload a maximum of ${MAX_FILES} images`, { status: 400 });
  }

  const jobId = randomUUID();
  const uploads = [];

  for (const [index, meta] of files.entries()) {
    const name = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : `photo-${index + 1}.jpg`;
    const type = typeof meta.type === "string" && meta.type.trim() ? meta.type.trim().toLowerCase() : "image/jpeg";
    const size = typeof meta.size === "number" && Number.isFinite(meta.size) && meta.size >= 0 ? meta.size : 0;

    if (!ALLOWED_MIME_TYPES.has(type)) {
      return new NextResponse(`Unsupported image type "${type}" for ${name}`, { status: 400 });
    }
    if (size > MAX_FILE_BYTES) {
      return new NextResponse(`Image "${name}" exceeds the 25 MB per-file limit`, { status: 400 });
    }

    const ext = extensionFor(name, type);
    const key = storageKey(jobId, `source/source-${index + 1}${ext}`);

    try {
      const signed = await createSignedUploadUrl(key, type);
      uploads.push({
        index,
        key,
        path: signed.path,
        signedUrl: signed.signedUrl,
        name,
        type,
        size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare upload URL";
      return new NextResponse(message, { status: 500 });
    }
  }

  return NextResponse.json({ jobId, uploads });
}

function extensionFor(name: string, type: string): string {
  const fromName = path.extname(name).toLowerCase();
  if (fromName && /^\.[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/heic") return ".heic";
  if (type === "image/heif") return ".heif";
  return ".jpg";
}
