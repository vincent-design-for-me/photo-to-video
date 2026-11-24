import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { isR2Configured } from "../../../../../lib/cloudflare/config";
import { getSignedUrl } from "../../../../../lib/jobs/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) return result.response;
  const { job } = result;
  if (!job.finalVideoPath) return new NextResponse("Final video not ready", { status: 404 });

  const urlObj = new URL(request.url);
  const asAttachment = urlObj.searchParams.get("download") === "1";
  const filename = `interior-video-${id}.mp4`;

  if (isR2Configured()) {
    const url = await getSignedUrl(
      job.finalVideoPath,
      3600,
      asAttachment ? { download: filename } : undefined
    );
    return NextResponse.redirect(url);
  }

  const file = await readFile(job.finalVideoPath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "video/mp4",
      ...(asAttachment ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    }
  });
}
