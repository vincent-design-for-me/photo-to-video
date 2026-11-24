import { NextResponse } from "next/server";
import { dispatchImagePhase, dispatchVideoPhase } from "../../../../../lib/inngest/dispatch";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { claimJobExecution, mutateJob } from "../../../../../lib/jobs/store";

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }

  // Atomic DB-level claim across all serverless instances.
  // Also permits reclaiming a stale `running` job whose serverless container was killed.
  const claim = await claimJobExecution(id, {
    allowedStatuses: ["queued", "failed"],
    allowStaleRunning: true,
  });

  if (!claim.claimed || !claim.job) {
    return new NextResponse(claim.reason ?? "Job cannot be started", { status: 409 });
  }

  const job = claim.job;
  const framesComplete =
    job.sourceImages.length > 0 &&
    job.sourceImages.every((_, index) => {
      const step = job.steps.find((s) => s.kind === "image" && s.index === index);
      return step?.status === "complete" && Boolean(job.generatedFrames?.[index]);
    });

  try {
    const dispatched = framesComplete
      ? await dispatchVideoPhase(id, job.userId)
      : await dispatchImagePhase(id, job.userId);
    return NextResponse.json({ id, status: "running", queue: dispatched.mode }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue job";
    await mutateJob(id, () => ({ status: "failed", error: message })).catch(() => {});
    return new NextResponse(message, { status: 502 });
  }
}
