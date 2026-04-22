import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../../lib/jobs/ownership";
import { isSupabaseMode } from "../../../../../../lib/supabase";
import { getSignedUrl } from "../../../../../../lib/jobs/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) return result.response;
  const { job } = result;

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
