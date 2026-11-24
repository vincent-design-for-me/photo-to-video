import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { claimJobExecution } from "../../../../../lib/jobs/store";
import { runImagePhase, runVideoPhase } from "../../../../../lib/jobs/workflow";

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
  const phase = framesComplete ? runVideoPhase : runImagePhase;

  after(async () => {
    try {
      await phase(id);
    } catch (error) {
      console.error(`[run] job ${id} failed:`, error);
    }
  });

  return NextResponse.json({ id, status: "running" }, { status: 202 });
}
