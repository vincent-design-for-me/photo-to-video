import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { isSupabaseMode } from "../../../../../lib/supabase";
import { getSignedUrl } from "../../../../../lib/jobs/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) return result.response;
  const { job } = result;
  if (!job.finalVideoPath) return new NextResponse("Final video not ready", { status: 404 });

  if (isSupabaseMode()) {
    const url = await getSignedUrl(job.finalVideoPath);
    return NextResponse.redirect(url, {
      headers: { "Content-Disposition": `attachment; filename="interior-video-${id}.mp4"` }
    });
  }

  const file = await readFile(job.finalVideoPath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="interior-video-${id}.mp4"`
    }
  });
}
