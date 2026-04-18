import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJob } from "../../../../../../lib/jobs/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await context.params;
  const job = await getJob(id);
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }

  const sourceIndex = parseInt(index, 10);
  const source = job.sourceImages[sourceIndex];
  if (!source) {
    return new NextResponse("Source image not found", { status: 404 });
  }

  const ext = path.extname(source.path).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  const file = await readFile(source.path);
  return new NextResponse(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    }
  });
}
