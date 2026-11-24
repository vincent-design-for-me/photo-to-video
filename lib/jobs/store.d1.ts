import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, jobs, type JobRow, type NewJobRow } from "../db";
import { DEFAULT_WORKFLOW_CONFIG } from "./config";
import { getInteriorStylePrompt } from "../prompts/interiorStyles";
import {
  DEFAULT_STALE_REGEN_MS,
  DEFAULT_STALE_RUNNING_MS,
  hasActiveFrameRegeneration,
  isJobRunningStale,
  isTimestampStale,
} from "./stale";
import type { JobAsset, JobStatus, StepKind, StepStatus, VideoJob } from "./types";

const TMP_DIR = "/tmp";
const MAX_CAS_RETRIES = 6;

export type JobPatch = Partial<
  Pick<
    VideoJob,
    | "status"
    | "config"
    | "sourceImages"
    | "generatedFrames"
    | "frameJudgements"
    | "reviewDecisions"
    | "framePrompts"
    | "userEditRequests"
    | "generatedClips"
    | "finalVideoPath"
    | "error"
    | "steps"
  >
>;

export type ClaimExecutionOptions = {
  allowedStatuses: JobStatus[];
  allowStaleRunning?: boolean;
  staleAfterMs?: number;
  requireNoActiveFrameRegen?: boolean;
};

export type ClaimResult = {
  claimed: boolean;
  job: VideoJob | null;
  reason?: string;
};

export async function ensureJobDirs(jobId: string): Promise<string> {
  const rootDir = path.join(TMP_DIR, jobId);
  await mkdir(path.join(rootDir, "source"), { recursive: true });
  await mkdir(path.join(rootDir, "generated"), { recursive: true });
  await mkdir(path.join(rootDir, "clips"), { recursive: true });
  await mkdir(path.join(rootDir, "work"), { recursive: true });
  return rootDir;
}

function computeOutputDimensions(aspectRatio: string, resolution: string): { outputWidth: number; outputHeight: number } {
  const px = resolution === "4k" ? 2160 : resolution === "720p" ? 720 : 1080;
  if (aspectRatio === "16:9") return { outputWidth: Math.round((px * 16) / 9), outputHeight: px };
  if (aspectRatio === "1:1") return { outputWidth: px, outputHeight: px };
  if (aspectRatio === "4:3") return { outputWidth: Math.round((px * 4) / 3), outputHeight: px };
  if (aspectRatio === "3:4") return { outputWidth: px, outputHeight: Math.round((px * 4) / 3) };
  return { outputWidth: px, outputHeight: Math.round((px * 16) / 9) };
}

export async function createJob(
  files: JobAsset[],
  id: string = randomUUID(),
  styleId = DEFAULT_WORKFLOW_CONFIG.styleId,
  aspectRatio = DEFAULT_WORKFLOW_CONFIG.aspectRatio,
  resolution = DEFAULT_WORKFLOW_CONFIG.resolution,
  userEditRequests?: string[],
  userId?: string
): Promise<VideoJob> {
  const rootDir = await ensureJobDirs(id);
  const now = new Date().toISOString();
  const style = getInteriorStylePrompt(styleId);
  const { outputWidth, outputHeight } = computeOutputDimensions(aspectRatio, resolution);
  const normalizedEditRequests = userEditRequests
    ? files.map((_, i) => (userEditRequests[i] ?? "").trim())
    : undefined;
  const hasAnyEdit = normalizedEditRequests?.some((r) => r.length > 0);

  const job: VideoJob = {
    id,
    ...(userId ? { userId } : {}),
    rootDir,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    sourceImages: files,
    generatedFrames: [],
    ...(hasAnyEdit ? { userEditRequests: normalizedEditRequests } : {}),
    generatedClips: [],
    config: {
      ...DEFAULT_WORKFLOW_CONFIG,
      styleId: style.id,
      style: style.name,
      aspectRatio,
      resolution,
      outputWidth,
      outputHeight,
    },
    steps: [
      ...files.map((file, index) => ({
        id: `prompt-${index}`,
        kind: "prompt" as const,
        index,
        label: `Generating prompt ${index + 1}: ${file.name}`,
        status: "queued" as const,
      })),
      ...files.map((file, index) => ({
        id: `image-${index}`,
        kind: "image" as const,
        index,
        label: `Nano Banana frame ${index + 1}: ${file.name}`,
        status: "queued" as const,
      })),
      ...files.map((file, index) => ({
        id: `video-${index}`,
        kind: "video" as const,
        index,
        label: `Kling clip ${index + 1}: ${file.name}`,
        status: "queued" as const,
      })),
      ...(files.length > 1
        ? [
            {
              id: "render-0",
              kind: "render" as const,
              index: 0,
              label: "FFmpeg final timeline",
              status: "queued" as const,
            },
          ]
        : []),
    ],
  };

  await writeJob(job);
  return job;
}

