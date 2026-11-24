import { NextResponse } from "next/server";
import { dispatchFrameRegeneration } from "../../../../../../../lib/inngest/dispatch";
import { requireOwnedJob } from "../../../../../../../lib/jobs/ownership";
import { claimFrameRegeneration, mutateJob } from "../../../../../../../lib/jobs/store";

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

  try {
    const dispatched = await dispatchFrameRegeneration(id, frameIndex, appendText, job.userId);
    return NextResponse.json(
      { id, index: frameIndex, status: "regenerating", queue: dispatched.mode },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue frame regeneration";
    const now = new Date().toISOString();
    await mutateJob(id, (current) => ({
      error: message,
      steps: current.steps.map((s) =>
        s.kind === "image" && s.index === frameIndex
          ? { ...s, status: "failed" as const, updatedAt: now }
          : s
      ),
    })).catch(() => {});
    return new NextResponse(message, { status: 502 });
  }
}
