import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJob } from "../../../../../../lib/jobs/store";
import { isSupabaseMode } from "../../../../../../lib/supabase";
import { getSignedUrl } from "../../../../../../lib/jobs/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await context.params;
  const job = await getJob(id);
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const clipIndex = parseInt(index, 10);
  const clipPath = job.generatedClips[clipIndex];
  if (!clipPath) return new NextResponse("Clip not found", { status: 404 });

  if (isSupabaseMode()) {
    const url = await getSignedUrl(clipPath);
    return NextResponse.redirect(url);
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(clipPath);
  } catch {
    return new NextResponse("Clip file not found", { status: 404 });
  }

  const ext = path.extname(clipPath).toLowerCase();
  const contentType = ext === ".webm" ? "video/webm" : "video/mp4";
  const total = stat.size;

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : total - 1;
    const chunkSize = end - start + 1;
    const stream = createReadStream(clipPath, { start, end });
    const body = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });
    return new NextResponse(body, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Cache-Control": "no-store",
      },
    });
  }

  const stream = createReadStream(clipPath);
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(total),
      "Cache-Control": "no-store",
    },
  });
}
