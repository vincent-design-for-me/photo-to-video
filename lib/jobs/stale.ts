import type { VideoJob } from "./types";

/** Default threshold after which a `running` job/step with no updates is considered orphaned. */
export const DEFAULT_STALE_RUNNING_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_STALE_REGEN_MS = 5 * 60 * 1000; // 5 minutes

export function isTimestampStale(
  isoTimestamp: string | undefined,
  staleAfterMs = DEFAULT_STALE_RUNNING_MS,
  nowMs = Date.now()
): boolean {
  if (!isoTimestamp) return true;
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= staleAfterMs;
}

export function isJobRunningStale(
  job: Pick<VideoJob, "status" | "updatedAt">,
  staleAfterMs = DEFAULT_STALE_RUNNING_MS,
  nowMs = Date.now()
): boolean {
  return job.status === "running" && isTimestampStale(job.updatedAt, staleAfterMs, nowMs);
}

export function hasActiveFrameRegeneration(
  job: Pick<VideoJob, "steps">,
  staleAfterMs = DEFAULT_STALE_REGEN_MS,
  nowMs = Date.now()
): boolean {
  return job.steps.some(
    (step) =>
      step.kind === "image" &&
      step.status === "running" &&
      !isTimestampStale(step.updatedAt, staleAfterMs, nowMs)
  );
}
