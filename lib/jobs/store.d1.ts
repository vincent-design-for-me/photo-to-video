import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getD1Database } from "../cloudflare/d1";
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
  const db = getD1Database();
  const row = await db
    .prepare("SELECT * FROM jobs WHERE id = ? LIMIT 1")
    .bind(jobId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return rowToJob(row);
}

export async function writeJob(job: VideoJob): Promise<void> {
  const db = getD1Database();
  await db
    .prepare(
      `INSERT INTO jobs (
        id, user_id, status, created_at, updated_at, config,
        source_images, generated_frames, frame_judgements, review_decisions,
        frame_prompts, user_edit_requests, generated_clips, final_video_path, error, steps
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        status = excluded.status,
        updated_at = excluded.updated_at,
        config = excluded.config,
        source_images = excluded.source_images,
        generated_frames = excluded.generated_frames,
        frame_judgements = excluded.frame_judgements,
        review_decisions = excluded.review_decisions,
        frame_prompts = excluded.frame_prompts,
        user_edit_requests = excluded.user_edit_requests,
        generated_clips = excluded.generated_clips,
        final_video_path = excluded.final_video_path,
        error = excluded.error,
        steps = excluded.steps`
    )
    .bind(
      job.id,
      job.userId ?? null,
      job.status,
      job.createdAt,
      job.updatedAt,
      JSON.stringify(job.config),
      JSON.stringify(job.sourceImages),
      JSON.stringify(job.generatedFrames),
      job.frameJudgements !== undefined ? JSON.stringify(job.frameJudgements) : null,
      job.reviewDecisions !== undefined ? JSON.stringify(job.reviewDecisions) : null,
      job.framePrompts !== undefined ? JSON.stringify(job.framePrompts) : null,
      job.userEditRequests !== undefined ? JSON.stringify(job.userEditRequests) : null,
      JSON.stringify(job.generatedClips),
      job.finalVideoPath ?? null,
      job.error ?? null,
      JSON.stringify(job.steps)
    )
    .run();
}

/**
 * Optimistic-concurrency (CAS on `updated_at`) column-scoped mutation in D1.
 */
export async function mutateJob(
  jobId: string,
  updater: (current: VideoJob) => JobPatch | null
): Promise<VideoJob | null> {
  const db = getD1Database();

  for (let attempt = 1; attempt <= MAX_CAS_RETRIES; attempt += 1) {
    const current = await getJob(jobId);
    if (!current) return null;

    const patch = updater(current);
    if (!patch) return current;

    const now = nextTimestampAfter(current.updatedAt);
    const { setClauses, values } = patchToSql(patch, now);

    const result = await db
      .prepare(
        `UPDATE jobs SET ${setClauses.join(", ")} WHERE id = ? AND updated_at = ? RETURNING *`
      )
      .bind(...values, jobId, current.updatedAt)
      .all<Record<string, unknown>>();

    const updatedRow = result.results[0];
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
  const db = getD1Database();
  const res = await db
    .prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<Record<string, unknown>>();
  return res.results.map(rowToJob);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function nextTimestampAfter(previousIso: string): string {
  const nowMs = Date.now();
  const prevMs = Date.parse(previousIso);
  const nextMs = Number.isFinite(prevMs) && nowMs <= prevMs ? prevMs + 1 : nowMs;
  return new Date(nextMs).toISOString();
}

function patchToSql(
  patch: JobPatch,
  updatedAt: string
): { setClauses: string[]; values: unknown[] } {
  const setClauses: string[] = ["updated_at = ?"];
  const values: unknown[] = [updatedAt];

  const add = (col: string, value: unknown) => {
    setClauses.push(`${col} = ?`);
    values.push(value);
  };

  if ("status" in patch) add("status", patch.status);
  if ("config" in patch) add("config", JSON.stringify(patch.config));
  if ("sourceImages" in patch) add("source_images", JSON.stringify(patch.sourceImages));
  if ("generatedFrames" in patch) add("generated_frames", JSON.stringify(patch.generatedFrames));
  if ("frameJudgements" in patch) {
    add("frame_judgements", patch.frameJudgements !== undefined ? JSON.stringify(patch.frameJudgements) : null);
  }
  if ("reviewDecisions" in patch) {
    add("review_decisions", patch.reviewDecisions !== undefined ? JSON.stringify(patch.reviewDecisions) : null);
  }
  if ("framePrompts" in patch) {
    add("frame_prompts", patch.framePrompts !== undefined ? JSON.stringify(patch.framePrompts) : null);
  }
  if ("userEditRequests" in patch) {
    add("user_edit_requests", patch.userEditRequests !== undefined ? JSON.stringify(patch.userEditRequests) : null);
  }
  if ("generatedClips" in patch) add("generated_clips", JSON.stringify(patch.generatedClips));
  if ("finalVideoPath" in patch) add("final_video_path", patch.finalVideoPath ?? null);
  if ("error" in patch) add("error", patch.error ?? null);
  if ("steps" in patch) add("steps", JSON.stringify(patch.steps));

  return { setClauses, values };
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToJob(row: Record<string, unknown>): VideoJob {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? undefined,
    rootDir: path.join(TMP_DIR, row.id as string),
    status: row.status as VideoJob["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    config: parseJson(row.config, DEFAULT_WORKFLOW_CONFIG),
    sourceImages: parseJson<JobAsset[]>(row.source_images, []),
    generatedFrames: parseJson<string[]>(row.generated_frames, []),
    frameJudgements: parseJson<VideoJob["frameJudgements"]>(row.frame_judgements, undefined),
    reviewDecisions: parseJson<VideoJob["reviewDecisions"]>(row.review_decisions, undefined),
    framePrompts: parseJson<string[] | undefined>(row.frame_prompts, undefined),
    userEditRequests: parseJson<string[] | undefined>(row.user_edit_requests, undefined),
    generatedClips: parseJson<string[]>(row.generated_clips, []),
    finalVideoPath: (row.final_video_path as string | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    steps: parseJson<VideoJob["steps"]>(row.steps, []),
  };
}
