import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJob } from "../../../../../../lib/jobs/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await context.params;

  const safe = path.basename(filename);
  if (safe !== filename || safe.includes("..")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const job = await getJob(id);
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }

  const candidates = [
    path.join(job.rootDir, "source", safe),
    path.join(job.rootDir, "generated", safe)
  ];

  let filePath: string | undefined;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      filePath = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!filePath) {
    return new NextResponse("Asset not found", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  const file = await readFile(filePath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    }
  });
}
