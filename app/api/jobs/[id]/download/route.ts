import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getJob } from "../../../../../lib/jobs/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await getJob(id);
  if (!job?.finalVideoPath) {
    return new NextResponse("Final video not ready", { status: 404 });
  }

  const file = await readFile(job.finalVideoPath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="interior-video-${id}.mp4"`
    }
  });
}