export async function getJob(jobId: string): Promise<VideoJob | null> {
  const db = getDb();
  const row = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1).get();
  return row ? rowToJob(row) : null;
}

export async function writeJob(job: VideoJob): Promise<void> {
  const db = getDb();
  const values: NewJobRow = {
    id: job.id,
    userId: job.userId ?? null,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    config: job.config,
    sourceImages: job.sourceImages,
    generatedFrames: job.generatedFrames,
    frameJudgements: job.frameJudgements ?? null,
    reviewDecisions: job.reviewDecisions ?? null,
    framePrompts: job.framePrompts ?? null,
    userEditRequests: job.userEditRequests ?? null,
    generatedClips: job.generatedClips,
    finalVideoPath: job.finalVideoPath ?? null,
    error: job.error ?? null,
    steps: job.steps,
  };

  await db
    .insert(jobs)
    .values(values)
    .onConflictDoUpdate({
      target: jobs.id,
      set: {
        userId: values.userId,
        status: values.status,
        updatedAt: values.updatedAt,
        config: values.config,
        sourceImages: values.sourceImages,
        generatedFrames: values.generatedFrames,
        frameJudgements: values.frameJudgements,
        reviewDecisions: values.reviewDecisions,
        framePrompts: values.framePrompts,
        userEditRequests: values.userEditRequests,
        generatedClips: values.generatedClips,
        finalVideoPath: values.finalVideoPath,
        error: values.error,
        steps: values.steps,
      },
    })
    .run();
}

/**
 * Optimistic-concurrency (CAS on `updated_at`) column-scoped mutation in D1 via Drizzle.
 */
export async function mutateJob(
  jobId: string,
  updater: (current: VideoJob) => JobPatch | null
): Promise<VideoJob | null> {
  const db = getDb();

  for (let attempt = 1; attempt <= MAX_CAS_RETRIES; attempt += 1) {
    const current = await getJob(jobId);
    if (!current) return null;

    const patch = updater(current);
    if (!patch) return current;

    const now = nextTimestampAfter(current.updatedAt);
    const setValues = patchToDrizzleSet(patch, now);

    const updatedRows = await db
      .update(jobs)
      .set(setValues)
      .where(and(eq(jobs.id, jobId), eq(jobs.updatedAt, current.updatedAt)))
      .returning()
      .all();

    const updatedRow = updatedRows[0];
    if (updatedRow) {
      return rowToJob(updatedRow);
    }

    await new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 40)));
  }

  throw new Error(`Concurrent update conflict on job ${jobId} after ${MAX_CAS_RETRIES} retries`);
}

export async function claimJobExecution(
  jobId: string,
  options: ClaimExecutionOptions
): Promise<ClaimResult> {
  const staleAfterMs = options.staleAfterMs ?? Number(process.env.JOB_STALE_RUNNING_MS ?? DEFAULT_STALE_RUNNING_MS);
  const regenStaleMs = Number(process.env.JOB_STALE_REGEN_MS ?? DEFAULT_STALE_REGEN_MS);
  let rejectionReason: string | undefined;

  const updated = await mutateJob(jobId, (current) => {
    rejectionReason = undefined;
    const statusAllowed = options.allowedStatuses.includes(current.status);
    const staleReclaim = Boolean(options.allowStaleRunning) && isJobRunningStale(current, staleAfterMs);

    if (!statusAllowed && !staleReclaim) {
      if (current.status === "running") {
        rejectionReason = "Job is already running";
      } else if (current.status === "complete") {
        rejectionReason = "Job is already complete";
      } else if (current.status === "awaiting_review") {
        rejectionReason = "Job is awaiting review — use POST /approve to proceed to video";
      } else {
        rejectionReason = `Job cannot be started from status "${current.status}"`;
      }
      return null;
    }

    if (options.requireNoActiveFrameRegen && hasActiveFrameRegeneration(current, regenStaleMs)) {
      rejectionReason = "Some frames are still regenerating — wait for them to finish";
      return null;
    }

    return {
      status: "running",
      error: undefined,
    };
  });

  if (!updated) {
    return { claimed: false, job: null, reason: "Job not found" };
  }
  if (rejectionReason) {
    return { claimed: false, job: updated, reason: rejectionReason };
  }
  return { claimed: true, job: updated };
}

