// Orchestration for the structural-consistency judge: run judgeFrame() over the
// generated frames and persist the verdicts. Best-effort by design — a judging
// failure (LLM down, not configured) must NEVER fail or block the video job.
import path from "node:path";
import { runWithConcurrency } from "../http/fetchWithRetry";
import { judgeFrame } from "../providers/judgeFrame";
import { getJudgeLLMConfig } from "../providers/geminiCompat";
import { setFrameJudgement } from "./judgements";

const JUDGE_CONCURRENCY = Math.max(1, Number(process.env.JUDGE_CONCURRENCY ?? 2));

/** Pass threshold, overridable per-environment via JUDGE_THRESHOLD. */
function judgeThreshold(): number {
  const raw = Number(process.env.JUDGE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : 70;
}

function frameLocalPath(rootDir: string, index: number): string {
  return path.join(rootDir, "generated", `frame-${index + 1}.png`);
}

/**
 * Judge one frame and write the verdict back. Local paths are passed in by the
 * caller because, in Supabase mode, a reloaded job carries storage keys (not the
 * local /tmp paths) for its source images.
 */
export async function judgeFrameAndStore(
  jobId: string,
  index: number,
  beforeLocalPath: string,
  afterLocalPath: string
): Promise<void> {
  if (!getJudgeLLMConfig()) return;
  try {
    const verdict = await judgeFrame({
      beforeImagePath: beforeLocalPath,
      afterImagePath: afterLocalPath,
      threshold: judgeThreshold(),
    });
    await setFrameJudgement(jobId, index, { ...verdict, judgedAt: new Date().toISOString() });
  } catch (error) {
    console.warn(`[judge] frame ${index} of job ${jobId}: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Judge every generated frame for a job after the image phase. Call AFTER the
 * job is set to awaiting_review so the reviewer sees frames immediately and the
 * scores stream in. `sourceLocalPaths` must be the on-disk source paths.
 */
export async function judgeAllFrames(
  jobId: string,
  rootDir: string,
  sourceLocalPaths: string[],
  existingJudgements?: readonly (unknown | null)[]
): Promise<void> {
  if (!getJudgeLLMConfig()) return; // no judge LLM configured — skip silently
  const indices = sourceLocalPaths
    .map((_, index) => index)
    .filter((index) => !existingJudgements?.[index]);

  await runWithConcurrency(indices, JUDGE_CONCURRENCY, async (index) => {
    await judgeFrameAndStore(jobId, index, sourceLocalPaths[index], frameLocalPath(rootDir, index));
  });
}
