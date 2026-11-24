// Store helpers for the structural-consistency judge. Mode-agnostic: they go
// through the store barrel with column-scoped CAS updates so judging never
// overwrites concurrent status/step transitions (e.g. approve or regenerate).
import { mutateJob } from "./store";
import type { ReviewDecision, StoredFrameJudgement } from "./types";

/** Write (or clear, with null) the judgement for a single frame index. */
export async function setFrameJudgement(
  jobId: string,
  index: number,
  judgement: StoredFrameJudgement | null
): Promise<void> {
  await mutateJob(jobId, (job) => {
    const targetLength = Math.max(job.generatedFrames.length, index + 1);
    const judgements = [...(job.frameJudgements ?? [])];
    while (judgements.length < targetLength) judgements.push(null);
    judgements[index] = judgement;
    return { frameJudgements: judgements };
  });
}

/** Append one or more reviewer decisions to the job's review log. */
export async function recordReviewDecisions(
  jobId: string,
  decisions: ReviewDecision[]
): Promise<void> {
  if (decisions.length === 0) return;
  await mutateJob(jobId, (job) => ({
    reviewDecisions: [...(job.reviewDecisions ?? []), ...decisions],
  }));
}
