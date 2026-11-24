import { after, NextResponse } from "next/server";
import { requireOwnedJob } from "../../../../../lib/jobs/ownership";
import { claimJobExecution } from "../../../../../lib/jobs/store";
import { runVideoPhase } from "../../../../../lib/jobs/workflow";
import { recordReviewDecisions } from "../../../../../lib/jobs/judgements";

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireOwnedJob(id);
  if (result.response) {
    return result.response;
  }

  // Atomic DB-level claim: enforces status === awaiting_review AND no active frame regens
  // across all Vercel Serverless instances (replaces process-local Sets).
  const claim = await claimJobExecution(id, {
    allowedStatuses: ["awaiting_review"],
    requireNoActiveFrameRegen: true,
  });

  if (!claim.claimed || !claim.job) {
    return new NextResponse(claim.reason ?? "Job is not in review state", { status: 409 });
  }

  const job = claim.job;
  const now = new Date().toISOString();
  await recordReviewDecisions(
    id,
    job.generatedFrames.map((_, frameIndex) => {
      const verdict = job.frameJudgements?.[frameIndex] ?? null;
      return {
        frameIndex,
        decision: "kept" as const,
        score: verdict?.consistencyScore ?? null,
        passed: verdict?.passed ?? null,
        at: now,
      };
    })
  );

  after(async () => {
    try {
      await runVideoPhase(id);
    } catch (error) {
      console.error(`[approve] job ${id} failed:`, error);
    }
  });

  return NextResponse.json({ id, status: "running" }, { status: 202 });
}