export async function claimFrameRegeneration(
  jobId: string,
  frameIndex: number,
  appendText: string,
  options?: { staleAfterMs?: number }
): Promise<ClaimResult> {
  const staleAfterMs = options?.staleAfterMs ?? Number(process.env.JOB_STALE_REGEN_MS ?? DEFAULT_STALE_REGEN_MS);
  let rejectionReason: string | undefined;

  const updated = await mutateJob(jobId, (current) => {
    rejectionReason = undefined;
    if (current.status !== "awaiting_review") {
      rejectionReason = "Job is not in review state";
      return null;
    }

    const imageStep = current.steps.find((s) => s.kind === "image" && s.index === frameIndex);
    if (imageStep?.status === "running" && !isTimestampStale(imageStep.updatedAt, staleAfterMs)) {
      rejectionReason = "Frame is already regenerating";
      return null;
    }

    const now = new Date().toISOString();
    const existingPrompts = current.framePrompts ?? [];
    const basePrompt = existingPrompts[frameIndex] ?? "";
    const newPrompt = appendText.trim() ? `${basePrompt}\n\n${appendText.trim()}` : basePrompt;
    const updatedPrompts = [...existingPrompts];
    updatedPrompts[frameIndex] = newPrompt;

    const judgements = [...(current.frameJudgements ?? [])];
    while (judgements.length < current.generatedFrames.length) judgements.push(null);
    const priorVerdict = current.frameJudgements?.[frameIndex] ?? null;
    judgements[frameIndex] = null;

    const steps = current.steps.map((step) =>
      step.kind === "image" && step.index === frameIndex
        ? { ...step, status: "running" as const, updatedAt: now }
        : step
    );

    const reviewDecisions = [
      ...(current.reviewDecisions ?? []),
      {
        frameIndex,
        decision: "regenerated" as const,
        score: priorVerdict?.consistencyScore ?? null,
        passed: priorVerdict?.passed ?? null,
        at: now,
        appendText: appendText.trim(),
      },
    ];

    return {
      framePrompts: updatedPrompts,
      frameJudgements: judgements,
      reviewDecisions,
      steps,
      error: undefined,
    };
  });

  if (!updated) {
    return { claimed: false, job: null, reason: "Job not found" };
  }
  if (rejectionReason) {
    return { claimed: false, job: updated, reason: rejectionReason };
  }
  return { claimed: true, job: updated };
}

export async function updateJobStep(
  jobId: string,
  kind: StepKind,
  index: number,
  status: StepStatus,
  outputPath?: string
): Promise<void> {
  const result = await mutateJob(jobId, (job) => {
    const now = new Date().toISOString();
    return {
      steps: job.steps.map((step) =>
        step.kind === kind && step.index === index
          ? { ...step, status, ...(outputPath !== undefined ? { outputPath } : {}), updatedAt: now }
          : step
      ),
    };
  });
  if (!result) throw new Error(`Job ${jobId} was not found`);
}

export async function buildJobAsset(filePath: string, name: string, type: string, size = 0): Promise<JobAsset> {
  return { name, path: filePath, size, type };
}

export async function getJobsByUser(userId: string): Promise<VideoJob[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.createdAt))
    .all();
  return rows.map(rowToJob);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function nextTimestampAfter(previousIso: string): string {
  const nowMs = Date.now();
  const prevMs = Date.parse(previousIso);
  const nextMs = Number.isFinite(prevMs) && nowMs <= prevMs ? prevMs + 1 : nowMs;
  return new Date(nextMs).toISOString();
}

function patchToDrizzleSet(patch: JobPatch, updatedAt: string): Partial<NewJobRow> {
  const setValues: Partial<NewJobRow> = { updatedAt };

  if ("status" in patch) setValues.status = patch.status;
  if ("config" in patch) setValues.config = patch.config;
  if ("sourceImages" in patch) setValues.sourceImages = patch.sourceImages;
  if ("generatedFrames" in patch) setValues.generatedFrames = patch.generatedFrames;
  if ("frameJudgements" in patch) setValues.frameJudgements = patch.frameJudgements ?? null;
  if ("reviewDecisions" in patch) setValues.reviewDecisions = patch.reviewDecisions ?? null;
  if ("framePrompts" in patch) setValues.framePrompts = patch.framePrompts ?? null;
  if ("userEditRequests" in patch) setValues.userEditRequests = patch.userEditRequests ?? null;
  if ("generatedClips" in patch) setValues.generatedClips = patch.generatedClips;
  if ("finalVideoPath" in patch) setValues.finalVideoPath = patch.finalVideoPath ?? null;
  if ("error" in patch) setValues.error = patch.error ?? null;
  if ("steps" in patch) setValues.steps = patch.steps;

  return setValues;
}

export function rowToJob(row: JobRow): VideoJob {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    rootDir: path.join(TMP_DIR, row.id),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    config: row.config ?? DEFAULT_WORKFLOW_CONFIG,
    sourceImages: row.sourceImages ?? [],
    generatedFrames: row.generatedFrames ?? [],
    frameJudgements: row.frameJudgements ?? undefined,
    reviewDecisions: row.reviewDecisions ?? undefined,
    framePrompts: row.framePrompts ?? undefined,
    userEditRequests: row.userEditRequests ?? undefined,
    generatedClips: row.generatedClips ?? [],
    finalVideoPath: row.finalVideoPath ?? undefined,
    error: row.error ?? undefined,
    steps: row.steps ?? [],
  };
}
