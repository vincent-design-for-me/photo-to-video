import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../../../lib/jobs/ownership";
import { regenerateFrame } from "../../../../../../../lib/jobs/workflow";
import { regeneratingFrames } from "../../../../../../../lib/jobs/regenState";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index: indexStr } = await context.params;
  const frameIndex = parseInt(indexStr, 10);

  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }
  const { job } = result;
  if (job.status !== "awaiting_review") {
    return new NextResponse("Job is not in review state", { status: 409 });
  }
  if (isNaN(frameIndex) || frameIndex < 0 || frameIndex >= job.sourceImages.length) {
    return new NextResponse("Invalid frame index", { status: 400 });
  }

  const body = await request.json().catch(() => ({})) as { appendText?: string };
  const appendText = body.appendText?.trim() ?? "";
  if (!appendText) {
    return new NextResponse("appendText is required", { status: 400 });
  }

  const key = `${id}:${frameIndex}`;
  const imageStep = job.steps.find((s) => s.kind === "image" && s.index === frameIndex);

  // Allow recovery if server restarted mid-regen (step stuck running but no in-flight promise)
  if (regeneratingFrames.has(key) && imageStep?.status === "running") {
    return new NextResponse("Frame is already regenerating", { status: 409 });
  }

  regeneratingFrames.add(key);
  after(async () => {
    try {
      await regenerateFrame(id, frameIndex, appendText);
    } catch (error) {
      console.error(`Regen frame ${frameIndex} for job ${id}:`, error);
    } finally {
      regeneratingFrames.delete(key);
    }
  });

  return NextResponse.json({ id, index: frameIndex, status: "regenerating" }, { status: 202 });
}
