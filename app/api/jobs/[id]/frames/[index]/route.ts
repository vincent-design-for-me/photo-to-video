import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJob } from "../../../../../../lib/jobs/store";
import { isSupabaseMode } from "../../../../../../lib/supabase";
import { getSignedUrl } from "../../../../../../lib/jobs/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await context.params;
  const job = await getJob(id);
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const frameIndex = parseInt(index, 10);
  const framePath = job.generatedFrames[frameIndex];
  if (!framePath) return new NextResponse("Frame not found", { status: 404 });

  if (isSupabaseMode()) {
    const url = await getSignedUrl(framePath);
    return NextResponse.redirect(url);
  }

  const ext = path.extname(framePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const file = await readFile(framePath);
  return new NextResponse(file, {
    headers: { "Content-Type": contentType, "Cache-Control": "no-store" }
  });
}
