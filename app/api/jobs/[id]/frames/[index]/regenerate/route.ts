import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../../../lib/jobs/ownership";
import { claimFrameRegeneration } from "../../../../../../../lib/jobs/store";
import { regenerateFrame } from "../../../../../../../lib/jobs/workflow";

export const maxDuration = 300;

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
  if (isNaN(frameIndex) || frameIndex < 0 || frameIndex >= job.sourceImages.length) {
    return new NextResponse("Invalid frame index", { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { appendText?: string };
  const appendText = body.appendText?.trim() ?? "";
  if (!appendText) {
    return new NextResponse("appendText is required", { status: 400 });
  }

  // Atomically mark step `running`, update prompt, clear stale verdict, and record
  // review decision BEFORE returning 202 so /approve immediately sees it across instances.
  const claim = await claimFrameRegeneration(id, frameIndex, appendText);
  if (!claim.claimed) {
    return new NextResponse(claim.reason ?? "Frame cannot be regenerated", { status: 409 });
  }

  after(async () => {
    try {
      await regenerateFrame(id, frameIndex, appendText, { alreadyClaimed: true });
    } catch (error) {
      console.error(`Regen frame ${frameIndex} for job ${id}:`, error);
    }
  });

  return NextResponse.json({ id, index: frameIndex, status: "regenerating" }, { status: 202 });
}
